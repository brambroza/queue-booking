'use client';

import { Chip } from '@mui/material';
import { useTranslation } from '@/lib/i18n/useTranslation';

const colorMap: Record<string, 'warning' | 'info' | 'primary' | 'secondary' | 'success' | 'error' | 'default'> = {
  pending: 'warning',
  pending_approval: 'info',
  confirmed: 'primary',
  waiting: 'secondary',
  serving: 'success',
  completed: 'success',
  cancelled: 'error',
  no_show: 'default',
};

export function StatusChip({ status }: { status: string }) {
  const { t } = useTranslation('status');
  return <Chip size="small" label={t(status, status)} color={colorMap[status] ?? 'default'} variant="filled" />;
}
