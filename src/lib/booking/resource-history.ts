/**
 * "Which court did I book last time?" — derived from the customer's own booking
 * history so the LIFF picker can flag and surface familiar resources.
 *
 * Purely client-side data (`/me` already returns the last 50 bookings with
 * `resource_id`), so there is no favourites table and nothing to keep in sync.
 */

export type ResourceHistoryBooking = {
  resource_id?: string | null;
  booking_date: string;
  start_time?: string | null;
  status: string;
};

export type ResourceHistoryEntry = {
  /** Bookings that were not cancelled / no-show. */
  count: number;
  /** `YYYY-MM-DD HH:MM` style sort key of the most recent one. */
  lastKey: string;
};

export type ResourceHistory = {
  byResource: Map<string, ResourceHistoryEntry>;
  /** Resource of the single most recent booking, if any. */
  latestResourceId: string | null;
};

/** A cancelled or missed booking says nothing about which resource the customer likes. */
const IGNORED_STATUSES: ReadonlySet<string> = new Set(['cancelled', 'no_show', 'skipped']);

/** Count bookings per resource and remember the most recent one. */
export function summarizeResourceHistory(bookings: ReadonlyArray<ResourceHistoryBooking>): ResourceHistory {
  const byResource = new Map<string, ResourceHistoryEntry>();
  let latestResourceId: string | null = null;
  let latestKey = '';

  for (const b of bookings) {
    if (!b.resource_id || IGNORED_STATUSES.has(b.status)) continue;
    const key = `${b.booking_date} ${b.start_time ?? ''}`;
    const entry = byResource.get(b.resource_id);
    if (entry) {
      entry.count += 1;
      if (key > entry.lastKey) entry.lastKey = key;
    } else {
      byResource.set(b.resource_id, { count: 1, lastKey: key });
    }
    if (key > latestKey) {
      latestKey = key;
      latestResourceId = b.resource_id;
    }
  }

  return { byResource, latestResourceId };
}

/**
 * Familiar resources first (most recently booked on top), everything else in
 * its original order. Stable, and never drops or selects anything.
 */
export function sortResourcesByHistory<T extends { id: string }>(resources: ReadonlyArray<T>, history: ResourceHistory): T[] {
  return resources
    .map((resource, index) => ({ resource, index, lastKey: history.byResource.get(resource.id)?.lastKey ?? '' }))
    .sort((a, b) => {
      if (a.lastKey !== b.lastKey) return a.lastKey > b.lastKey ? -1 : 1;
      return a.index - b.index;
    })
    .map((x) => x.resource);
}

/** Short Thai badge for a resource card, or `undefined` when the customer never booked it. */
export function resourceHistoryBadge(resourceId: string, history: ResourceHistory): string | undefined {
  const entry = history.byResource.get(resourceId);
  if (!entry) return undefined;
  if (history.latestResourceId === resourceId) {
    return entry.count > 1 ? `จองล่าสุด • เคยจอง ${entry.count} ครั้ง` : 'จองล่าสุด';
  }
  return `เคยจอง ${entry.count} ครั้ง`;
}
