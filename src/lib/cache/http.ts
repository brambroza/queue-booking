/**
 * Cache-Control for public LIFF reads, so the Vercel CDN answers repeated
 * refreshes itself instead of invoking the function (and Supabase) each time.
 * `s-maxage` applies to the CDN only; browsers still revalidate.
 *
 * Only for responses with no per-customer data and keyed fully by the URL.
 */
export const PUBLIC_CACHE_HEADERS = {
  /** Shop, branches, services, resources, payment methods. */
  meta: { 'Cache-Control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=60' },
  /** Open weekdays + holidays of a branch. */
  bookableDays: { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=120' },
  /** Slot grid of one day; short because every booking changes it (/book re-checks anyway). */
  slots: { 'Cache-Control': 'public, max-age=0, s-maxage=3, stale-while-revalidate=5' },
} as const;
