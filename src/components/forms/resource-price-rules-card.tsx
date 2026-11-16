'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Alert, Card, CardContent, Chip, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch, Typography } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { ServicePriceRulesEditor } from '@/components/forms/service-price-rules-editor';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { readPaywallDetail, useUpgrade } from '@/components/subscription/upgrade-provider';

type Branch = { id: string; branch_name: string };
type Service = { id: string; service_name: string; active?: boolean; price?: number | string | null };

/**
 * Time-range prices + consecutive discount on /portal/resources.
 *
 * Starts with the owner switch `shops.pricing_enabled` (default off). Off =
 * the editor is hidden and every booking is priced the old way; stored rules
 * stay and apply again when switched back on. On = pick a service and edit the
 * same rules the service drawer on /portal/services edits (one store, two
 * entry points). Turning on needs Professional+ (402 → paywall); turning off
 * is always allowed and asks first.
 *
 * @param props.services - Shop services (inactive ones are hidden).
 * @param props.branches - Shop branches for the branch filter.
 * @param props.onSaved - Called after prices are saved or the switch changes (refreshes the LIFF text switches).
 */
export function ResourcePriceRulesCard({ services, branches, onSaved }: { services: Service[]; branches: Branch[]; onSaved?: () => void }) {
  const { push } = useToast();
  const confirm = useConfirm();
  const { openPaywall } = useUpgrade();
  const choices = useMemo(() => services.filter((s) => s.active !== false), [services]);
  const [serviceId, setServiceId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [planAllowed, setPlanAllowed] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch('/api/shop-display-settings', { cache: 'no-store' });
        const json = await res.json();
        if (alive && res.ok) {
          setEnabled(json.data?.pricing_enabled === true);
          setPlanAllowed(json.data?.pricing_plan_allowed !== false);
        }
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Keep the selection valid when the list loads or a service disappears.
  useEffect(() => {
    if (choices.length === 0) return setServiceId('');
    if (!choices.some((s) => s.id === serviceId)) setServiceId(choices[0].id);
  }, [choices, serviceId]);

  /**
   * Save the owner switch; turning off asks first because prices change at once.
   * @param next - New value.
   */
  async function onToggle(next: boolean) {
    if (!next) {
      const ok = await confirm({
        tone: 'warning',
        title: 'ปิดราคาตามช่วงเวลา / ส่วนลดต่อเนื่อง?',
        description: 'คิวที่จองใหม่จะคิดราคาเดิม (ราคาสนาม/ห้อง ถ้ามี ไม่งั้นราคาบริการ) ช่วงราคาและส่วนลดที่ตั้งไว้ยังเก็บอยู่ เปิดกลับมาได้',
        confirmLabel: 'ปิดการใช้งาน',
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/shop-display-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pricing_enabled: next }),
      });
      const json = await res.json().catch(() => ({}));
      const paywall = readPaywallDetail(res, json);
      if (paywall) return openPaywall(paywall);
      if (!res.ok) return push(json.error ?? 'บันทึกการตั้งค่าไม่สำเร็จ', 'error');
      setEnabled(next);
      push(next ? 'เปิดใช้แล้ว ตั้งช่วงราคา/ส่วนลดด้านล่างได้เลย' : 'ปิดแล้ว ลูกค้าเห็นราคาเดิมภายใน 1 นาที');
      onSaved?.();
    } catch {
      push('บันทึกการตั้งค่าไม่สำเร็จ', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (choices.length === 0) return null;
  const selected = choices.find((s) => s.id === serviceId);

  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5}>
          <div>
            <FormControlLabel
              control={<Switch checked={enabled} disabled={!loaded || saving} onChange={(e: ChangeEvent<HTMLInputElement>) => void onToggle(e.target.checked)} />}
              label={
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="subtitle1" fontWeight={600}>ใช้ราคาตามช่วงเวลา / ส่วนลดชั่วโมงต่อเนื่อง</Typography>
                  {!planAllowed ? <Chip size="small" color="warning" variant="outlined" label="Professional ขึ้นไป" /> : null}
                </Stack>
              }
            />
            <Typography variant="body2" color="text.secondary">
              {enabled
                ? 'เลือกบริการ แล้วตั้งราคาต่อรอบตามช่วงเวลา แยกตามสนาม/ห้องได้ — เป็นค่าเดียวกับที่ตั้งในหน้าบริการ แก้ที่ไหนก็ได้ ช่วงที่ไม่ได้ตั้ง = ราคาเดิม (ราคาสนาม/ห้อง ถ้ามี ไม่งั้นราคาบริการ)'
                : 'ปิดอยู่ = ทุกคิวคิดราคาเดิม (ราคาสนาม/ห้อง ถ้ามี ไม่งั้นราคาบริการ) เปิดเมื่ออยากให้ราคาต่างกันตามช่วงเวลา เช่น หลัง 15:00 แพงขึ้น หรือจองต่อเนื่องได้ส่วนลด'}
            </Typography>
          </div>
          {enabled && !planAllowed ? (
            <Alert severity="warning">แพ็กเกจของร้านต่ำกว่า Professional ตอนนี้ระบบคิดราคาเดิม จนกว่าจะอัปเกรด</Alert>
          ) : null}
          {enabled ? (
            <>
              <FormControl size="small" sx={{ maxWidth: 360 }}>
                <InputLabel>บริการ</InputLabel>
                <Select value={serviceId} label="บริการ" onChange={(e: SelectChangeEvent) => setServiceId(String(e.target.value))}>
                  {choices.map((s) => (
                    <MenuItem key={s.id} value={s.id}>{s.service_name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {selected ? (
                <ServicePriceRulesEditor
                  key={selected.id}
                  serviceId={selected.id}
                  servicePrice={String(selected.price ?? 0)}
                  branches={branches}
                  defaultExpanded
                  onSaved={onSaved}
                />
              ) : null}
            </>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
