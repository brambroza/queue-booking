'use client';

import { Alert, Typography } from '@mui/material';
import { matchPriceRule, ruleRange, weekdayOf, type ConsecutiveDiscount, type PriceRule } from '@/lib/pricing/quote';

/** `HH:MM` of minutes (1440 → 24:00 shown as 00:00). */
function hhmm(minutes: number): string {
  const m = minutes % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * Price bands that apply to the chosen day / branch / resource, shown under
 * the LIFF time grid ("08:00–15:00 500 บาท · 15:00–00:00 550 บาท") plus the
 * consecutive discount. Only rules that win for that day are listed.
 *
 * @param props.pricing - Rules + discount of the service from /meta.
 * @param props.showBands - Shop switch: show the "ราคาต่อรอบ" bands (default true).
 * @param props.showDiscount - Shop switch: show the consecutive discount line (default true).
 */
export function LiffPriceBands({
  pricing,
  date,
  branchId,
  resourceId,
  showBands = true,
  showDiscount = true,
}: {
  pricing: { rules: PriceRule[]; discount: ConsecutiveDiscount | null };
  date: string;
  branchId: string | null;
  resourceId: string | null;
  showBands?: boolean;
  showDiscount?: boolean;
}) {
  const weekday = date ? weekdayOf(date) : null;
  const bands = !showBands ? [] : pricing.rules
    .filter((r) => r.active !== false)
    .filter((r) => (!r.resource_id || r.resource_id === resourceId) && (!r.branch_id || r.branch_id === branchId) && (r.weekday === null || r.weekday === weekday))
    .map((r) => ({ rule: r, range: ruleRange(r) }))
    .filter((x): x is { rule: PriceRule; range: [number, number] } => Boolean(x.range))
    // A less specific band hidden by a more specific one at its start is not shown.
    .filter((x) => matchPriceRule(pricing.rules, { date, minutes: x.range[0], branchId, resourceId }) === x.rule)
    .sort((a, b) => a.range[0] - b.range[0]);

  const discount = pricing.discount && showDiscount
    ? pricing.discount.type === 'percent'
      ? `จองรอบต่อเนื่อง ลด ${pricing.discount.value}% ต่อรอบ`
      : `จองรอบต่อเนื่อง ลด ${pricing.discount.value.toLocaleString('th-TH')} บาท/รอบ`
    : '';
  if (bands.length === 0 && !discount) return null;

  return (
    <Alert severity="success" icon={false} sx={{ py: 0.5 }}>
      {bands.length > 0 ? (
        <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          ราคาต่อรอบ: {bands.map((b) => `${hhmm(b.range[0])}–${hhmm(b.range[1])} ${Number(b.rule.price).toLocaleString('th-TH')} บาท`).join(' · ')}
        </Typography>
      ) : null}
      {discount ? <Typography variant="caption" color="text.secondary">{discount}</Typography> : null}
    </Alert>
  );
}
