'use client';

import { Chip } from '@mui/material';
import { useTranslation } from '@/lib/i18n/useTranslation';

const colorMap: Record<string, 'primary' | 'warning' | 'info' | 'secondary' | 'error' | 'default'> = {
  fixed_slot: 'primary',
  flexible_duration: 'warning',
  capacity_based: 'info',
  walk_in: 'secondary',
  request_approval: 'error',
};

export function BookingModeChip({ mode }: { mode: string }) {
  const { t } = useTranslation('booking_mode');
  return <Chip size="small" label={t(mode, mode)} color={colorMap[mode] ?? 'default'} variant="outlined" />;
}
