'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import {
  Card,
  CardContent,
  Box,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { DashboardCard } from '@/components/shared/dashboard-card';
import { StatusChip } from '@/components/shared/status-chip';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { formatDateDMY } from '@/lib/utils/date-format';

type DashboardData = {
  totals: { branches: number; services: number; bookings: number };
  by_day: Array<{ date: string; count: number }>;
  by_status: Array<{ status: string; count: number }>;
  today_overview: { total: number; pending: number; serving: number; completed: number; cancelled: number };
  recent_bookings: Array<{ id: string; queue_number: string; start_time: string; status: string; customer_name: string; service_name: string; branch_name: string }>;
  popular_services: Array<{ name: string; count: number }>;
  branch_summary: Array<{ name: string; count: number }>;
};

export function DashboardCharts() {
  const { push } = useToast();
  const { t } = useTranslation('dashboard');
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentPage, setRecentPage] = useState(1);
  const [recentRowsPerPage, setRecentRowsPerPage] = useState(5);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/dashboard', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) return push(json.error ?? t('load_failed', 'โหลด dashboard ไม่สำเร็จ'), 'error');
      setData(json.data);
    })();
  }, [push, t]);

  const max = useMemo(() => Math.max(...(data?.by_day.map((x) => x.count) ?? [1]), 1), [data]);

  const statusTotal = useMemo(
    () => (data?.by_status ?? []).reduce((sum, x) => sum + x.count, 0),
    [data],
  );

  const donutSegments = useMemo(() => {
    const source = data?.by_status ?? [];
    const colors: Record<string, string> = {
      pending: '#f59e0b',
      pending_approval: '#06b6d4',
      confirmed: '#3b82f6',
      waiting: '#8b5cf6',
      serving: '#22c55e',
      completed: '#16a34a',
      cancelled: '#ef4444',
      no_show: '#64748b',
    };
    let acc = 0;
    return source.map((s) => {
      const pct = statusTotal > 0 ? s.count / statusTotal : 0;
      const start = acc;
      const end = acc + pct;
      acc = end;
      return { ...s, start, end, color: colors[s.status] ?? '#94a3b8' };
    });
  }, [data, statusTotal]);

  if (!data) return <Card><CardContent><Typography variant="body2">{t('loading', 'Loading dashboard...')}</Typography></CardContent></Card>;
  const recentRows = data.recent_bookings.slice((recentPage - 1) * recentRowsPerPage, recentPage * recentRowsPerPage);

  return (
    <Stack spacing={2.2}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(6,1fr)' } }}>
        <DashboardCard label={t('today_queue', 'คิววันนี้')} value={data.today_overview.total} />
        <DashboardCard label={t('pending', 'รอยืนยัน')} value={data.today_overview.pending} color="#d97706" />
        <DashboardCard label={t('serving', 'กำลังให้บริการ')} value={data.today_overview.serving} color="#0284c7" />
        <DashboardCard label={t('completed', 'เสร็จสิ้น')} value={data.today_overview.completed} color="#16a34a" />
        <DashboardCard label={t('cancelled', 'ยกเลิก')} value={data.today_overview.cancelled} color="#dc2626" />
        <DashboardCard label={t('customers_total', 'ลูกค้าทั้งหมด')} value={data.totals.bookings} />
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        <Box>
          <Card><CardContent>
            <Typography fontWeight={700} mb={1}>{t('today_booking_overview', 'Today Booking Overview')}</Typography>
            <Box sx={{ mt: 1, borderRadius: 2, p: 1.5, bgcolor: '#f8fafc' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(data.by_day.length, 1)}, minmax(0, 1fr))`, gap: 1.2, alignItems: 'end', height: 220 }}>
                {data.by_day.map((d) => {
                  const h = Math.max(8, Math.round((d.count / max) * 170));
                  return (
                    <Stack key={d.date} spacing={0.5} alignItems="center" justifyContent="flex-end">
                      <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary' }}>{d.count}</Typography>
                      <Box sx={{ width: '100%', maxWidth: 24, height: h, borderRadius: 2, bgcolor: '#73c088' }} />
                      <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary' }}>{formatDateDMY(d.date)}</Typography>
                    </Stack>
                  );
                })}
              </Box>
            </Box>
          </CardContent></Card>
        </Box>
        <Box>
          <Card><CardContent>
            <Typography fontWeight={700} mb={1}>{t('booking_status_chart', 'Booking Status Chart')}</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <Box sx={{ position: 'relative', width: 220, height: 220 }}>
                <svg viewBox="0 0 44 44" width="220" height="220">
                  <circle cx="22" cy="22" r="15.915" fill="transparent" stroke="#e5e7eb" strokeWidth="6" />
                  {donutSegments.map((seg) => {
                    const dash = `${seg.end - seg.start} ${1 - (seg.end - seg.start)}`;
                    return (
                      <circle
                        key={seg.status}
                        cx="22"
                        cy="22"
                        r="15.915"
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth="6"
                        strokeDasharray={dash}
                        strokeDashoffset={-seg.start}
                        transform="rotate(-90 22 22)"
                        pathLength={1}
                        strokeLinecap="butt"
                      />
                    );
                  })}
                </svg>
                <Stack sx={{ position: 'absolute', inset: 0 }} alignItems="center" justifyContent="center">
                  <Typography variant="caption" color="text.secondary">{t('total', 'Total')}</Typography>
                  <Typography variant="h5" fontWeight={800}>{statusTotal}</Typography>
                </Stack>
              </Box>
              <Stack spacing={1} sx={{ width: '100%' }}>
                {data.by_status.map((s) => (
                  <Stack key={s.status} direction="row" justifyContent="space-between" alignItems="center">
                    <StatusChip status={s.status} />
                    <Typography variant="body2" fontWeight={600}>{s.count}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </CardContent></Card>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '7fr 5fr' } }}>
        <Box>
          <Card><CardContent>
            <Typography fontWeight={700} mb={1}>{t('recent_bookings', 'Recent Bookings')}</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('queue', 'Queue')}</TableCell><TableCell>{t('time', 'Time')}</TableCell><TableCell>{t('customer', 'Customer')}</TableCell><TableCell>{t('service', 'Service')}</TableCell><TableCell>{t('status', 'Status')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentRows.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{b.queue_number}</TableCell>
                    <TableCell>{b.start_time}</TableCell>
                    <TableCell>{b.customer_name}</TableCell>
                    <TableCell>{b.service_name}</TableCell>
                    <TableCell><StatusChip status={b.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Box sx={{ mt: 1 }}>
              <TablePaginationControls
                page={recentPage}
                rowsPerPage={recentRowsPerPage}
                total={data.recent_bookings.length}
                onPageChange={setRecentPage}
                onRowsPerPageChange={(v) => { setRecentRowsPerPage(v); setRecentPage(1); }}
              />
            </Box>
          </CardContent></Card>
        </Box>
        <Box>
          <Stack spacing={2}>
            <Card><CardContent>
              <Typography fontWeight={700} mb={1}>{t('popular_services', 'Popular Services')}</Typography>
              <Stack spacing={1}>
                {data.popular_services.map((s) => (
                  <Stack key={s.name} direction="row" justifyContent="space-between">
                    <Typography variant="body2">{s.name}</Typography>
                    <Typography variant="body2" fontWeight={700}>{s.count}</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent></Card>
            <Card><CardContent>
              <Typography fontWeight={700} mb={1}>{t('branch_summary', 'Branch Summary')}</Typography>
              <Stack spacing={1}>
                {data.branch_summary.map((s) => (
                  <Stack key={s.name} direction="row" justifyContent="space-between">
                    <Typography variant="body2">{s.name}</Typography>
                    <Typography variant="body2" fontWeight={700}>{s.count}</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent></Card>
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}
