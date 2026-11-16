'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { ServicePriceRulesEditor } from '@/components/forms/service-price-rules-editor';

type Branch = { id: string; branch_name: string };
type Service = { id: string; service_name: string; active?: boolean; price?: number | string | null };

/**
 * Time-range prices + consecutive discount on /portal/resources. Rules belong
 * to a service (`service_price_rules`), so the owner picks the service first and
 * then edits the same rules the service drawer on /portal/services edits —
 * one store, two entry points. Shops that price courts on
 * `booking_resources.unit_price` (service price 0) set per-court bands here.
 *
 * @param props.services - Shop services (inactive ones are hidden).
 * @param props.branches - Shop branches for the branch filter.
 */
export function ResourcePriceRulesCard({ services, branches }: { services: Service[]; branches: Branch[] }) {
  const choices = useMemo(() => services.filter((s) => s.active !== false), [services]);
  const [serviceId, setServiceId] = useState('');

  // Keep the selection valid when the list loads or a service disappears.
  useEffect(() => {
    if (choices.length === 0) return setServiceId('');
    if (!choices.some((s) => s.id === serviceId)) setServiceId(choices[0].id);
  }, [choices, serviceId]);

  if (choices.length === 0) return null;
  const selected = choices.find((s) => s.id === serviceId);

  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5}>
          <div>
            <Typography variant="subtitle1" fontWeight={600}>ราคาตามช่วงเวลา / ส่วนลดชั่วโมงต่อเนื่อง</Typography>
            <Typography variant="body2" color="text.secondary">
              เลือกบริการ แล้วตั้งราคาต่อรอบตามช่วงเวลา แยกตามสนาม/ห้องได้ — เป็นค่าเดียวกับที่ตั้งในหน้าบริการ แก้ที่ไหนก็ได้
              ไม่ตั้งอะไร = ราคาเดิม (ราคาสนาม/ห้อง ถ้ามี ไม่งั้นราคาบริการ)
            </Typography>
          </div>
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
            />
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
