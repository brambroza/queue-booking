import { describe, expect, it } from 'vitest';
import {
  discountedPrice,
  findPriceRuleOverlap,
  matchPriceRule,
  parseStoredBreakdown,
  quoteOrder,
  requoteStoredOrder,
  toStoredBreakdown,
  quoteSummaryLabel,
  weekdayOf,
  type PriceRule,
  type QuoteQueue,
  type ServicePricing,
} from './quote';

const COURT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const COURT_B = 'aaaaaaaa-0000-0000-0000-000000000002';
const BRANCH = 'bbbbbbbb-0000-0000-0000-000000000001';

function queue(startTime: string, extra: Partial<QuoteQueue> = {}): QuoteQueue {
  return {
    date: '2026-11-16',
    startTime,
    slotCount: 1,
    unitMinutes: 60,
    branchId: BRANCH,
    resourceId: COURT_A,
    resourceUnitPrice: 0,
    ...extra,
  };
}

function rule(time_from: string, time_to: string, price: number, extra: Partial<PriceRule> = {}): PriceRule {
  return { resource_id: null, branch_id: null, weekday: null, time_from, time_to, price, ...extra };
}

const BANDS: PriceRule[] = [rule('08:00', '15:00', 500), rule('15:00', '00:00', 550)];

function pricing(extra: Partial<ServicePricing> = {}): ServicePricing {
  return { servicePrice: 300, rules: BANDS, discount: null, enabled: true, ...extra };
}

describe('legacy price (no rules / plan off)', () => {
  it('uses the resource price when above 0, else the service price, × slots × queues', () => {
    const off = pricing({ enabled: false });
    expect(quoteOrder(off, [queue('08:00', { resourceUnitPrice: 400 })]).total).toBe(400);
    expect(quoteOrder(off, [queue('08:00', { resourceUnitPrice: 0 })]).total).toBe(300);
    expect(quoteOrder(off, [queue('08:00', { resourceUnitPrice: 400, slotCount: 3 })]).total).toBe(1200);
    expect(quoteOrder(off, [queue('08:00', { resourceUnitPrice: 400 }), queue('10:00', { resourceUnitPrice: 400 })]).total).toBe(800);
  });

  it('ignores rules and discount when the plan does not allow pricing', () => {
    const off = pricing({ enabled: false, discount: { type: 'amount', value: 50 } });
    const quote = quoteOrder(off, [queue('08:00'), queue('09:00')]);
    expect(quote.total).toBe(600);
    expect(quote.ruled).toBe(false);
  });

  it('enabled with no rules and no discount is the legacy price', () => {
    expect(quoteOrder(pricing({ rules: [] }), [queue('16:00', { resourceUnitPrice: 450 })]).total).toBe(450);
  });
});

describe('time-range price', () => {
  it('prices each slot by its start time', () => {
    expect(quoteOrder(pricing(), [queue('08:00')]).total).toBe(500);
    expect(quoteOrder(pricing(), [queue('14:00')]).total).toBe(500);
    expect(quoteOrder(pricing(), [queue('15:00')]).total).toBe(550);
    expect(quoteOrder(pricing(), [queue('23:00')]).total).toBe(550);
  });

  it('falls back to the legacy price outside every rule', () => {
    expect(quoteOrder(pricing(), [queue('07:00', { resourceUnitPrice: 420 })]).total).toBe(420);
  });

  it('a slot_count queue crossing a band boundary pays each slot its own band', () => {
    const quote = quoteOrder(pricing(), [queue('14:00', { slotCount: 2 })]);
    expect(quote.lines[0].slots.map((s) => s.base)).toEqual([500, 550]);
    expect(quote.total).toBe(1050);
  });

  it('beats the resource price', () => {
    expect(quoteOrder(pricing(), [queue('09:00', { resourceUnitPrice: 999 })]).total).toBe(500);
  });

  it('prefers resource > branch > weekday specific rules', () => {
    const rules = [
      ...BANDS,
      rule('08:00', '15:00', 600, { resource_id: COURT_B }),
      rule('08:00', '15:00', 520, { branch_id: BRANCH }),
      rule('08:00', '15:00', 450, { weekday: 1 }),
    ];
    const p = pricing({ rules });
    // 2026-11-16 is a Monday.
    expect(weekdayOf('2026-11-16')).toBe(1);
    expect(quoteOrder(p, [queue('09:00', { resourceId: COURT_B })]).total).toBe(600);
    expect(quoteOrder(p, [queue('09:00')]).total).toBe(520);
    expect(quoteOrder(p, [queue('09:00', { branchId: null })]).total).toBe(450);
    expect(quoteOrder(p, [queue('09:00', { branchId: null, date: '2026-11-17' })]).total).toBe(500);
  });

  it('skips inactive rules', () => {
    const p = pricing({ rules: [rule('08:00', '15:00', 500, { active: false })] });
    expect(quoteOrder(p, [queue('09:00')]).total).toBe(300);
  });
});

describe('consecutive discount (once)', () => {
  const p = pricing({ discount: { type: 'amount', value: 50 } });

  it('multi-pick 08:00 + 09:00 on one court = 500 + 450', () => {
    const quote = quoteOrder(p, [queue('08:00'), queue('09:00')]);
    expect(quote.lines.map((l) => l.amount)).toEqual([500, 450]);
    expect(quote.total).toBe(950);
    expect(quote.ruled).toBe(true);
  });

  it('every following slot gets the same discount, not a growing one', () => {
    const quote = quoteOrder(p, [queue('08:00', { slotCount: 4 })]);
    expect(quote.lines[0].slots.map((s) => s.price)).toEqual([500, 450, 450, 450]);
  });

  it('discount applies to the band price of that slot', () => {
    const quote = quoteOrder(p, [queue('14:00'), queue('15:00')]);
    expect(quote.lines.map((l) => l.amount)).toEqual([500, 500]);
  });

  it('a gap breaks the run', () => {
    expect(quoteOrder(p, [queue('08:00'), queue('10:00')]).total).toBe(1000);
  });

  it('different courts are not consecutive', () => {
    expect(quoteOrder(p, [queue('08:00'), queue('09:00', { resourceId: COURT_B })]).total).toBe(1000);
  });

  it('order of picks does not matter', () => {
    expect(quoteOrder(p, [queue('09:00'), queue('08:00')]).lines.map((l) => l.amount)).toEqual([450, 500]);
  });

  it('cancelling the first queue puts the rest back to full price', () => {
    expect(quoteOrder(p, [queue('09:00')]).total).toBe(500);
  });

  it('percent discount and floor at 0', () => {
    expect(discountedPrice(500, { type: 'percent', value: 10 })).toBe(450);
    expect(discountedPrice(30, { type: 'amount', value: 50 })).toBe(0);
    expect(discountedPrice(500, { type: 'percent', value: 150 })).toBe(0);
  });

  it('works without time rules (discount on the legacy price)', () => {
    const quote = quoteOrder(pricing({ rules: [], discount: { type: 'amount', value: 50 } }), [
      queue('08:00', { resourceUnitPrice: 400 }),
      queue('09:00', { resourceUnitPrice: 400 }),
    ]);
    expect(quote.total).toBe(750);
  });
});

describe('helpers', () => {
  it('matchPriceRule returns null when nothing matches', () => {
    expect(matchPriceRule(BANDS, { date: '2026-11-16', minutes: 6 * 60, branchId: null, resourceId: null })).toBeNull();
  });

  it('summary label lists ruled slots', () => {
    const quote = quoteOrder(pricing({ discount: { type: 'amount', value: 50 } }), [queue('08:00'), queue('09:00')]);
    expect(quoteSummaryLabel(quote)).toBe('08:00 500 · 09:00 450 (ต่อเนื่อง −50)');
    expect(quoteSummaryLabel(quoteOrder(pricing({ enabled: false }), [queue('08:00')]))).toBe('');
  });

  it('findPriceRuleOverlap only within the same tier', () => {
    expect(findPriceRuleOverlap(BANDS)).toBeNull();
    expect(findPriceRuleOverlap([...BANDS, rule('14:00', '16:00', 1)])).not.toBeNull();
    expect(findPriceRuleOverlap([...BANDS, rule('14:00', '16:00', 1, { resource_id: COURT_A })])).toBeNull();
  });
});

describe('requoteStoredOrder (partial cancel)', () => {
  const p = pricing({ discount: { type: 'amount', value: 50 } });
  function stored(times: string[]) {
    const queues = times.map((t) => queue(t));
    const quote = quoteOrder(p, queues);
    return quote.lines.map((line, i) => ({
      date: queues[i].date,
      resourceId: queues[i].resourceId,
      breakdown: parseStoredBreakdown(toStoredBreakdown(line, { unitMinutes: 60, discount: p.discount }))!,
    }));
  }

  it('remaining queue loses the discount when its predecessor is cancelled', () => {
    const [, nine] = stored(['08:00', '09:00']);
    expect(requoteStoredOrder([nine]).total).toBe(500);
  });

  it('keeps the discount between queues that are still consecutive', () => {
    const [, nine, ten] = stored(['08:00', '09:00', '10:00']);
    const result = requoteStoredOrder([nine, ten]);
    expect(result.amounts).toEqual([500, 450]);
  });

  it('cancelling the last queue leaves the rest unchanged', () => {
    const [eight, nine] = stored(['08:00', '09:00', '10:00']);
    expect(requoteStoredOrder([eight, nine]).amounts).toEqual([500, 450]);
  });

  it('rejects malformed breakdowns', () => {
    expect(parseStoredBreakdown(null)).toBeNull();
    expect(parseStoredBreakdown({ v: 1, slots: [] })).toBeNull();
  });
});
