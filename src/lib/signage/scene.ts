/**
 * Pure helpers behind the 2D scene templates (lane, timeline, route, floor, invite, flap).
 *
 * Everything here works on the normalised `SignageData`, so the same rules drive
 * the TV, the portal preview and the thumbnails. No React, no DOM, no clock of
 * its own: callers pass "now" in.
 */
import type { SignageData, SignagePerson } from './types';

/** Length assumed for a booking that has no end time. */
export const DEFAULT_BOOKING_MINUTES = 30;
/** A queue starting within this many minutes is shown as "get ready". */
export const SOON_MINUTES = 30;
/** Narrowest day the timeline draws, so a shop with one booking still gets a readable axis. */
const MIN_TIMELINE_HOURS = 4;

const SERVED = new Set(['completed', 'seating']);
const IN_SERVICE = new Set(['called', 'serving', 'in_service']);

/**
 * Minutes since midnight for an `HH:MM` label.
 * @param time Label such as `09:30`; anything else gives `null`.
 * @returns Minutes, or `null` when the label is missing or malformed.
 */
export function toMinutes(time: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time ?? '');
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * `HH:MM` label for minutes since midnight, clamped to one day.
 * @param minutes Minutes since midnight.
 * @returns Zero-padded label.
 */
export function toLabel(minutes: number): string {
  const clamped = Math.min(24 * 60, Math.max(0, Math.round(minutes)));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

/**
 * Minutes since midnight in Asia/Bangkok for a moment in time.
 * The signage runs on TVs set to any timezone, so the device clock is never trusted for this.
 * @param at Moment to convert.
 * @returns Minutes since Bangkok midnight.
 */
export function bangkokMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

/**
 * How long until a queue's appointment, from the booking's own start time.
 * This is the appointment time, not a prediction of when the shop will get to it.
 * @param person Queue to measure.
 * @param nowMinutes Current Bangkok time in minutes.
 * @returns Whole minutes left (0 when the time has come), or `null` without a start time.
 */
export function minutesUntil(person: Pick<SignagePerson, 'start_time'>, nowMinutes: number): number | null {
  const start = toMinutes(person.start_time);
  if (start === null) return null;
  return Math.max(0, start - nowMinutes);
}

export type TimelineState = 'done' | 'now' | 'soon' | 'later';

export type TimelineBlock = { id: string; queue_number: string; customer_name: string | null; start: number; end: number; state: TimelineState };
export type TimelineGap = { start: number; end: number };
export type TimelineRow = { name: string; blocks: TimelineBlock[]; gaps: TimelineGap[] };
export type Timeline = { start: number; end: number; rows: TimelineRow[] };

/**
 * Where a booking stands against the clock.
 * Status wins over time: a queue the staff already completed is done even if its slot is still running.
 */
function timelineState(person: SignagePerson, start: number, end: number, nowMinutes: number): TimelineState {
  if (SERVED.has(person.status) || end <= nowMinutes) return 'done';
  if (IN_SERVICE.has(person.status) || start <= nowMinutes) return 'now';
  return start - nowMinutes <= SOON_MINUTES ? 'soon' : 'later';
}

/**
 * Lay the day's bookings out per service point.
 *
 * Rows are the shop's service points, plus any name that only appears on a booking
 * (a resource renamed or removed after booking). Bookings with no service point
 * are left out, because they have no row to sit on. Gaps are bookable stretches of
 * at least half an hour that have not passed yet.
 *
 * @param data Normalised signage payload.
 * @param nowMinutes Current Bangkok time in minutes.
 * @param maxRows Most rows the template can show.
 * @returns Axis bounds in minutes and one row per service point.
 */
export function buildTimeline(data: Pick<SignageData, 'schedule' | 'resources'>, nowMinutes: number, maxRows: number): Timeline {
  const names = data.resources.map((r) => r.name);
  for (const p of data.schedule) if (p.resource_name && !names.includes(p.resource_name)) names.push(p.resource_name);

  const placed = data.schedule
    .map((p) => {
      const start = toMinutes(p.start_time);
      if (start === null || !p.resource_name) return null;
      const end = Math.max(start + 15, toMinutes(p.end_time) ?? start + DEFAULT_BOOKING_MINUTES);
      return { person: p, start, end };
    })
    .filter((x): x is { person: SignagePerson; start: number; end: number } => x !== null);

  const earliest = placed.length ? Math.min(...placed.map((x) => x.start)) : nowMinutes;
  const latest = placed.length ? Math.max(...placed.map((x) => x.end)) : nowMinutes;
  let start = Math.floor(Math.min(earliest, nowMinutes) / 60) * 60;
  let end = Math.ceil(Math.max(latest, nowMinutes + 60) / 60) * 60;
  if (end - start < MIN_TIMELINE_HOURS * 60) end = start + MIN_TIMELINE_HOURS * 60;
  if (end > 24 * 60) {
    end = 24 * 60;
    start = Math.min(start, end - MIN_TIMELINE_HOURS * 60);
  }

  const rows = names.slice(0, maxRows).map((name) => {
    const own = placed.filter((x) => x.person.resource_name === name).sort((a, b) => a.start - b.start);
    const blocks = own.map((x) => ({
      id: x.person.id,
      queue_number: x.person.queue_number,
      customer_name: x.person.customer_name,
      start: x.start,
      end: Math.min(x.end, end),
      state: timelineState(x.person, x.start, x.end, nowMinutes),
    }));

    const gaps: TimelineGap[] = [];
    // Free time is offered from the next half hour on: nobody can book a slot that has begun.
    let cursor = Math.max(start, Math.ceil(nowMinutes / 30) * 30);
    for (const b of blocks) {
      if (b.start - cursor >= 30) gaps.push({ start: cursor, end: b.start });
      cursor = Math.max(cursor, b.end);
    }
    if (end - cursor >= 30) gaps.push({ start: cursor, end });
    return { name, blocks, gaps };
  });

  return { start, end, rows };
}

export type SceneStation = { name: string; occupant: SignagePerson | null };

/**
 * Service points to draw, each with the queue currently at it.
 *
 * Points that are in use come first so a long list never hides the queue being
 * called. When the shop has set up no service points at all, the ones named on
 * the queues being called are used instead.
 *
 * @param data Normalised signage payload.
 * @param max Most stations the template can show.
 * @returns Stations in display order.
 */
export function buildStations(data: Pick<SignageData, 'now_calling' | 'resources'>, max: number): SceneStation[] {
  const names = data.resources.map((r) => r.name);
  for (const p of data.now_calling) if (p.resource_name && !names.includes(p.resource_name)) names.push(p.resource_name);

  const stations = names.map((name) => ({ name, occupant: data.now_calling.find((p) => p.resource_name === name) ?? null }));
  if (stations.length <= max) return stations;
  const busy = stations.filter((s) => s.occupant);
  const free = stations.filter((s) => !s.occupant);
  return [...busy, ...free].slice(0, max);
}

/**
 * Queues still in line, in calling order.
 * @param data Normalised signage payload.
 * @returns `next_queue` followed by `waiting_queue`.
 */
export function waitingLine(data: Pick<SignageData, 'next_queue' | 'waiting_queue'>): SignagePerson[] {
  return [...data.next_queue, ...data.waiting_queue];
}

/**
 * True when the shop has nobody being called and nobody waiting: the moment the
 * invite template turns into a shop-front poster.
 * @param data Normalised signage payload.
 * @returns Whether the board is idle.
 */
export function isIdle(data: Pick<SignageData, 'now_calling' | 'totals'>): boolean {
  return data.now_calling.length === 0 && data.totals.waiting === 0;
}

export type SceneDiff = { entered: string[]; left: string[]; called: string[] };

/**
 * What changed between two polls, by booking id.
 *
 * The feed only says who is where now, so movement has to be read from the
 * difference: an id that is new to the board entered, one that is gone left, and
 * one that moved from the line into `now_calling` was called.
 *
 * @param previous Payload of the poll before, or `null` on the first one.
 * @param current Payload of this poll.
 * @returns Ids per kind of change; all empty on the first poll.
 */
export function diffScene(
  previous: Pick<SignageData, 'now_calling' | 'next_queue' | 'waiting_queue'> | null,
  current: Pick<SignageData, 'now_calling' | 'next_queue' | 'waiting_queue'>,
): SceneDiff {
  if (!previous) return { entered: [], left: [], called: [] };
  const ids = (d: typeof current) => new Set([...d.now_calling, ...d.next_queue, ...d.waiting_queue].map((p) => p.id));
  const before = ids(previous);
  const after = ids(current);
  const wasCalling = new Set(previous.now_calling.map((p) => p.id));
  return {
    entered: [...after].filter((id) => !before.has(id)),
    left: [...before].filter((id) => !after.has(id)),
    called: current.now_calling.map((p) => p.id).filter((id) => !wasCalling.has(id)),
  };
}
