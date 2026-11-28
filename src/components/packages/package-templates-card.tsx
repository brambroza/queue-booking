'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { readPaywallDetail, useUpgrade } from '@/components/subscription/upgrade-provider';
import { formatPackageMinutes, MAX_PACKAGE_DESCRIPTION, usageWindowsLabel, type UsageWindow } from '@/lib/packages/rules';

export type PackageTemplate = {
  id: string;
  name: string;
  description: string | null;
  credit_minutes: number;
  price: number;
  valid_days: number | null;
  service_ids: string[] | null;
  usage_windows: UsageWindow[];
  sell_online: boolean;
  active: boolean;
  sort_order: number;
};

type Service = { id: string; service_name: string };
type WindowDraft = { key: string; weekday: string; time_from: string; time_to: string; rate: string };

const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function key() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type Draft = {
  id: string | null;
  name: string;
  description: string;
  hours: string;
  price: string;
  validDays: string;
  serviceIds: string[];
  windows: WindowDraft[];
  sellOnline: boolean;
  active: boolean;
};

const EMPTY: Draft = { id: null, name: '', description: '', hours: '10', price: '', validDays: '90', serviceIds: [], windows: [], sellOnline: true, active: true };

/**
 * Package templates the shop sells (name, hours, price, expiry, services,
 * usage windows with a deduction rate). Portal `/portal/packages`.
 *
 * @param props.onChanged - Called after a save so the sell dialog sees the new list.
 */
export function PackageTemplatesCard({ onChanged }: { onChanged?: (templates: PackageTemplate[]) => void }) {
  const { push } = useToast();
  const confirm = useConfirm();
  const { openPaywall } = useUpgrade();
  const [rows, setRows] = useState<PackageTemplate[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [ready, setReady] = useState(true);
  const [planAllowed, setPlanAllowed] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [res, resServices] = await Promise.all([fetch('/api/packages', { cache: 'no-store' }), fetch('/api/services', { cache: 'no-store' })]);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return push(json.error ?? 'โหลดแพ็กเกจไม่สำเร็จ', 'error');
    setRows(json.data ?? []);
    setReady(json.ready !== false);
    setPlanAllowed(json.plan_allowed !== false);
    onChanged?.(json.data ?? []);
    if (resServices.ok) {
      const s = await resServices.json();
      setServices(((s.data ?? []) as Array<Record<string, unknown>>).map((x) => ({ id: String(x.id), service_name: String(x.service_name ?? '') })));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openEdit(row: PackageTemplate) {
    setError(null);
    setDraft({
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      hours: String(row.credit_minutes / 60),
      price: String(row.price),
      validDays: row.valid_days ? String(row.valid_days) : '',
      serviceIds: row.service_ids ?? [],
      windows: (row.usage_windows ?? []).map((w) => ({
        key: key(),
        weekday: w.weekday === null ? '' : String(w.weekday),
        time_from: w.time_from.slice(0, 5),
        time_to: w.time_to.slice(0, 5),
        rate: String(w.rate),
      })),
      sellOnline: row.sell_online,
      active: row.active,
    });
  }

  function patchDraft(patch: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  function patchWindow(k: string, patch: Partial<WindowDraft>) {
    setDraft((d) => (d ? { ...d, windows: d.windows.map((w) => (w.key === k ? { ...w, ...patch } : w)) } : d));
  }

  async function save() {
    if (!draft) return;
    const minutes = Math.round(Number(draft.hours) * 60);
    if (!draft.name.trim()) return setError('กรุณาใส่ชื่อแพ็กเกจ');
    if (!(minutes > 0)) return setError('จำนวนชั่วโมงต้องมากกว่า 0');
    if (draft.price === '' || Number(draft.price) < 0) return setError('กรุณาใส่ราคา');
    for (const w of draft.windows) {
      if (!w.time_from || !w.time_to) return setError('กรุณาใส่ช่วงเวลาให้ครบ');
      if (w.time_to !== '00:00' && w.time_from >= w.time_to) return setError(`ช่วง ${w.time_from}-${w.time_to} ไม่ถูกต้อง (00:00 = เที่ยงคืน)`);
      if (!(Number(w.rate) > 0)) return setError('อัตราตัดชั่วโมงต้องมากกว่า 0');
    }
    setSaving(true);
    setError(null);
    const body = {
      ...(draft.id ? { id: draft.id } : {}),
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      credit_minutes: minutes,
      price: Number(draft.price),
      valid_days: draft.validDays ? Number(draft.validDays) : null,
      service_ids: draft.serviceIds.length > 0 ? draft.serviceIds : null,
      usage_windows: draft.windows.map((w) => ({ weekday: w.weekday === '' ? null : Number(w.weekday), time_from: w.time_from, time_to: w.time_to, rate: Number(w.rate) })),
      sell_online: draft.sellOnline,
      active: draft.active,
    };
    const res = await fetch('/api/packages', { method: draft.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    const paywall = readPaywallDetail(res, json);
    if (paywall) return openPaywall(paywall);
    if (!res.ok) return setError(json.error ?? 'บันทึกไม่สำเร็จ');
    push('บันทึกแพ็กเกจแล้ว');
    setDraft(null);
    await load();
  }

  async function remove(row: PackageTemplate) {
    const ok = await confirm({
      tone: 'error',
      title: 'ลบแพ็กเกจนี้?',
      description: 'ลูกค้าจะซื้อแพ็กเกจนี้ไม่ได้อีก แพ็กเกจที่ขายไปแล้วยังใช้ได้ตามเดิม',
      context: { primary: row.name, secondary: `${formatPackageMinutes(row.credit_minutes)} · ${row.price.toLocaleString('th-TH')} บาท` },
      confirmLabel: 'ลบแพ็กเกจ',
    });
    if (!ok) return;
    const res = await fetch(`/api/packages?id=${row.id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return push(json.error ?? 'ลบไม่สำเร็จ', 'error');
    push('ลบแพ็กเกจแล้ว');
    await load();
  }

  return (
    <Card>
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5} mb={2}>
          <Box>
            <Typography variant="h6" fontWeight={700}>แพ็กเกจที่ร้านขาย</Typography>
            <Typography variant="body2" color="text.secondary">ลูกค้าจ่ายล่วงหน้าเป็นชั่วโมง แล้วตัดทีละรอบตอนจองคิว ยกเลิกคิว = คืนชั่วโมง (ไม่มา = ไม่คืน)</Typography>
          </Box>
          <Button startIcon={<AddRoundedIcon />} variant="contained" disabled={!ready} onClick={() => { setError(null); setDraft({ ...EMPTY, windows: [] }); }}>
            เพิ่มแพ็กเกจ
          </Button>
        </Stack>
        {!ready ? <Alert severity="info" sx={{ mb: 2 }}>ระบบแพ็กเกจยังไม่พร้อม (รอเปิดใช้ฐานข้อมูล)</Alert> : null}
        {!planAllowed ? <Alert severity="warning" sx={{ mb: 2 }}>ขายแพ็กเกจได้ตั้งแต่แพ็กเกจ Professional ขึ้นไป — แพ็กเกจที่ลูกค้าซื้อไปแล้วยังใช้ได้</Alert> : null}
        {ready && rows.length === 0 ? <Typography variant="body2" color="text.secondary">ยังไม่มีแพ็กเกจ</Typography> : null}
        <Stack spacing={1}>
          {rows.map((row) => (
            <Box key={row.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography fontWeight={700}>{row.name}</Typography>
                    {!row.active ? <Chip size="small" label="ปิดขาย" /> : row.sell_online ? <Chip size="small" color="success" label="ขายใน LINE" /> : <Chip size="small" variant="outlined" label="ขายที่ร้านเท่านั้น" />}
                  </Stack>
                  <Typography variant="body2">
                    {formatPackageMinutes(row.credit_minutes)} · {Number(row.price).toLocaleString('th-TH')} บาท · {row.valid_days ? `ใช้ได้ ${row.valid_days} วัน` : 'ไม่หมดอายุ'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {row.service_ids && row.service_ids.length > 0
                      ? `บริการ: ${row.service_ids.map((id) => services.find((s) => s.id === id)?.service_name ?? '-').join(', ')}`
                      : 'ใช้ได้ทุกบริการ'}{' '}
                    · {usageWindowsLabel(row.usage_windows ?? [])}
                  </Typography>
                </Box>
                <Stack direction="row">
                  <IconButton aria-label="แก้ไข" size="small" onClick={() => openEdit(row)}><EditOutlinedIcon fontSize="small" /></IconButton>
                  <IconButton aria-label="ลบ" size="small" color="error" onClick={() => void remove(row)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                </Stack>
              </Stack>
            </Box>
          ))}
        </Stack>
      </CardContent>

      <Dialog open={Boolean(draft)} onClose={() => setDraft(null)} fullWidth maxWidth="md">
        <DialogTitle>{draft?.id ? 'แก้ไขแพ็กเกจ' : 'เพิ่มแพ็กเกจ'}</DialogTitle>
        <DialogContent>
          {draft ? (
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}
              {draft.id ? <Alert severity="info">แก้แพ็กเกจแล้วมีผลกับการขายครั้งถัดไป แพ็กเกจที่ลูกค้าซื้อไปแล้วใช้เงื่อนไขเดิม</Alert> : null}
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="ชื่อแพ็กเกจ" value={draft.name} onChange={(e: ChangeEvent<HTMLInputElement>) => patchDraft({ name: e.target.value })} fullWidth size="small" required placeholder="เช่น 10 ชั่วโมง" />
                </Grid>
                <Grid size={{ xs: 6, sm: 2 }}>
                  <TextField label="ชั่วโมง" type="number" value={draft.hours} onChange={(e: ChangeEvent<HTMLInputElement>) => patchDraft({ hours: e.target.value })} fullWidth size="small" slotProps={{ htmlInput: { min: 0.5, step: 0.5 } }} />
                </Grid>
                <Grid size={{ xs: 6, sm: 2 }}>
                  <TextField label="ราคา (บาท)" type="number" value={draft.price} onChange={(e: ChangeEvent<HTMLInputElement>) => patchDraft({ price: e.target.value })} fullWidth size="small" slotProps={{ htmlInput: { min: 0 } }} />
                </Grid>
                <Grid size={{ xs: 12, sm: 2 }}>
                  <TextField label="ใช้ได้ (วัน)" type="number" value={draft.validDays} onChange={(e: ChangeEvent<HTMLInputElement>) => patchDraft({ validDays: e.target.value })} fullWidth size="small" helperText="ว่าง = ไม่หมดอายุ" slotProps={{ htmlInput: { min: 1 } }} />
                </Grid>
                <Grid size={12}>
                  <TextField
                    label="รายละเอียด (ลูกค้าเห็น)"
                    value={draft.description}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => patchDraft({ description: e.target.value })}
                    fullWidth
                    size="small"
                    multiline
                    minRows={2}
                    helperText={`${draft.description.length.toLocaleString()}/${MAX_PACKAGE_DESCRIPTION.toLocaleString()} ตัวอักษร`}
                    slotProps={{ htmlInput: { maxLength: MAX_PACKAGE_DESCRIPTION }, formHelperText: { sx: { textAlign: 'right' } } }}
                  />
                </Grid>
                <Grid size={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel>ใช้กับบริการ</InputLabel>
                    <Select<string[]>
                      multiple
                      value={draft.serviceIds}
                      onChange={(e: SelectChangeEvent<string[]>) => patchDraft({ serviceIds: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value })}
                      input={<OutlinedInput label="ใช้กับบริการ" />}
                      renderValue={(ids: string[]) => (ids.length === 0 ? 'ทุกบริการ' : ids.map((id) => services.find((s) => s.id === id)?.service_name ?? '-').join(', '))}
                      displayEmpty
                    >
                      {services.map((s) => (
                        <MenuItem key={s.id} value={s.id}>
                          <Checkbox checked={draft.serviceIds.includes(s.id)} size="small" />
                          <ListItemText primary={s.service_name} />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Typography variant="caption" color="text.secondary">ไม่เลือก = ใช้ได้ทุกบริการ</Typography>
                </Grid>
              </Grid>

              <Box>
                <Typography variant="subtitle2">ช่วงเวลาที่ใช้ได้ + อัตราตัดชั่วโมง</Typography>
                <Typography variant="body2" color="text.secondary" mb={1}>
                  ไม่ตั้ง = ใช้ได้ทุกเวลา จอง 1 ชม. ตัด 1 ชม. · ตั้งแล้ว รอบที่อยู่นอกทุกช่วงจะใช้แพ็กเกจไม่ได้ · อัตรา 1.5 = จอง 1 ชม. ตัด 1 ชม. 30 นาที (เช่น ช่วงหลัง 15:00)
                </Typography>
                <Stack spacing={1}>
                  {draft.windows.map((w) => (
                    <Grid container spacing={1} key={w.key} alignItems="center">
                      <Grid size={{ xs: 4, sm: 2.5 }}>
                        <FormControl fullWidth size="small">
                          <InputLabel>วัน</InputLabel>
                          <Select value={w.weekday} label="วัน" onChange={(e: SelectChangeEvent) => patchWindow(w.key, { weekday: String(e.target.value) })}>
                            <MenuItem value="">ทุกวัน</MenuItem>
                            {[1, 2, 3, 4, 5, 6, 0].map((d) => <MenuItem key={d} value={String(d)}>{WEEKDAYS[d]}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid size={{ xs: 4, sm: 3 }}>
                        <TextField label="จาก" type="time" value={w.time_from} onChange={(e: ChangeEvent<HTMLInputElement>) => patchWindow(w.key, { time_from: e.target.value })} fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} />
                      </Grid>
                      <Grid size={{ xs: 4, sm: 3 }}>
                        <TextField label="ถึง" type="time" value={w.time_to} onChange={(e: ChangeEvent<HTMLInputElement>) => patchWindow(w.key, { time_to: e.target.value })} fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} />
                      </Grid>
                      <Grid size={{ xs: 8, sm: 2.5 }}>
                        <TextField label="อัตราตัด (×)" type="number" value={w.rate} onChange={(e: ChangeEvent<HTMLInputElement>) => patchWindow(w.key, { rate: e.target.value })} fullWidth size="small" slotProps={{ htmlInput: { min: 0.1, step: 0.25 } }} />
                      </Grid>
                      <Grid size={{ xs: 4, sm: 1 }} sx={{ textAlign: 'right' }}>
                        <IconButton aria-label="ลบช่วง" size="small" onClick={() => patchDraft({ windows: draft.windows.filter((x) => x.key !== w.key) })}><DeleteOutlineIcon fontSize="small" /></IconButton>
                      </Grid>
                    </Grid>
                  ))}
                  <Box>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AddRoundedIcon />}
                      onClick={() => {
                        const last = draft.windows[draft.windows.length - 1];
                        patchDraft({ windows: [...draft.windows, { key: key(), weekday: '', time_from: last ? last.time_to : '08:00', time_to: last ? '00:00' : '15:00', rate: '1' }] });
                      }}
                    >
                      เพิ่มช่วงเวลา
                    </Button>
                  </Box>
                </Stack>
              </Box>

              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <FormControlLabel control={<Switch checked={draft.active} onChange={(e) => patchDraft({ active: e.target.checked })} />} label="เปิดขาย" />
                <FormControlLabel control={<Switch checked={draft.sellOnline} onChange={(e) => patchDraft({ sellOnline: e.target.checked })} />} label="ให้ลูกค้าซื้อเองใน LINE (โอน + ส่งสลิป)" />
              </Stack>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDraft(null)}>ยกเลิก</Button>
          <Button variant="contained" onClick={() => void save()} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึกแพ็กเกจ'}</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
