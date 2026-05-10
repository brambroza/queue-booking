'use client';

import { Stack } from '@mui/material';
import { PageHeader } from '@/components/shared/page-header';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import { useTranslation } from '@/lib/i18n/useTranslation';

export function DashboardPageClient() {
  const { t } = useTranslation('dashboard');
  return (
    <Stack spacing={2}>
      <PageHeader title={t('title', 'Dashboard')} description={t('subtitle', 'Queue operations overview')} />
      <DashboardCharts />
    </Stack>
  );
}
