'use client';

import { useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useUpgrade } from '@/components/subscription/upgrade-provider';
import { formatBaht, type AutomationSummary } from './automation-types';

/**
 * Dashboard card for customer automations.
 *
 * - Win-back on: "ระบบดึงลูกค้ากลับ N คิว ≈ ฿X" for this month.
 * - Win-back not allowed (Starter): the real number of overdue customers as a
 *   locked card with an upgrade button — the upsell hook.
 * - Allowed but off: same numbers with a link to switch it on.
 *
 * Hidden while loading, on error, before the migration, and when there is
 * nothing worth saying (no overdue customers and nothing sent).
 */
export function AutomationRoiCard() {
  const theme = useTheme();
  const { openUpgrade } = useUpgrade();
  const [data, setData] = useState<AutomationSummary | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch('/api/automation');
        if (!res.ok) return;
        const json = (await res.json()) as { data?: AutomationSummary };
        if (alive && json.data) setData(json.data);
      } catch {
        // Optional card: a failure just leaves it hidden.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!data || !data.migrated) return null;
  const { roi, preview, plan, settings } = data;
  const running = settings.followup_enabled || (settings.winback_enabled && plan.winback_allowed);
  if (!running && preview.overdue === 0) return null;

  const main = theme.palette.primary.main;

  return (
    <Card>
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
          <Box
            aria-hidden
            sx={{ flexShrink: 0, width: 44, height: 44, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: alpha(main, 0.12), fontSize: 22 }}
          >
            {plan.winback_allowed ? '🤝' : '🔒'}
          </Box>
          <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="subtitle1" fontWeight={700}>
                ระบบดึงลูกค้ากลับอัตโนมัติ
              </Typography>
              {running && <Chip size="small" color="success" label="กำลังทำงาน" />}
            </Stack>
            {running && roi.total.sent > 0 ? (
              <Typography variant="body2">
                เดือนนี้ส่งข้อความ {roi.total.sent.toLocaleString('th-TH')} ครั้ง · ลูกค้ากลับมาจอง{' '}
                <b>{roi.total.converted.toLocaleString('th-TH')} คิว ≈ {formatBaht(roi.total.revenue)}</b>
              </Typography>
            ) : null}
            {preview.overdue > 0 && (
              <Typography variant="body2" color={running ? 'text.secondary' : 'text.primary'}>
                ตอนนี้มีลูกค้าประจำ <b>{preview.overdue.toLocaleString('th-TH')} คน</b> ที่เลยรอบมาใช้บริการแล้ว
                {preview.reachable > 0 && (
                  <>
                    {' '}
                    ทักทาง LINE ได้ {preview.reachable.toLocaleString('th-TH')} คน ≈ {formatBaht(preview.estimatedBaht)}
                  </>
                )}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              ตัวเลขรายได้เป็นค่าประมาณจากราคาบริการ นับเมื่อลูกค้าจองภายใน 14 วันหลังได้ข้อความ
            </Typography>
          </Stack>
          {!plan.winback_allowed ? (
            <Button variant="contained" sx={{ flexShrink: 0 }} onClick={() => openUpgrade('automation')}>
              เปิดใช้ด้วย Professional
            </Button>
          ) : !settings.winback_enabled ? (
            <Button variant="outlined" sx={{ flexShrink: 0 }} href="/portal/line-settings#automation">
              เปิดใช้งาน
            </Button>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
