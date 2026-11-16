/**
 * Booking price engine (pure). One function prices an order everywhere: the
 * LIFF summary, `/book`, the portal create drawer, the F&B bill and the
 * re-price after a partial cancel. No DB access here.
 *
 * Rules, in order:
 *   1. Base price of one slot = the best matching `service_price_rules` row
 *      for that slot's start time, else the resource `unit_price` when > 0,
 *      else `services.price` (the price before 2026-11-16).
 *   2. Consecutive discount (once): a slot that starts exactly when the
 *      previous slot of the same order on the same resource ends costs
 *      `base - discount` (amount) or `base × (1 - pct)`; never below 0.
 *      Every following slot gets the same discount (500, 450, 450 …).
 *   3. Pricing off (plan below Professional, or no rules + no discount)
 *      = step 1 without rules = exactly the old price × slots.
 *
 * A slot is matched to a time-range rule by its start time; `time_to` is
 * exclusive and `00:00` as `time_to` means midnight at the end of the day.
 */

import { END_OF_DAY_MINUTES, timeToMinutes } from '@/lib/booking/multi-slot';

/** One time-range price of a service (row of `service_price_rules`). */
export type PriceRule = {
  id?: string;
  /** null = every resource of the service. */
  resource_id: string | null;
  /** null = every branch. */
  branch_id: string | null;
  /** 0 = Sunday … 6 = Saturday; null = every day. */
  weekday: number | null;
  time_from: string;
  /** Exclusive; `00:00` = end of day. */
  time_to: string;
  price: number;
  active?: boolean;
};

export type ConsecutiveDiscount = {
  type: 'amount' | 'percent';
  value: number;
};

/** Everything the engine needs to price one service. */
export type ServicePricing = {
  /** `services.price`. */
  servicePrice: number;
  /** Time-range rules (ignored when `enabled` is false). */
  rules: readonly PriceRule[];
  /** Consecutive-slot discount (ignored when `enabled` is false). */
  discount: ConsecutiveDiscount | null;
  /** Plan allows rule-based pricing (Professional+). */
  enabled: boolean;
};

/** One queue of an order, as the booking flow knows it. */
export type QuoteQueue = {
  /** `YYYY-MM-DD`. */
  date: string;
  /** `HH:MM` or `HH:MM:SS`. */
  startTime: string;
  /** Slots in this queue (`slot_count`, 1 for a normal booking). */
  slotCount: number;
  /** Length of one slot in minutes. */
  unitMinutes: number;
  branchId: string | null;
  resourceId: string | null;
  /** `booking_resources.unit_price` of the queue's resource (0 / null = none). */
  resourceUnitPrice: number | null;
};

/** Price of one slot inside a queue. */
export type QuoteSlot = {
  /** `HH:MM`. */
  time: string;
  base: number;
  discount: number;
  price: number;
  /** Where the base came from. */
  source: 'rule' | 'resource' | 'service';
  ruleId: string | null;
};

export type QuoteLine = {
  /** `HH:MM`. */
  startTime: string;
  slots: QuoteSlot[];
  amount: number;
};

export type OrderQuote = {
  lines: QuoteLine[];
  total: number;
  /** True when any slot got a rule price or a discount (i.e. not the legacy price). */
  ruled: boolean;
};

/** Round to satang. */
export function roundBaht(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Weekday (0 = Sunday) of a `YYYY-MM-DD` date, independent of the server timezone.
 *
 * @param date - Calendar date.
 */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map((x) => Number.parseInt(x, 10));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay();
}

/** `[from, to)` of a rule in minutes, `00:00` end = 1440. Null when malformed. */
export function ruleRange(rule: Pick<PriceRule, 'time_from' | 'time_to'>): [number, number] | null {
  const from = timeToMinutes(rule.time_from);
  const toRaw = timeToMinutes(rule.time_to);
  if (from === null || toRaw === null) return null;
  const to = toRaw === 0 ? END_OF_DAY_MINUTES : toRaw;
  return from < to ? [from, to] : null;
}

/** Higher = more specific: resource 4, branch 2, weekday 1. */
function specificity(rule: PriceRule): number {
  return (rule.resource_id ? 4 : 0) + (rule.branch_id ? 2 : 0) + (rule.weekday !== null ? 1 : 0);
}

/**
 * Best matching rule for one slot, or null.
 *
 * @param rules - Rules of the service.
 * @param slot - Where and when the slot is.
 */
export function matchPriceRule(
  rules: readonly PriceRule[],
  slot: { date: string; minutes: number; branchId: string | null; resourceId: string | null },
): PriceRule | null {
  const weekday = weekdayOf(slot.date);
  let best: PriceRule | null = null;
  let bestScore = -1;
  let bestFrom = Infinity;
  for (const rule of rules) {
    if (rule.active === false) continue;
    if (rule.resource_id && rule.resource_id !== slot.resourceId) continue;
    if (rule.branch_id && rule.branch_id !== slot.branchId) continue;
    if (rule.weekday !== null && rule.weekday !== weekday) continue;
    const range = ruleRange(rule);
    if (!range || slot.minutes < range[0] || slot.minutes >= range[1]) continue;
    const score = specificity(rule);
    // Ties (overlap the API refuses, but stay deterministic): earliest start wins.
    if (score > bestScore || (score === bestScore && range[0] < bestFrom)) {
      best = rule;
      bestScore = score;
      bestFrom = range[0];
    }
  }
  return best;
}

/**
 * Price after the consecutive discount.
 *
 * @param base - Base price of the slot.
 * @param discount - Configured discount.
 */
export function discountedPrice(base: number, discount: ConsecutiveDiscount): number {
  if (!(discount.value > 0)) return base;
  const price = discount.type === 'percent' ? base * (1 - Math.min(discount.value, 100) / 100) : base - discount.value;
  return roundBaht(Math.max(0, price));
}

/** `HH:MM` of minutes since midnight. */
function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** True when the service has anything that changes the legacy price. */
export function hasPricingRules(pricing: Pick<ServicePricing, 'rules' | 'discount' | 'enabled'>): boolean {
  if (!pricing.enabled) return false;
  return pricing.rules.some((r) => r.active !== false) || Boolean(pricing.discount && pricing.discount.value > 0);
}

/**
 * Price an order (one or more queues of the same service).
 *
 * @param pricing - Service pricing config.
 * @param queues - Queues of the order, any order.
 */
export function quoteOrder(pricing: ServicePricing, queues: readonly QuoteQueue[]): OrderQuote {
  const active = hasPricingRules(pricing);
  const rules = active ? pricing.rules : [];
  const discount = active ? pricing.discount : null;

  // Flatten to slots so a run can span queues (multi-pick 08:00 + 09:00) or
  // live inside one queue (slot_count 2).
  type Flat = { queueIndex: number; start: number; end: number; resourceKey: string; date: string; slot: QuoteSlot };
  const flat: Flat[] = [];
  queues.forEach((queue, queueIndex) => {
    const start = timeToMinutes(queue.startTime);
    if (start === null) return;
    const count = Math.max(1, Math.floor(queue.slotCount || 1));
    const unit = Math.max(1, Math.floor(queue.unitMinutes || 1));
    for (let i = 0; i < count; i++) {
      const at = start + unit * i;
      const rule = rules.length > 0
        ? matchPriceRule(rules, { date: queue.date, minutes: at, branchId: queue.branchId, resourceId: queue.resourceId })
        : null;
      const resourcePrice = Number(queue.resourceUnitPrice ?? 0);
      const base = rule ? Number(rule.price) : resourcePrice > 0 ? resourcePrice : Number(pricing.servicePrice ?? 0);
      flat.push({
        queueIndex,
        start: at,
        end: at + unit,
        resourceKey: queue.resourceId ?? '',
        date: queue.date,
        slot: {
          time: hhmm(at),
          base: roundBaht(base),
          discount: 0,
          price: roundBaht(base),
          source: rule ? 'rule' : resourcePrice > 0 ? 'resource' : 'service',
          ruleId: rule?.id ?? null,
        },
      });
    }
  });

  if (discount && discount.value > 0) {
    const sorted = [...flat].sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1));
    for (const item of sorted) {
      const previous = sorted.find((p) => p !== item && p.date === item.date && p.resourceKey === item.resourceKey && p.end === item.start);
      if (!previous) continue;
      const price = discountedPrice(item.slot.base, discount);
      item.slot.discount = roundBaht(item.slot.base - price);
      item.slot.price = price;
    }
  }

  const lines: QuoteLine[] = queues.map((queue, queueIndex) => {
    const slots = flat.filter((f) => f.queueIndex === queueIndex).map((f) => f.slot);
    return {
      startTime: (queue.startTime ?? '').slice(0, 5),
      slots,
      amount: roundBaht(slots.reduce((sum, s) => sum + s.price, 0)),
    };
  });
  const total = roundBaht(lines.reduce((sum, l) => sum + l.amount, 0));
  const ruled = flat.some((f) => f.slot.source === 'rule' || f.slot.discount > 0);
  return { lines, total, ruled };
}

/** Breakdown stored on `bookings.price_breakdown` (one queue). */
export type StoredPriceBreakdown = {
  v: 1;
  /** Length of one slot, for re-pricing the rest of an order later. */
  unit_minutes: number;
  /** Discount in force at booking time (null = none). */
  discount: ConsecutiveDiscount | null;
  slots: Array<Pick<QuoteSlot, 'time' | 'base' | 'discount' | 'price' | 'source'> & { rule_id: string | null }>;
};

/**
 * Serializable breakdown of one line for `bookings.price_breakdown`.
 *
 * @param line - Line of `quoteOrder`.
 * @param context - Slot length and the discount the order was priced with.
 */
export function toStoredBreakdown(
  line: QuoteLine,
  context: { unitMinutes: number; discount: ConsecutiveDiscount | null },
): StoredPriceBreakdown {
  return {
    v: 1,
    unit_minutes: context.unitMinutes,
    discount: context.discount,
    slots: line.slots.map((s) => ({ time: s.time, base: s.base, discount: s.discount, price: s.price, source: s.source, rule_id: s.ruleId })),
  };
}

/** Parse a stored breakdown, or null when absent / malformed / an older shape. */
export function parseStoredBreakdown(value: unknown): StoredPriceBreakdown | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<StoredPriceBreakdown>;
  if (v.v !== 1 || !Array.isArray(v.slots) || !(Number(v.unit_minutes) > 0)) return null;
  const slots = v.slots.filter((s) => s && typeof s.time === 'string' && Number.isFinite(Number(s.base)));
  if (slots.length === 0) return null;
  const d = v.discount;
  const discount = d && (d.type === 'amount' || d.type === 'percent') && Number(d.value) > 0 ? { type: d.type, value: Number(d.value) } : null;
  return { v: 1, unit_minutes: Number(v.unit_minutes), discount, slots: slots.map((s) => ({ ...s, base: Number(s.base) })) };
}

/** Queue of an existing order, re-priced from what was stored at booking time. */
export type StoredQueue = {
  date: string;
  resourceId: string | null;
  breakdown: StoredPriceBreakdown;
};

/**
 * Re-price the queues still left in an order (after the customer cancelled
 * some) from their stored base prices: the consecutive discount is applied
 * again only between the queues that remain, so a queue that lost its
 * predecessor goes back to its full price. Rule edits made since the booking
 * do not change the amount.
 *
 * @param queues - Remaining queues with their stored breakdown.
 * @returns New amount per queue (same order) and the total.
 */
export function requoteStoredOrder(queues: readonly StoredQueue[]): { amounts: number[]; breakdowns: StoredPriceBreakdown[]; total: number } {
  type Flat = { q: number; s: number; start: number; end: number; key: string; date: string; base: number; discount: ConsecutiveDiscount | null };
  const flat: Flat[] = [];
  queues.forEach((queue, q) => {
    queue.breakdown.slots.forEach((slot, s) => {
      const start = timeToMinutes(slot.time);
      if (start === null) return;
      flat.push({ q, s, start, end: start + queue.breakdown.unit_minutes, key: queue.resourceId ?? '', date: queue.date, base: Number(slot.base), discount: queue.breakdown.discount });
    });
  });
  const prices = new Map<string, number>();
  for (const item of flat) {
    const previous = flat.find((p) => p !== item && p.date === item.date && p.key === item.key && p.end === item.start);
    prices.set(`${item.q}:${item.s}`, previous && item.discount ? discountedPrice(item.base, item.discount) : roundBaht(item.base));
  }
  const breakdowns = queues.map((queue, q) => ({
    ...queue.breakdown,
    slots: queue.breakdown.slots.map((slot, s) => {
      const price = prices.get(`${q}:${s}`) ?? roundBaht(Number(slot.base));
      return { ...slot, price, discount: roundBaht(Number(slot.base) - price) };
    }),
  }));
  const amounts = breakdowns.map((b) => roundBaht(b.slots.reduce((sum, s) => sum + s.price, 0)));
  return { amounts, breakdowns, total: roundBaht(amounts.reduce((a, b) => a + b, 0)) };
}

/**
 * Thai one-line summary of an order for the LIFF / Flex, e.g.
 * "08:00 500 · 09:00 450 (ต่อเนื่อง −50)". Empty when nothing was ruled.
 *
 * @param quote - Result of `quoteOrder`.
 */
export function quoteSummaryLabel(quote: OrderQuote): string {
  if (!quote.ruled) return '';
  return quote.lines
    .flatMap((l) => l.slots)
    .sort((a, b) => (a.time < b.time ? -1 : 1))
    .map((s) => `${s.time} ${s.price.toLocaleString('th-TH')}${s.discount > 0 ? ` (ต่อเนื่อง −${s.discount.toLocaleString('th-TH')})` : ''}`)
    .join(' · ');
}

/** Thai weekday short names, index = `extract(dow)`. */
export const PRICE_RULE_WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as const;

/**
 * First pair of active rules that cover the same slot in the same tier
 * (same resource, branch and weekday), or null. Different tiers may overlap
 * on purpose (a court-specific price over the service price).
 *
 * @param rules - Rules as sent by the portal.
 */
export function findPriceRuleOverlap(rules: readonly PriceRule[]): [PriceRule, PriceRule] | null {
  const active = rules.filter((r) => r.active !== false);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (a.resource_id !== b.resource_id || a.branch_id !== b.branch_id || a.weekday !== b.weekday) continue;
      const ra = ruleRange(a);
      const rb = ruleRange(b);
      if (ra && rb && ra[0] < rb[1] && rb[0] < ra[1]) return [a, b];
    }
  }
  return null;
}
