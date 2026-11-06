'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { Card, CardContent, FormControlLabel, Switch, Typography } from '@mui/material';
import { useToast } from '@/components/ui/toast';

/**
 * Shop switch on /portal/resources: hide the LIFF "ไม่ระบุสนาม / ผู้ให้บริการ"
 * option so customers must pick a resource. Saves on toggle through
 * `/api/shop-display-settings` (same pattern as the switches on /portal/services)
 * and reverts when the server refuses.
 */
export function ResourceChoiceSettingCard() {
  const { push } = useToast();
  const [required, setRequired] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch('/api/shop-display-settings', { cache: 'no-store' });
        const json = await res.json();
        if (alive && res.ok) setRequired(json.data?.require_resource_choice === true);
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /** Commit the switch straight away; revert on failure so the UI never lies. */
  async function onToggle(next: boolean) {
    setRequired(next);
    setSaving(true);
    try {
      const res = await fetch('/api/shop-display-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ require_resource_choice: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRequired(!next);
        push(json.error ?? 'บันทึกการตั้งค่าไม่สำเร็จ', 'error');
        return;
      }
      push('บันทึกการตั้งค่าแล้ว');
    } catch {
      setRequired(!next);
      push('บันทึกการตั้งค่าไม่สำเร็จ', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent>
        <FormControlLabel
          control={
            <Switch
              checked={required}
              disabled={!loaded || saving}
              onChange={(e: ChangeEvent<HTMLInputElement>) => void onToggle(e.target.checked)}
            />
          }
          label="ลูกค้าต้องเลือกสนาม / ห้อง / ผู้ให้บริการ (ปิดตัวเลือก “ไม่ระบุ”)"
        />
        <Typography variant="caption" color="text.secondary" display="block">
          เปิดแล้ว หน้าจองใน LINE จะไม่มีตัวเลือก &quot;ไม่ระบุ&quot; ลูกค้าต้องเลือกทรัพยากรก่อนจึงจะไปขั้นเลือกเวลาได้
          และราคาจะคิดตามทรัพยากรที่เลือก มีผลเฉพาะบริการที่มีทรัพยากรให้เลือก พนักงานยังสร้างคิวแบบไม่ระบุจากระบบได้
          มีผลทั้งร้าน (หน้าจองอาจใช้เวลาไม่เกิน 1 นาทีกว่าจะเห็นค่าใหม่)
        </Typography>
      </CardContent>
    </Card>
  );
}
