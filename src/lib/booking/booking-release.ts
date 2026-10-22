/**
 * "เปิดให้จองเวลา" — the moment a branch starts taking bookings
 * (`branches.booking_release_at`, migration 202610220001), e.g. a shop that
 * announces "เปิดจอง 19:00". Different from `booking_open_from`, which bounds
 * the date being booked; this one gates *when* booking is possible at all.
 *
 * Before it, LIFF shows a countdown and calls nothing, and /slots + /book
 * refuse with `not_released`, so a crowd waiting on the page costs no database
 * work. When it passes, each phone waits a random 0–RELEASE_JITTER_MS before
 * loading slots so the crowd is spread over a few seconds instead of one.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const NOT_RELEASED_CODE = 'not_released';

/** Spread of the first slot load after release, per phone. */
export const RELEASE_JITTER_MS = 5000;

/**
 * Whether booking is open at `now`. Null / unparsable release = always open.
 *
 * @param releaseAt - ISO timestamp from the database, or null.
 * @param now - Epoch ms (server clock, or the client clock corrected by the server offset).
 */
export function isReleased(releaseAt: string | null | undefined, now: number): boolean {
  const at = releaseAtMs(releaseAt);
  return at === null || now >= at;
}

/** Epoch ms of a release timestamp, or null when unset / invalid. */
export function releaseAtMs(releaseAt: string | null | undefined): number | null {
  if (!releaseAt) return null;
  const ms = Date.parse(releaseAt);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Countdown parts until release; all zero once released.
 *
 * @param releaseAt - ISO timestamp.
 * @param now - Epoch ms.
 */
export function releaseCountdown(releaseAt: string | null | undefined, now: number) {
  const at = releaseAtMs(releaseAt);
  const remainingMs = at === null ? 0 : Math.max(0, at - now);
  const totalSeconds = Math.ceil(remainingMs / 1000);
  return {
    remainingMs,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

/**
 * Random delay before a phone's first slot load after release.
 *
 * @param random - Injected for tests; defaults to Math.random.
 */
export function releaseJitterMs(random: () => number = Math.random): number {
  return Math.floor(random() * RELEASE_JITTER_MS);
}

/**
 * Thai message for a refused early request, e.g. "เปิดให้จองวันที่ 25 ต.ค. 2569 เวลา 19:00 น.".
 *
 * @param releaseAt - ISO timestamp.
 */
export function notReleasedMessage(releaseAt: string): string {
  const at = new Date(releaseAt);
  const date = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' }).format(at);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }).format(at);
  return `ยังไม่เปิดให้จอง เปิดให้จองวันที่ ${date} เวลา ${time} น.`;
}

/**
 * `datetime-local` value (Bangkok wall clock, "YYYY-MM-DDTHH:mm") → ISO with
 * +07:00, so the portal user's own device timezone never shifts the release.
 * Returns null for '' / null; undefined for an invalid value.
 */
export function bangkokLocalToIso(value: string | null | undefined): string | null | undefined {
  const v = (value ?? '').trim();
  if (!v) return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/.exec(v);
  if (m) return `${m[1]}T${m[2]}:00+07:00`;
  // Already an ISO timestamp with an offset (e.g. re-saved untouched).
  return Number.isNaN(Date.parse(v)) || !/[zZ]|[+-]\d{2}:?\d{2}$/.test(v) ? undefined : new Date(v).toISOString();
}

/** ISO timestamp → `datetime-local` value in Bangkok wall clock; '' when unset. */
export function isoToBangkokLocal(value: string | null | undefined): string {
  const ms = releaseAtMs(value);
  if (ms === null) return '';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

/**
 * `booking_release_at` of every branch of a shop, keyed by branch id. Read apart
 * from other branch selects and empty on error, so the booking flow keeps
 * working on a database where migration 202610220001 has not run.
 *
 * @param client - Supabase client allowed to read this shop.
 * @param shopId - Shop whose branches to read.
 */
export async function getShopReleaseTimes(client: SupabaseClient, shopId: string): Promise<Record<string, string | null>> {
  const { data, error } = await client
    .from('branches')
    .select('id,booking_release_at')
    .eq('shop_id', shopId)
    .eq('is_deleted', false);
  if (error || !data) return {};
  return Object.fromEntries((data as Array<{ id: string; booking_release_at: string | null }>).map((r) => [r.id, r.booking_release_at]));
}

/** Bangkok date `YYYY-MM-DD` of a timestamp; '' when unset. */
export function isoToBangkokLocalDate(value: string | null | undefined): string {
  return isoToBangkokLocal(value).slice(0, 10);
}

/** Bangkok `HH:mm` of a timestamp; '' when unset. */
export function bangkokTimeOf(value: string | null | undefined): string {
  return isoToBangkokLocal(value).slice(11, 16);
}
