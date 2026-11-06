import type { BusinessScenario } from '@/lib/demo/scenarios/types';

/** What the customer owes for one booking. */
export type SimAmount = {
  /** Baht to pay in the app now: the whole price. 0 = pay at the shop / free. */
  due: number;
  /** Same as `due`; kept so callers can show the booking price. */
  total: number;
  /** `none` = nothing to pay online (payment off or price 0), `full` = pay the price now. */
  mode: 'none' | 'full';
};

/**
 * Work out the price and what is due online, like the real flow: the service
 * price, or the resource `unitPrice` when the service price is 0, times the
 * number of queues. There is no deposit and party size never changes the
 * price. With online payment off, or a price of 0, nothing is due and the
 * payment step is skipped.
 *
 * @param scenario - Business scenario.
 * @param serviceKey - Chosen service.
 * @param resourceCode - Chosen service point, or null.
 * @param paymentOn - Whether the visitor turned online payment on.
 * @param queues - Number of queues booked together (multi-pick), default 1.
 * @returns Amounts in whole baht.
 */
export function computeAmount(
  scenario: BusinessScenario,
  serviceKey: string,
  resourceCode: string | null,
  paymentOn: boolean,
  queues = 1,
): SimAmount {
  const service = scenario.services.find((s) => s.key === serviceKey);
  const resource = resourceCode ? scenario.resources.find((r) => r.code === resourceCode) : undefined;
  const servicePrice = service?.price ?? 0;
  const unit = servicePrice > 0 ? servicePrice : resource?.unitPrice ?? 0;
  const total = Math.max(0, Math.round(unit)) * Math.max(1, Math.trunc(queues));
  if (!paymentOn || total === 0) return { total, due: 0, mode: 'none' };
  return { total, due: total, mode: 'full' };
}

/**
 * Thai baht label such as "฿1,200".
 *
 * @param amount - Whole baht.
 */
export function formatBaht(amount: number): string {
  return `฿${Math.round(amount).toLocaleString('th-TH')}`;
}
