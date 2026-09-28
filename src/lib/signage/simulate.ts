/**
 * Pure stand-in for a shop at work, used by the landing page to make a sample
 * board behave like a live one.
 *
 * A real board gets a new payload on every poll. Here the next payload is worked
 * out from the previous one, so the scene templates see the same kind of change
 * and play the same motion. No clock, no randomness: the same input and tick
 * always give the same output.
 */
import type { SignageData, SignagePerson } from './types';

const SAMPLE_NAMES = ['ก***', 'พี่นัท', 'ส***', 'น้องฝน', 'ธ***', 'อ***', 'คุณเมย์', 'ว***'];

/**
 * Queue number that follows another, keeping its prefix and zero padding.
 * @param value Queue number such as `A17` or `08`.
 * @returns The next number, e.g. `A18` or `09`.
 */
export function nextQueueNumber(value: string): string {
  const m = /^(.*?)(\d+)$/.exec(value);
  if (!m) return `${value}1`;
  const next = String(Number(m[2]) + 1);
  return `${m[1]}${next.padStart(m[2].length, '0')}`;
}

/** `HH:MM` plus minutes, kept inside the same day. */
function addMinutes(time: string | null, minutes: number): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time ?? '');
  if (!m) return time;
  const total = Math.min(23 * 60 + 59, Number(m[1]) * 60 + Number(m[2]) + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * One step of a shop's day: either the head of the line is called to a free
 * service point and a new customer joins the line, or the customer who has been
 * served the longest leaves.
 *
 * Calls happen on even ticks while a service point is free and someone is
 * waiting; every other tick somebody finishes. `schedule` is left as it was, so
 * this is meant for templates that read the queues, not the day's timetable.
 *
 * @param data Payload of the previous step.
 * @param tick Step counter, starting at 0. Also makes the ids of new customers unique.
 * @returns Payload of the next step; `data` is not modified.
 */
export function advanceSignage(data: SignageData, tick: number): SignageData {
  const line = [...data.next_queue, ...data.waiting_queue];
  const busy = new Set(data.now_calling.map((p) => p.resource_name));
  const free = data.resources.find((r) => !busy.has(r.name));
  const canCall = Boolean(free) && line.length > 0;

  if (canCall && free && (tick % 2 === 0 || data.now_calling.length === 0)) {
    const [head, ...rest] = line;
    const last = line[line.length - 1];
    const services = line.map((p) => p.service_name).filter((s): s is string => Boolean(s));
    const arrival: SignagePerson = {
      id: `sim-${tick}`,
      queue_number: nextQueueNumber(last.queue_number),
      status: 'waiting',
      start_time: addMinutes(last.start_time, 15),
      end_time: null,
      called_at: null,
      customer_name: SAMPLE_NAMES[tick % SAMPLE_NAMES.length],
      service_name: services.length ? services[tick % services.length] : null,
      resource_name: null,
    };
    const after = [...rest, arrival];
    const called: SignagePerson = { ...head, status: 'called', resource_name: free.name, called_at: data.generated_at };
    return {
      ...data,
      now_calling: [called, ...data.now_calling.map((p) => (p.status === 'called' ? { ...p, status: 'serving' } : p))],
      next_queue: after.slice(0, data.next_queue.length),
      waiting_queue: after.slice(data.next_queue.length),
      totals: { ...data.totals, calling: data.totals.calling + 1 },
    };
  }

  if (data.now_calling.length === 0) return data;
  const served = [...data.now_calling].reverse().find((p) => p.status !== 'called') ?? data.now_calling[data.now_calling.length - 1];
  return {
    ...data,
    now_calling: data.now_calling.filter((p) => p.id !== served.id),
    totals: { ...data.totals, calling: Math.max(0, data.totals.calling - 1), served_today: data.totals.served_today + 1 },
  };
}
