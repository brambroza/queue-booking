'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { useToast } from '@/components/ui/toast';
import { readPaywallDetail, useUpgrade } from '@/components/subscription/upgrade-provider';
import { PRICE_RULE_WEEKDAYS, quoteOrder, type PriceRule } from '@/lib/pricing/quote';

type Branch = { id: string; branch_name: string };
type Resource = { id: string; resource_name: string; service_ids?: string[] | null; unit_price?: number | null };

/** One editor row; strings because they bind to inputs. */
type RuleDraft = {
  key: string;
  /** '' = every resource. */
  resource_id: string;
  /** '' = every branch. */
  branch_id: string;
  /** '' = every day, else '0'..'6'. */
  weekday: string;
  time_from: string;
  /** '00:00' = end of day. */
  time_to: string;
  price: string;
};

type RuleRow = { id: string; resource_id: string | null; branch_id: string | null; weekday: number | null; time_from: string; time_to: string; price: number; active: boolean };

function newDraft(price: string, from = '08:00', to = '15:00'): RuleDraft {
  return { key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, resource_id: '', branch_id: '', weekday: '', time_from: from, time_to: to, price };
}

/**
 * Time-range prices + consecutive discount of one service, saved on its own
 * button (`PUT /api/services/[id]/price-rules`). Shown in the service drawer
 * for an existing service. Professional+; lower plans see the paywall on save.
 *
 * @param props.serviceId - Service being edited.
 * @param props.servicePrice - Default price (shown as the fallback).
 * @param props.branches - Shop branches for the branch filter.
 * @param props.defaultExpanded - Open the accordion on mount.
 */
export function ServicePriceRulesEditor({
  serviceId,
  servicePrice,
  branches,
  defaultExpanded = false,
}: {
  serviceId: string;
  servicePrice: string;
  branches: Branch[];
  /** Open the accordion on mount (used on /portal/resources where it is the card's only content). */
  defaultExpanded?: boolean;
}) {
  const { push } = useToast();
  const { openPaywall } = useUpgrade();
  const [rules, setRules] = useState<RuleDraft[]>([]);
  const [discountType, setDiscountType] = useState<'' | 'amount' | 'percent'>('');
  const [discountValue, setDiscountValue] = useState('50');
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(true);
  const [planAllowed, setPlanAllowed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [res, resRes] = await Promise.all([
          fetch(`/api/services/${serviceId}/price-rules`, { cache: 'no-store' }),
          fetch('/api/resources?page_size=100', { cache: 'no-store' }),
        ]);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'โหลดราคาไม่สำเร็จ');
        if (cancelled) return;
        const data = json.data as { ready: boolean; plan_allowed: boolean; rules: RuleRow[]; discount: { type: 'amount' | 'percent'; value: number } | null };
        setReady(data.ready);
        setPlanAllowed(data.plan_allowed);
        setRules(
          data.rules.filter((r) => r.active !== false).map((r) => ({
            key: r.id,
            resource_id: r.resource_id ?? '',
            branch_id: r.branch_id ?? '',
            weekday: r.weekday === null ? '' : String(r.weekday),
            time_from: r.time_from.slice(0, 5),
            time_to: r.time_to.slice(0, 5),
            price: String(r.price),
          })),
        );
        setDiscountType(data.discount?.type ?? '');
        setDiscountValue(data.discount ? String(data.discount.value) : '50');
        // Resources only feed the "สนาม/ห้อง" filter; a failure leaves "ทุกสนาม" alone.
        if (resRes.ok) {
          const r = await resRes.json();
          const all = ((r.data ?? []) as Resource[]).filter((x) => !x.service_ids || x.service_ids.length === 0 || x.service_ids.includes(serviceId));
          setResources(all);
        }
        setDirty(false);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'โหลดราคาไม่สำเร็จ');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  function update(key: string, patch: Partial<RuleDraft>) {
    setRules((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty(true);
  }

  function add() {
    const last = rules[rules.length - 1];
    // Next band starts where the previous one ended (08:00–15:00 → 15:00–00:00).
    setRules((prev) => [...prev, last ? newDraft(servicePrice || '0', last.time_to, '00:00') : newDraft(servicePrice || '0')]);
    setDirty(true);
  }

  function remove(key: string) {
    setRules((prev) => prev.filter((r) => r.key !== key));
    setDirty(true);
  }

  /** Live example of the price: one hour at the first band + the next hour (shows the discount). */
  const example = useMemo(() => {
    if (rules.length === 0 && !discountType) return null;
    const parsedRules: PriceRule[] = rules.map((r) => ({
      resource_id: r.resource_id || null,
      branch_id: r.branch_id || null,
      weekday: r.weekday === '' ? null : Number(r.weekday),
      time_from: r.time_from,
      time_to: r.time_to,
      price: Number(r.price) || 0,
    }));
    const start = rules[0]?.time_from ?? '09:00';
    const [h, m] = start.split(':').map(Number);
    const next = `${String((h + 1) % 24).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
    const pricing = {
      servicePrice: Number(servicePrice) || 0,
      rules: parsedRules.filter((r) => !r.resource_id && !r.branch_id && r.weekday === null),
      discount: discountType ? { type: discountType, value: Number(discountValue) || 0 } : null,
      enabled: true,
    };
    const base = { date: '2026-11-16', slotCount: 1, unitMinutes: 60, branchId: null, resourceId: null, resourceUnitPrice: null };
    const quote = quoteOrder(pricing, [{ ...base, startTime: start }, { ...base, startTime: next }]);
    return `ตัวอย่าง (ทุกสนาม ทุกวัน, บริการ 60 นาที): จอง ${start} = ${quote.lines[0].amount.toLocaleString('th-TH')} บาท${
      discountType ? ` · จองต่อ ${next} = ${quote.lines[1].amount.toLocaleString('th-TH')} บาท` : ''
    } · รวม ${quote.total.toLocaleString('th-TH')} บาท`;
  }, [rules, discountType, discountValue, servicePrice]);

  async function save() {
    for (const r of rules) {
      if (!r.time_from || !r.time_to || r.price === '') return setError('กรุณากรอกช่วงเวลาและราคาให้ครบทุกแถว');
      if (r.time_to !== '00:00' && r.time_from >= r.time_to) return setError(`ช่วง ${r.time_from}-${r.time_to} ไม่ถูกต้อง (เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด ใช้ 00:00 = เที่ยงคืน)`);
    }
    if (discountType === 'percent' && Number(discountValue) > 100) return setError('ส่วนลดเป็น % ต้องไม่เกิน 100');
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/services/${serviceId}/price-rules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rules: rules.map((r) => ({
          resource_id: r.resource_id || null,
          branch_id: r.branch_id || null,
          weekday: r.weekday === '' ? null : Number(r.weekday),
          time_from: r.time_from,
          time_to: r.time_to,
          price: Number(r.price) || 0,
          active: true,
        })),
        discount: discountType ? { type: discountType, value: Number(discountValue) || 0 } : null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    const paywall = readPaywallDetail(res, json);
    if (paywall) return openPaywall(paywall);
    if (!res.ok) return setError(json.error ?? 'บันทึกราคาไม่สำเร็จ');
    setDirty(false);
    push('บันทึกราคาแล้ว ลูกค้าเห็นราคาใหม่ภายใน 1 นาที');
  }

  const activeCount = rules.length + (discountType ? 1 : 0);

  return (
    <Accordion defaultExpanded={defaultExpanded} disableGutters variant="outlined" sx={{ '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="subtitle2">ราคาตามช่วงเวลา / ส่วนลดชั่วโมงต่อเนื่อง</Typography>
          {activeCount > 0 ? <Chip size="small" color="primary" label={`ตั้งไว้ ${activeCount} รายการ`} /> : <Chip size="small" variant="outlined" label="ไม่บังคับ" />}
          {!planAllowed ? <Chip size="small" color="warning" variant="outlined" label="Professional ขึ้นไป" /> : null}
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            ตั้งราคาต่อรอบให้ต่างกันตามช่วงเวลา เช่น 08:00-15:00 ราคา 500, 15:00-00:00 ราคา 550 (00:00 = เที่ยงคืน) คิดราคาตามเวลาเริ่มของแต่ละรอบ
            ช่วงที่ไม่ได้ตั้งใช้ราคาเดิม (ราคาสนาม/ห้อง ถ้ามี ไม่งั้นราคาบริการ {Number(servicePrice || 0).toLocaleString('th-TH')} บาท)
            ระบุสนาม/สาขา/วันได้ — ตัวที่ระบุละเอียดกว่าใช้ก่อน
          </Typography>
          {!ready ? <Alert severity="info">ระบบราคาตามช่วงเวลายังไม่พร้อม (รอเปิดใช้ฐานข้อมูล)</Alert> : null}
          {!planAllowed ? (
            <Alert severity="warning">ใช้ได้ตั้งแต่แพ็กเกจ Professional ขึ้นไป — ร้านในแพ็กเกจต่ำกว่าจะคิดราคาเดิม</Alert>
          ) : null}
          {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}
          {loading ? <Typography variant="body2" color="text.secondary">กำลังโหลด...</Typography> : null}

          {!loading && rules.length === 0 ? (
            <Typography variant="body2" color="text.secondary">ยังไม่มีช่วงราคา ทุกรอบใช้ราคาเดิม</Typography>
          ) : null}
          {rules.map((r) => (
            <Grid container spacing={1} key={r.key} alignItems="center">
              <Grid size={{ xs: 6, sm: 2.5 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>สนาม/ห้อง</InputLabel>
                  <Select value={r.resource_id} label="สนาม/ห้อง" onChange={(e: SelectChangeEvent) => update(r.key, { resource_id: String(e.target.value) })}>
                    <MenuItem value="">ทุกสนาม/ห้อง</MenuItem>
                    {resources.map((x) => <MenuItem key={x.id} value={x.id}>{x.resource_name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6, sm: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>สาขา</InputLabel>
                  <Select value={r.branch_id} label="สาขา" onChange={(e: SelectChangeEvent) => update(r.key, { branch_id: String(e.target.value) })}>
                    <MenuItem value="">ทุกสาขา</MenuItem>
                    {branches.map((b) => <MenuItem key={b.id} value={b.id}>{b.branch_name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 4, sm: 1.5 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>วัน</InputLabel>
                  <Select value={r.weekday} label="วัน" onChange={(e: SelectChangeEvent) => update(r.key, { weekday: String(e.target.value) })}>
                    <MenuItem value="">ทุกวัน</MenuItem>
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => <MenuItem key={d} value={String(d)}>{PRICE_RULE_WEEKDAYS[d]}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 4, sm: 1.75 }}>
                <TextField label="จาก" type="time" value={r.time_from} onChange={(e: ChangeEvent<HTMLInputElement>) => update(r.key, { time_from: e.target.value })} fullWidth size="small" slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 300 } }} />
              </Grid>
              <Grid size={{ xs: 4, sm: 1.75 }}>
                <TextField label="ถึง" type="time" value={r.time_to} onChange={(e: ChangeEvent<HTMLInputElement>) => update(r.key, { time_to: e.target.value })} fullWidth size="small" slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 300 } }} />
              </Grid>
              <Grid size={{ xs: 8, sm: 1.75 }}>
                <TextField label="ราคา/รอบ" type="number" value={r.price} onChange={(e: ChangeEvent<HTMLInputElement>) => update(r.key, { price: e.target.value })} fullWidth size="small" slotProps={{ htmlInput: { min: 0 } }} />
              </Grid>
              <Grid size={{ xs: 4, sm: 0.75 }} sx={{ textAlign: 'right' }}>
                <IconButton aria-label="ลบช่วงราคา" onClick={() => remove(r.key)} size="small"><DeleteOutlineIcon fontSize="small" /></IconButton>
              </Grid>
            </Grid>
          ))}
          <Box>
            <Button startIcon={<AddRoundedIcon />} size="small" variant="outlined" onClick={add} disabled={loading}>เพิ่มช่วงราคา</Button>
          </Box>

          <Typography variant="subtitle2" sx={{ pt: 1 }}>ส่วนลดเมื่อจองรอบต่อเนื่อง</Typography>
          <Typography variant="body2" color="text.secondary">
            รอบที่ต่อจากรอบก่อนหน้าทันที (สนามเดียวกัน วันเดียวกัน ในการจองครั้งเดียว) ลดราคาอัตโนมัติ ลดครั้งเดียวต่อรอบ เช่น 500, 450, 450 —
            ถ้าลูกค้ายกเลิกรอบแรก รอบที่เหลือกลับเป็นราคาเต็ม
          </Typography>
          <Grid container spacing={1}>
            <Grid size={{ xs: 6, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>ส่วนลด</InputLabel>
                <Select value={discountType} label="ส่วนลด" onChange={(e: SelectChangeEvent) => { setDiscountType(e.target.value as '' | 'amount' | 'percent'); setDirty(true); }}>
                  <MenuItem value="">ไม่มีส่วนลด</MenuItem>
                  <MenuItem value="amount">ลดเป็นบาท</MenuItem>
                  <MenuItem value="percent">ลดเป็น %</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {discountType ? (
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  label={discountType === 'percent' ? 'ลด (%)' : 'ลด (บาท/รอบ)'}
                  type="number"
                  value={discountValue}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => { setDiscountValue(e.target.value); setDirty(true); }}
                  fullWidth
                  size="small"
                  slotProps={{ htmlInput: { min: 0, max: discountType === 'percent' ? 100 : undefined } }}
                />
              </Grid>
            ) : null}
          </Grid>

          {example ? <Alert severity="success" icon={false}>{example}</Alert> : null}

          <Box>
            <Button variant="contained" size="small" onClick={() => void save()} disabled={saving || loading || !dirty || !ready}>
              {saving ? 'กำลังบันทึก...' : 'บันทึกราคา'}
            </Button>
          </Box>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
