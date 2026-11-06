import type { ScenarioService } from '@/lib/demo/scenarios/types';
import { isSlotPast } from '@/lib/booking/slot-time';
import { DAY_MINUTES, toMinutes } from './time';
import type { SimQueue } from './types';

/** Statuses that free the slot again. */
const FREEING: ReadonlySet<string> = new Set(['cancelled', 'no_show']);

/** One cell of the LIFF time grid. */
export type SlotView = {
  time: string;
  /** `open` = bookable, `full` = "เต็ม N/N", `past` = already started. */
  state: 'open' | 'full' | 'past';
  booked: number;
  capacity: number;
  remaining: number;
};

/**
 * Slot start times for a day: `openTime` up to (not including) `closeTime`,
 * every `slotMinutes`. A close time of `00:00`, or one not after the open time,
 * means end of day.
 *
 * @param openTime - "HH:MM".
 * @param closeTime - "HH:MM".
 * @param slotMinutes - Step in minutes (> 0).
 * @returns Sorted `HH:MM` strings.
 */
export function buildSlotTimes(openTime: string, closeTime: string, slotMinutes: number): string[] {
  const step = Math.max(5, Math.trunc(slotMinutes) || 60);
  const open = toMinutes(openTime);
  let close = toMinutes(closeTime);
  if (close <= open) close = DAY_MINUTES;
  const out: string[] = [];
  for (let t = open; t < close; t += step) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  }
  return out;
}

/**
 * Whether a queue takes a place on `date`. Sample queues repeat on every day so
 * "full" slots stay visible whichever day the visitor opens.
 *
 * @param q - Queue.
 * @param date - Day being looked at.
 * @param today - The sandbox's today.
 */
export function queueAppliesOn(q: Pick<SimQueue, 'date' | 'seed' | 'status'>, date: string, today: string): boolean {
  if (FREEING.has(q.status)) return false;
  return q.date === date || (q.seed && date !== today);
}

/**
 * Mark every slot of a day open / full / past.
 *
 * With a service point picked, the point holds one booking at a time (any
 * queue on it that overlaps the slot makes it full 1/1). Without one, the
 * service's `capacityPerSlot` is counted per exact start time, like the real
 * `get_slot_availability`. Past uses the Bangkok clock via `isSlotPast`.
 *
 * @param input.date - Day shown.
 * @param input.today - Sandbox today (for repeating sample queues).
 * @param input.now - Bangkok stamp of the clock.
 * @param input.times - Output of `buildSlotTimes`.
 * @param input.service - Chosen service.
 * @param input.resourceCode - Chosen service point, or null.
 * @param input.queues - Every queue in the sandbox.
 * @returns One entry per time, same order.
 */
export function markSlots(input: {
  date: string;
  today: string;
  now: { date: string; time: string };
  times: string[];
  service: Pick<ScenarioService, 'key' | 'durationMinutes' | 'capacityPerSlot'>;
  resourceCode: string | null;
  queues: SimQueue[];
}): SlotView[] {
  const { date, today, now, service, resourceCode } = input;
  const onDay = input.queues.filter((q) => queueAppliesOn(q, date, today));
  const duration = Math.max(1, service.durationMinutes);

  return input.times.map((time) => {
    const start = toMinutes(time);
    let booked: number;
    let capacity: number;
    if (resourceCode) {
      capacity = 1;
      booked = onDay.some((q) => {
        if (q.resourceCode !== resourceCode) return false;
        const qs = toMinutes(q.time);
        return qs < start + duration && start < qs + Math.max(1, q.durationMinutes);
      })
        ? 1
        : 0;
    } else {
      capacity = Math.max(1, service.capacityPerSlot);
      booked = onDay.filter((q) => q.serviceKey === service.key && toMinutes(q.time) === start).length;
    }
    const remaining = Math.max(capacity - booked, 0);
    const past = isSlotPast({ date, time }, now);
    const state: SlotView['state'] = past ? 'past' : remaining === 0 ? 'full' : 'open';
    return { time, state, booked, capacity, remaining };
  });
}

/**
 * First day (from `today`, within `days`) that still has an open slot, so the
 * LIFF opens on a day the visitor can actually book.
 *
 * @param days - ISO days to try, in order.
 * @param hasOpen - Predicate telling whether a day has an open slot.
 * @returns The day, or the first one when none has room.
 */
export function firstDayWithRoom(days: string[], hasOpen: (iso: string) => boolean): string {
  return days.find(hasOpen) ?? days[0] ?? '';
}
