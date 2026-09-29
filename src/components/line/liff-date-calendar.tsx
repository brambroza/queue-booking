'use client';

import { useEffect, useMemo, useState } from 'react';
import { Box, ButtonBase, IconButton, Stack, Typography } from '@mui/material';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import {
  WEEKDAY_LABELS_TH,
  bookableMonths,
  buildMonthGrid,
  formatThaiMonthTitle,
  isDayBookable,
  type BookableDayRules,
} from '@/lib/booking/bookable-days';

/**
 * Month calendar for the LIFF booking step that shows ONLY days the customer
 * can book. Closed days, holidays, past days and days beyond the branch's
 * booking window are left as blank cells, and months with nothing to book are
 * skipped — so there is nothing to tap that would answer "not available".
 *
 * Replaces the native date input, whose picker cannot hide days and on some
 * iOS versions ignores `min` / `max`.
 *
 * @param value - Selected day `YYYY-MM-DD`, '' when none.
 * @param rules - Branch rules from `/bookable-days`.
 * @param onChange - Called with the day the customer tapped.
 */
export function LiffDateCalendar({
  value,
  rules,
  onChange,
}: {
  value: string;
  rules: BookableDayRules;
  onChange: (iso: string) => void;
}) {
  const months = useMemo(() => bookableMonths(rules), [rules]);
  const [month, setMonth] = useState(() => (value ? value.slice(0, 7) : months[0] ?? ''));

  // Follow the selection (and a branch change) to a month that still exists.
  useEffect(() => {
    const wanted = value ? value.slice(0, 7) : '';
    setMonth((prev) => {
      if (wanted && months.includes(wanted)) return wanted;
      return months.includes(prev) ? prev : months[0] ?? '';
    });
  }, [value, months]);

  const index = months.indexOf(month);
  const cells = useMemo(() => buildMonthGrid(month), [month]);

  if (months.length === 0 || index < 0) return null;

  return (
    <Stack spacing={1}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <IconButton
          size="small"
          aria-label="เดือนก่อนหน้า"
          onClick={() => setMonth(months[index - 1])}
          sx={{ visibility: index > 0 ? 'visible' : 'hidden' }}
        >
          <ChevronLeftRoundedIcon />
        </IconButton>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }} aria-live="polite">
          {formatThaiMonthTitle(month)}
        </Typography>
        <IconButton
          size="small"
          aria-label="เดือนถัดไป"
          onClick={() => setMonth(months[index + 1])}
          sx={{ visibility: index < months.length - 1 ? 'visible' : 'hidden' }}
        >
          <ChevronRightRoundedIcon />
        </IconButton>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
        {WEEKDAY_LABELS_TH.map((label) => (
          <Typography key={label} variant="caption" color="text.secondary" sx={{ textAlign: 'center', fontWeight: 600 }}>
            {label}
          </Typography>
        ))}
        {cells.map((iso, i) => {
          // Blank cell keeps the weekday columns aligned without showing the day.
          if (!iso || !isDayBookable(iso, rules)) return <Box key={iso ?? `pad-${i}`} sx={{ minHeight: 40 }} />;
          const selected = iso === value;
          const isToday = iso === rules.today;
          return (
            <ButtonBase
              key={iso}
              onClick={() => onChange(iso)}
              aria-pressed={selected}
              aria-label={iso}
              sx={{
                minHeight: 40,
                borderRadius: '12px',
                border: 1,
                borderColor: selected ? 'primary.main' : isToday ? 'primary.light' : 'divider',
                bgcolor: selected ? 'primary.main' : 'background.paper',
                color: selected ? 'primary.contrastText' : 'text.primary',
                fontWeight: 600,
                fontSize: 14,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {Number(iso.slice(8, 10))}
            </ButtonBase>
          );
        })}
      </Box>
    </Stack>
  );
}
