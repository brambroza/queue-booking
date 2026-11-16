'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { Card, CardContent, FormControlLabel, Switch, Typography } from '@mui/material';
import { useToast } from '@/components/ui/toast';

/**
 * Owner switch: always show "แพ็กเกจของฉัน" on the LIFF member page, even
 * when the customer has no package yet ("ยังไม่มีแพ็กเกจ"). Off = shown only
 * when the customer holds one or the shop sells one online. Saves on toggle
 * (`PATCH /api/shop-display-settings { liff_show_packages }`), reverts on failure.
 */
export function LiffPackagesVisibilityCard() {
  const { push } = useToast();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/shop-display-settings', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json) setChecked(json.data?.liff_show_packages === true);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onToggle(next: boolean) {
    setChecked(next);
    setSaving(true);
    const res = await fetch('/api/shop-display-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ liff_show_packages: next }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setChecked(!next);
      return push(json.error ?? 'บันทึกการตั้งค่าไม่สำเร็จ', 'error');
    }
    push('บันทึกการตั้งค่าแล้ว ลูกค้าเห็นผลภายใน 1 นาที');
  }

  return (
    <Card>
      <CardContent>
        <FormControlLabel
          control={<Switch checked={checked} disabled={!loaded || saving} onChange={(e: ChangeEvent<HTMLInputElement>) => void onToggle(e.target.checked)} />}
          label='แสดงหัวข้อ "แพ็กเกจของฉัน" ในหน้าสมาชิก LINE เสมอ'
        />
        <Typography variant="caption" color="text.secondary" display="block">
          เปิด = ลูกค้าทุกคนเห็นหัวข้อนี้ แม้ยังไม่มีแพ็กเกจ (ขึ้นว่า &quot;ยังไม่มีแพ็กเกจ&quot;) พร้อมรายการแพ็กเกจที่ร้านขายใน LINE ·
          ปิด = แสดงเฉพาะลูกค้าที่มีแพ็กเกจอยู่ หรือเมื่อร้านมีแพ็กเกจขายใน LINE · ใช้ได้ตั้งแต่แพ็กเกจ Professional ขึ้นไป
        </Typography>
      </CardContent>
    </Card>
  );
}
