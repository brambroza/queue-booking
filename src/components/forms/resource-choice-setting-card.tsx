'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { Card, CardContent, Divider, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { useToast } from '@/components/ui/toast';

/** Shop flags on /portal/resources that change how LIFF shows the resource picker. */
type ResourceFlags = {
  require_resource_choice: boolean;
  show_resource_capacity: boolean;
};

type ResourceFlagKey = keyof ResourceFlags;

/**
 * Shop switches on /portal/resources:
 * - hide the LIFF "ไม่ระบุสนาม / ผู้ให้บริการ" option so customers must pick a resource;
 * - show / hide the "N ที่นั่ง" text on LIFF resource cards (default shown).
 * Each switch saves on toggle through `/api/shop-display-settings` (same pattern as
 * the switches on /portal/services) and reverts when the server refuses.
 */
export function ResourceChoiceSettingCard() {
  const { push } = useToast();
  const [flags, setFlags] = useState<ResourceFlags>({ require_resource_choice: false, show_resource_capacity: true });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<ResourceFlagKey | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch('/api/shop-display-settings', { cache: 'no-store' });
        const json = await res.json();
        if (alive && res.ok) {
          setFlags({
            require_resource_choice: json.data?.require_resource_choice === true,
            show_resource_capacity: json.data?.show_resource_capacity !== false,
          });
        }
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Commit one switch straight away; revert on failure so the UI never lies.
   * @param key - Flag to write.
   * @param next - New value.
   */
  async function onToggle(key: ResourceFlagKey, next: boolean) {
    setFlags((f) => ({ ...f, [key]: next }));
    setSaving(key);
    try {
      const res = await fetch('/api/shop-display-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFlags((f) => ({ ...f, [key]: !next }));
        push(json.error ?? 'บันทึกการตั้งค่าไม่สำเร็จ', 'error');
        return;
      }
      push('บันทึกการตั้งค่าแล้ว');
    } catch {
      setFlags((f) => ({ ...f, [key]: !next }));
      push('บันทึกการตั้งค่าไม่สำเร็จ', 'error');
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2} divider={<Divider flexItem />}>
          <div>
            <FormControlLabel
              control={
                <Switch
                  checked={flags.require_resource_choice}
                  disabled={!loaded || saving !== null}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => void onToggle('require_resource_choice', e.target.checked)}
                />
              }
              label="ลูกค้าต้องเลือกสนาม / ห้อง / ผู้ให้บริการ (ปิดตัวเลือก “ไม่ระบุ”)"
            />
            <Typography variant="caption" color="text.secondary" display="block">
              เปิดแล้ว หน้าจองใน LINE จะไม่มีตัวเลือก &quot;ไม่ระบุ&quot; ลูกค้าต้องเลือกทรัพยากรก่อนจึงจะไปขั้นเลือกเวลาได้
              และราคาจะคิดตามทรัพยากรที่เลือก มีผลเฉพาะบริการที่มีทรัพยากรให้เลือก พนักงานยังสร้างคิวแบบไม่ระบุจากระบบได้
              มีผลทั้งร้าน (หน้าจองอาจใช้เวลาไม่เกิน 1 นาทีกว่าจะเห็นค่าใหม่)
            </Typography>
          </div>
          <div>
            <FormControlLabel
              control={
                <Switch
                  checked={flags.show_resource_capacity}
                  disabled={!loaded || saving !== null}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => void onToggle('show_resource_capacity', e.target.checked)}
                />
              }
              label="แสดงจำนวนที่นั่ง (เช่น “1 ที่นั่ง”) ให้ลูกค้าเห็นตอนเลือก"
            />
            <Typography variant="caption" color="text.secondary" display="block">
              ปิดแล้ว การ์ดสนาม / ห้อง / โต๊ะ ในหน้าจอง LINE จะไม่มีข้อความ &quot;N ที่นั่ง&quot; เหมาะกับร้านที่ทุกทรัพยากรรับ 1 คิว เช่น สนามกีฬา
              เป็นแค่การแสดงผล จำนวนที่นั่งยังใช้คำนวณการจองเหมือนเดิม (หน้าจองอาจใช้เวลาไม่เกิน 1 นาทีกว่าจะเห็นค่าใหม่)
            </Typography>
          </div>
        </Stack>
      </CardContent>
    </Card>
  );
}
