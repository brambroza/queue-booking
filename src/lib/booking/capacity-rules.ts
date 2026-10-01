import type { z } from 'zod';
import type { capacityRuleSchema } from '@/lib/booking/schemas';

/**
 * Pure helpers for `service_capacity_rules`, shared by the API route and its
 * tests. The precedence between tiers is decided by the database function
 * `resolve_slot_capacity`; this file only validates what the portal sends.
 */

export type CapacityRuleInput = z.infer<typeof capacityRuleSchema>;

/** Thai short weekday names indexed by `extract(dow)` (0 = Sunday). */
export const CAPACITY_RULE_WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as const;

/**
 * First pair of active rules that cover the same slot in the same tier, or null.
 *
 * Two rules are in the same tier when they target the same branch (or both
 * every branch) and the same weekday (or both every weekday). Rules in
 * different tiers may overlap on purpose — that is how a branch-specific rule
 * overrides a shop-wide one. `time_to` is exclusive, so 09:00–12:00 and
 * 12:00–18:00 do not overlap.
 *
 * @param rules - Rules as sent by the portal (`HH:MM` or `HH:MM:SS`).
 */
export function findOverlap(rules: CapacityRuleInput[]): [CapacityRuleInput, CapacityRuleInput] | null {
  const active = rules.filter((r) => r.active);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (a.branch_id !== b.branch_id || a.weekday !== b.weekday) continue;
      if (minutes(a.time_from) < minutes(b.time_to) && minutes(b.time_from) < minutes(a.time_to)) return [a, b];
    }
  }
  return null;
}

/** `HH:MM[:SS]` → minutes since midnight. */
function minutes(value: string): number {
  const [h, m] = value.split(':').map((x) => Number.parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}
