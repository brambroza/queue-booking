'use client';

import {
  Card,
  CardContent,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { StatusChip } from '@/components/shared/status-chip';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { getTodayISOInBangkok } from '@/lib/utils/date-format';
import { FILTER_STATUSES, addDays, type Resource } from './booking-types';

export type DateRangeKind = 'today' | 'tomorrow' | 'all' | 'custom';

export type BookingsFilter = {
  /** Which quick range is active; `custom` shows the date input. */
  range: DateRangeKind;
  /** ISO date sent to the API; empty when `range` is `all`. */
  date: string;
  status: string;
  /** '' = every resource, 'none' = unassigned, otherwise a resource id. */
  resource: string;
  search: string;
};

/**
 * Resolve the quick range to the `date` query value the API expects.
 */
export function dateForRange(range: DateRangeKind, custom: string): string {
  const today = getTodayISOInBangkok();
  if (range === 'today') return today;
  if (range === 'tomorrow') return addDays(today, 1);
  if (range === 'all') return '';
  return custom;
}

/**
 * Minimal filter strip for the bookings list: quick date toggle, status, resource,
 * search and a refresh button. Sticky so it stays reachable on long lists.
 */
export function BookingsFilterBar({
  value,
  onChange,
  onRefresh,
  resources,
  resourceLabel,
  total,
  loading,
}: {
  value: BookingsFilter;
  onChange: (next: BookingsFilter) => void;
  onRefresh: () => void;
  resources: Resource[];
  resourceLabel: string;
  total: number;
  loading?: boolean;
}) {
  const { t } = useTranslation('bookings');

  const fieldSx = {
    minWidth: 150,
    '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' },
  } as const;

  return (
    <Card sx={{ position: 'sticky', top: 8, zIndex: 5 }}>
      <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
        <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={value.range}
            onChange={(_, next: DateRangeKind | null) => {
              if (!next) return;
              onChange({ ...value, range: next, date: dateForRange(next, value.date || getTodayISOInBangkok()) });
            }}
            aria-label={t('filter_range', 'ช่วงวันที่')}
          >
            <ToggleButton value="today">{t('range_today', 'วันนี้')}</ToggleButton>
            <ToggleButton value="tomorrow">{t('range_tomorrow', 'พรุ่งนี้')}</ToggleButton>
            <ToggleButton value="all">{t('range_all', 'ทั้งหมด')}</ToggleButton>
            <ToggleButton value="custom">{t('range_custom', 'เลือกวัน')}</ToggleButton>
          </ToggleButtonGroup>

          {value.range === 'custom' ? (
            <TextField
              id="bookings-date"
              type="date"
              size="small"
              value={value.date}
              onChange={(e) => onChange({ ...value, date: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ minWidth: 160 }}
            />
          ) : null}

          <TextField
            id="bookings-status"
            select
            size="small"
            value={value.status}
            onChange={(e) => onChange({ ...value, status: e.target.value })}
            sx={fieldSx}
            slotProps={{ select: { displayEmpty: true } }}
          >
            <MenuItem value="">{t('filter_all_status', 'ทุกสถานะ')}</MenuItem>
            {FILTER_STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                <StatusChip status={s} />
              </MenuItem>
            ))}
          </TextField>

          {resources.length > 0 ? (
            <TextField
              id="bookings-resource"
              select
              size="small"
              value={value.resource}
              onChange={(e) => onChange({ ...value, resource: e.target.value })}
              sx={fieldSx}
              slotProps={{ select: { displayEmpty: true } }}
            >
              <MenuItem value="">{`${t('filter_every', 'ทุก')}${resourceLabel}`}</MenuItem>
              <MenuItem value="none">{`${t('filter_unassigned', 'ยังไม่ระบุ')}${resourceLabel}`}</MenuItem>
              {resources.map((r) => (
                <MenuItem key={r.id} value={r.id}>{r.resource_name}</MenuItem>
              ))}
            </TextField>
          ) : null}

          <TextField
            id="bookings-search"
            size="small"
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            placeholder={t('search_placeholder', 'ค้นหาเลขคิว / หมายเหตุ')}
            sx={{ ...fieldSx, minWidth: 200 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" color="disabled" />
                  </InputAdornment>
                ),
                endAdornment: value.search ? (
                  <InputAdornment position="end">
                    <IconButton size="small" edge="end" aria-label={t('clear_search', 'ล้างคำค้น')} onClick={() => onChange({ ...value, search: '' })}>
                      <CloseRoundedIcon fontSize="inherit" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              },
            }}
          />

          <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: { sm: 'auto' } }}>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {total} {t('queue_unit', 'คิว')}
            </Typography>
            <Tooltip title={t('refresh', 'รีเฟรช')}>
              <span>
                <IconButton size="small" onClick={onRefresh} disabled={loading} aria-label={t('refresh', 'รีเฟรช')}>
                  <RefreshRoundedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
