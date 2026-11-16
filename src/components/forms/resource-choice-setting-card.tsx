'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { Card, CardContent, Divider, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { useToast } from '@/components/ui/toast';

/** Shop flags on /portal/resources that change how LIFF shows the resource picker. */
type ResourceFlags = {
  require_resource_choice: boolean;
  show_resource_capacity: boolean;
  liff_show_multi_pick_hint: boolean;
  liff_show_price_bands: boolean;
  liff_show_consecutive_discount: boolean;
};

/** Which LIFF texts exist at all — a switch is shown only when its feature is on. */
type HintFeatures = { multi_pick_hint: boolean; price_bands: boolean; consecutive_discount: boolean };

/** Helper lines under the LIFF time grid; each switch hides one line (display only). */
const HINT_SWITCHES: { key: ResourceFlagKey; feature: keyof HintFeatures; label: string; example: string }[] = [
  { key: 'liff_show_multi_pick_hint', feature: 'multi_pick_hint', label: 'แสดงคำแนะนำการเลือกหลายช่อง', example: 'แตะเลือกได้หลายช่อง สูงสุด 4 ช่อง (ได้ 1 คิวต่อช่อง) · แตะช่องที่เลือกแล้วเพื่อเอาออก — บรรทัด "เลือกแล้ว N ช่อง" ยังแสดงเสมอ' },
  { key: 'liff_show_price_bands', feature: 'price_bands', label: 'แสดงราคาต่อรอบตามช่วงเวลา', example: 'ราคาต่อรอบ: 08:00–15:00 500 บาท · 15:00–00:00 550 บาท' },
  { key: 'liff_show_consecutive_discount', feature: 'consecutive_discount', label: 'แสดงข้อความส่วนลดจองรอบต่อเนื่อง', example: 'จองรอบต่อเนื่อง ลด 50 บาท/รอบ' },
];

type ResourceFlagKey = keyof ResourceFlags;

/**
 * Shop switches on /portal/resources:
 * - hide the LIFF "ไม่ระบุสนาม / ผู้ให้บริการ" option so customers must pick a resource;
 * - show / hide the "N ที่นั่ง" text on LIFF resource cards (default shown);
 * - show / hide each helper line under the LIFF time grid (multi-pick hint,
 *   price bands, consecutive discount — default shown, display only).
 *   A text switch is shown only when its feature is on (multi-pick enabled,
 *   a price rule, a consecutive discount); none on = the whole group is hidden.
 * Each switch saves on toggle through `/api/shop-display-settings` (same pattern as
 * the switches on /portal/services) and reverts when the server refuses.
 *
 * @param props.refreshKey - Bump to reload (e.g. after prices are saved on this page).
 */
export function ResourceChoiceSettingCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const { push } = useToast();
  const [flags, setFlags] = useState<ResourceFlags>({
    require_resource_choice: false,
    show_resource_capacity: true,
    liff_show_multi_pick_hint: true,
    liff_show_price_bands: true,
    liff_show_consecutive_discount: true,
  });
  const [features, setFeatures] = useState<HintFeatures>({ multi_pick_hint: false, price_bands: false, consecutive_discount: false });
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
            liff_show_multi_pick_hint: json.data?.liff_show_multi_pick_hint !== false,
            liff_show_price_bands: json.data?.liff_show_price_bands !== false,
            liff_show_consecutive_discount: json.data?.liff_show_consecutive_discount !== false,
          });
          setFeatures({
            multi_pick_hint: json.data?.hint_features?.multi_pick_hint === true,
            price_bands: json.data?.hint_features?.price_bands === true,
            consecutive_discount: json.data?.hint_features?.consecutive_discount === true,
          });
        }
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const visibleHints = HINT_SWITCHES.filter((h) => features[h.feature]);

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
          {visibleHints.length > 0 ? (
            <div>
              <Typography variant="subtitle2">ข้อความใต้ตารางเวลาในหน้าจอง LINE</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                ปิดเพื่อซ่อนข้อความแต่ละบรรทัด เป็นแค่การแสดงผล ราคาและส่วนลดยังคิดเหมือนเดิม และยอดรวมยังแสดงตอนสรุปการจอง
              </Typography>
              {visibleHints.map((h) => (
                <div key={h.key}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={flags[h.key]}
                        disabled={!loaded || saving !== null}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => void onToggle(h.key, e.target.checked)}
                      />
                    }
                    label={h.label}
                  />
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ pl: 6, mt: -0.5, mb: 0.5 }}>
                    ตัวอย่าง: {h.example}
                  </Typography>
                </div>
              ))}
            </div>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
