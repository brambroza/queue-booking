/**
 * Sample data for the marketing screenshots.
 *
 * The demo shop has no bookings, so the capture script answers the read
 * endpoints with this data instead. The pages that render it are the real
 * product pages; only the numbers and names are samples. Every name and phone
 * number here is fictional. Nothing is written to the database.
 */

export type ShopCatalog = {
  branches: Array<{ id: string; branch_name: string }>;
  services: Array<{ id: string; service_name: string; price?: number | null }>;
  resources: Array<{ id: string; resource_name: string }>;
};

type SampleCustomer = { full_name: string; nickname: string; phone: string };

type SampleSlot = { time: string; status: string };

export type SampleBooking = {
  id: string;
  queue_number: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  payment_amount: number | null;
  resource_id: string | null;
  resource_name: string | null;
  note: string | null;
  service_id: string | null;
  branch_id: string | null;
  line_user_id: string | null;
  change_notified_at: string | null;
  change_acknowledged_at: string | null;
  checked_in_at: string | null;
  called_at: string | null;
  call_count: number | null;
  created_at: string;
  branches: { branch_name: string } | null;
  services: { service_name: string } | null;
  customers: SampleCustomer | null;
};

const CUSTOMERS: SampleCustomer[] = [
  { full_name: 'มะลิ ใจดี', nickname: 'มะลิ', phone: '0800000001' },
  { full_name: 'ธนากร สุขสวัสดิ์', nickname: 'ต้น', phone: '0800000002' },
  { full_name: 'พิมพ์ชนก แก้วใส', nickname: 'พิม', phone: '0800000003' },
  { full_name: 'ณัฐวุฒิ ทองดี', nickname: 'นัท', phone: '0800000004' },
  { full_name: 'ศิริพร บุญมา', nickname: 'ฝน', phone: '0800000005' },
  { full_name: 'กิตติพงษ์ รุ่งเรือง', nickname: 'บอส', phone: '0800000006' },
  { full_name: 'อารียา ศรีสุข', nickname: 'มายด์', phone: '0800000007' },
  { full_name: 'วรเมธ จันทร์เพ็ญ', nickname: 'เมธ', phone: '0800000008' },
  { full_name: 'ชนิดา พรหมมา', nickname: 'แพร', phone: '0800000009' },
  { full_name: 'ภาณุพงศ์ อินทร์แก้ว', nickname: 'ภูมิ', phone: '0800000010' },
  { full_name: 'สุภาวดี มีสุข', nickname: 'ออม', phone: '0800000011' },
  { full_name: 'ปกรณ์ วงศ์ใหญ่', nickname: 'กร', phone: '0800000012' },
];

/** One working day, in booking-flow order from the morning (done) to the evening (upcoming). */
const DAY_PLAN: SampleSlot[] = [
  { time: '09:00', status: 'completed' },
  { time: '09:30', status: 'completed' },
  { time: '10:00', status: 'completed' },
  { time: '10:00', status: 'completed' },
  { time: '10:30', status: 'no_show' },
  { time: '10:30', status: 'completed' },
  { time: '11:00', status: 'completed' },
  { time: '11:30', status: 'cancelled' },
  { time: '11:30', status: 'serving' },
  { time: '12:00', status: 'serving' },
  { time: '13:00', status: 'called' },
  { time: '13:30', status: 'checked_in' },
  { time: '14:00', status: 'waiting' },
  { time: '14:30', status: 'waiting' },
  { time: '15:00', status: 'confirmed' },
  { time: '16:00', status: 'confirmed' },
  { time: '16:30', status: 'confirmed' },
  { time: '17:00', status: 'pending_approval' },
];

const NOT_OCCUPYING = new Set(['cancelled', 'no_show']);
const STATUS_ORDER = ['pending', 'pending_approval', 'confirmed', 'checked_in', 'waiting', 'called', 'serving', 'completed', 'cancelled', 'no_show'];
/** Sample capacity per open hour, so the utilisation chart reads as a normal day. */
const HOURLY_CAPACITY = 3;

/**
 * Today's date in Asia/Bangkok as YYYY-MM-DD.
 * @returns ISO date string.
 */
export function bangkokToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
}

/**
 * Add days to an ISO date using UTC arithmetic.
 * @param iso Date as YYYY-MM-DD.
 * @param days Days to add, may be negative.
 * @returns Shifted ISO date.
 */
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Pick an item by index, wrapping around; `null` for an empty list.
 * @param list Source list.
 * @param index Any non-negative index.
 * @returns The item or null.
 */
function pick<T>(list: T[], index: number): T | null {
  return list.length > 0 ? list[index % list.length] : null;
}

/**
 * `HH:MM` plus 30 minutes, as a Postgres `time` string.
 * @param time Start time as HH:MM.
 * @returns End time as HH:MM:SS.
 */
function endOf(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + 30;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}:00`;
}

/**
 * Build the sample bookings of one date from the shop's own branches, services and resources.
 * @param catalog Real catalog of the demo shop.
 * @param date Booking date as YYYY-MM-DD.
 * @param plan Slots to fill; defaults to the full day plan.
 * @returns Booking rows in the shape `/api/bookings` returns.
 */
export function sampleBookings(catalog: ShopCatalog, date: string, plan: SampleSlot[] = DAY_PLAN): SampleBooking[] {
  const branch = pick(catalog.branches, 0);
  return plan.map((slot, i) => {
    const service = pick(catalog.services, i);
    const resource = pick(catalog.resources, i);
    const customer = CUSTOMERS[i % CUSTOMERS.length];
    const stamp = `${date}T${slot.time}:00+07:00`;
    const arrived = ['checked_in', 'waiting', 'called', 'serving', 'completed'].includes(slot.status);
    const wasCalled = ['called', 'serving', 'completed'].includes(slot.status);
    // A free service (table booking) carries no payment at all.
    const price = Number(service?.price ?? 0);
    return {
      id: `sample-${date}-${String(i + 1).padStart(2, '0')}`,
      queue_number: `A${String(i + 1).padStart(3, '0')}`,
      booking_date: date,
      start_time: `${slot.time}:00`,
      end_time: endOf(slot.time),
      status: slot.status,
      payment_status: price > 0 ? (slot.status === 'pending_approval' ? 'pending_payment' : 'paid') : null,
      payment_method: price > 0 ? 'omise_promptpay' : null,
      payment_amount: price > 0 ? price : null,
      resource_id: resource?.id ?? null,
      resource_name: resource?.resource_name ?? null,
      note: null,
      service_id: service?.id ?? null,
      branch_id: branch?.id ?? null,
      line_user_id: `sample-line-user-${i + 1}`,
      change_notified_at: null,
      change_acknowledged_at: null,
      checked_in_at: arrived ? stamp : null,
      called_at: wasCalled ? stamp : null,
      call_count: wasCalled ? 1 : 0,
      created_at: new Date(Date.parse(`${addDays(date, -1)}T09:00:00+07:00`) + i * 23 * 60_000).toISOString(),
      branches: branch ? { branch_name: branch.branch_name } : null,
      services: service ? { service_name: service.service_name } : null,
      customers: customer,
    };
  });
}

/**
 * Bookings for a date range: the full plan today, a lighter deterministic load on other days.
 * @param catalog Real catalog of the demo shop.
 * @param from First date, inclusive.
 * @param to Last date, inclusive.
 * @param today Today's date, which gets the full plan.
 * @returns Booking rows ordered by date and time.
 */
export function sampleBookingsInRange(catalog: ShopCatalog, from: string, to: string, today: string): SampleBooking[] {
  const rows: SampleBooking[] = [];
  for (let date = from, guard = 0; date <= to && guard < 62; date = addDays(date, 1), guard += 1) {
    if (date === today) {
      rows.push(...sampleBookings(catalog, date));
      continue;
    }
    const day = Number(date.slice(8, 10));
    const size = 3 + (day % 4);
    const plan = DAY_PLAN.filter((_, i) => i % 3 === day % 3)
      .slice(0, size)
      .map((slot) => ({ time: slot.time, status: date < today ? 'completed' : 'confirmed' }));
    rows.push(...sampleBookings(catalog, date, plan));
  }
  return rows;
}

/**
 * Overlay sample numbers on a real `/api/dashboard` response, keeping its shape.
 * Only the default "today" range is replaced.
 * @param real Parsed body of the real response.
 * @param catalog Real catalog of the demo shop.
 * @returns Body to serve.
 */
export function overlayDashboard(real: unknown, catalog: ShopCatalog): unknown {
  const body = real as { data?: Record<string, unknown> };
  const data = body.data as
    | {
        range?: { kind?: string; today?: string };
        by_hour?: Array<{ hour: number }>;
        heatmap?: { hours?: number[]; rows?: Array<{ key: string; cells: unknown[] }> };
        recent_bookings?: { page?: number; limit?: number };
        branch_summary?: Array<{ name: string }>;
      }
    | undefined;
  if (!data || data.range?.kind !== 'today') return real;

  const today = data.range.today ?? bangkokToday();
  const rows = sampleBookings(catalog, today);
  const occupying = rows.filter((r) => !NOT_OCCUPYING.has(r.status));
  const count = (...statuses: string[]) => rows.filter((r) => statuses.includes(r.status)).length;

  const realHours = data.heatmap?.hours?.length ? data.heatmap.hours : (data.by_hour ?? []).map((c) => c.hour);
  const hours = realHours.length > 0 ? realHours : [9, 10, 11, 12, 13, 14, 15, 16, 17];
  const byHour = hours.map((hour) => ({
    hour,
    count: occupying.filter((r) => Number(r.start_time.slice(0, 2)) === hour).length,
    capacity: HOURLY_CAPACITY,
  }));
  const capacity = byHour.length * HOURLY_CAPACITY;
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  const serviceCounts = new Map<string, number>();
  for (const r of rows) {
    const name = r.services?.service_name;
    if (name) serviceCounts.set(name, (serviceCounts.get(name) ?? 0) + 1);
  }

  const limit = data.recent_bookings?.limit ?? 10;
  const recent = [...rows]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      queue_number: r.queue_number,
      booking_date: r.booking_date,
      start_time: r.start_time.slice(0, 5),
      status: r.status,
      customer_name: r.customers ? `${r.customers.nickname} (${r.customers.full_name})` : '-',
      service_name: r.services?.service_name ?? '-',
      branch_name: r.branches?.branch_name ?? '-',
      created_at: r.created_at,
    }));

  return {
    ...body,
    data: {
      ...data,
      kpi: {
        total: rows.length,
        booked: occupying.length,
        completed: count('completed'),
        cancelled: count('cancelled'),
        no_show: count('no_show'),
        serving: count('serving'),
        waiting: count('waiting', 'called', 'checked_in'),
        capacity,
        utilization_pct: pct(occupying.length, capacity),
        customers_new: 5,
        customers_returning: 7,
        prev: { total: 15, booked: 14, completed: 12, cancelled: 1, no_show: 0, utilization_pct: pct(14, capacity) },
      },
      by_day: [{ date: today, count: occupying.length, capacity, is_holiday: false }],
      by_hour: byHour,
      heatmap: { mode: 'date', hours, rows: [{ key: today, cells: byHour }] },
      by_status: STATUS_ORDER.map((status) => ({ status, count: count(status) })).filter((s) => s.count > 0),
      recent_bookings: { rows: recent, total: rows.length, page: data.recent_bookings?.page ?? 1, limit },
      popular_services: [...serviceCounts.entries()]
        .map(([name, n]) => ({ name, count: n, pct: pct(n, rows.length) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      branch_summary: (data.branch_summary ?? []).map((b, i) => ({
        name: b.name,
        count: i === 0 ? occupying.length : 0,
        pct: i === 0 ? pct(occupying.length, capacity) : 0,
      })),
    },
  };
}

/**
 * Overlay sample queues on a real signage feed, keeping the shop's own config.
 * @param real Parsed body of the real `/display` response.
 * @param catalog Catalog the sample rows are built from.
 * @param sample Shop name and theme to show; the real ones when omitted.
 * @returns Body to serve.
 */
export function overlaySignage(real: unknown, catalog: ShopCatalog, sample?: { shopName: string; signageTheme: string }): unknown {
  const body = real as { data?: { enabled?: boolean; config?: Record<string, unknown>; signage?: Record<string, unknown> } };
  if (!body.data?.enabled || !body.data.signage) return real;

  const rows = sampleBookings(catalog, bangkokToday());
  const person = (r: SampleBooking, named: boolean) => ({
    id: r.id,
    queue_number: r.queue_number,
    status: r.status,
    start_time: r.start_time.slice(0, 5),
    called_at: r.called_at,
    customer_name: named ? (r.customers?.nickname ?? null) : null,
    service_name: r.services?.service_name ?? null,
    resource_name: r.resource_name,
  });
  const calling = rows.filter((r) => r.status === 'called' || r.status === 'serving').reverse();
  const upcoming = rows.filter((r) => ['checked_in', 'waiting', 'confirmed'].includes(r.status));

  return {
    ...body,
    data: {
      ...body.data,
      ...(sample ? { config: { ...body.data.config, theme: sample.signageTheme } } : {}),
      signage: {
        ...body.data.signage,
        ...(sample
          ? { shop: { ...((body.data.signage.shop as object | undefined) ?? {}), name: sample.shopName, logo_url: null }, branch: null }
          : {}),
        now_calling: calling.map((r) => person(r, true)),
        next_queue: upcoming.slice(0, 3).map((r) => person(r, true)),
        waiting_queue: upcoming.slice(3).map((r) => person(r, false)),
        totals: {
          waiting: upcoming.length,
          calling: calling.length,
          served_today: rows.filter((r) => r.status === 'completed').length,
        },
      },
    },
  };
}

/**
 * Overlay sample numbers on a real `/api/reports` response, keeping its shape.
 * Ranges that include today get the full day plan; other days a lighter load.
 * @param real Parsed body of the real response.
 * @param catalog Catalog the sample rows are built from.
 * @param shopName Shop name for the report header; the real one when omitted.
 * @returns Body to serve.
 */
export function overlayReport(real: unknown, catalog: ShopCatalog, shopName?: string): unknown {
  const body = real as { data?: { range?: { from?: string; to?: string; today?: string }; prev?: unknown } };
  const range = body.data?.range;
  if (!body.data || !range?.from || !range.to) return real;

  const today = range.today ?? bangkokToday();
  const rows = sampleBookingsInRange(catalog, range.from, range.to, today);
  const count = (list: SampleBooking[], ...statuses: string[]) => list.filter((r) => statuses.includes(r.status)).length;
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
  const tally = (key: (r: SampleBooking) => string | null | undefined) => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const name = key(r);
      if (name) map.set(name, (map.get(name) ?? 0) + 1);
    }
    return [...map.entries()].map(([name, n]) => ({ name, count: n, pct: pct(n, rows.length) })).sort((a, b) => b.count - a.count);
  };
  const dates = [...new Set(rows.map((r) => r.booking_date))];
  const hours = [...new Set(rows.map((r) => Number(r.start_time.slice(0, 2))))].sort((a, b) => a - b);
  const staff = [...new Set(rows.map((r) => r.resource_name).filter((n): n is string => Boolean(n)))];
  const cancelled = count(rows, 'cancelled');
  const noShow = count(rows, 'no_show');

  return {
    ...body,
    data: {
      ...body.data,
      ...(shopName ? { shop: { ...((body.data as { shop?: object }).shop ?? {}), name: shopName } } : {}),
      kpi: {
        total: rows.length,
        booked: rows.length - cancelled - noShow,
        completed: count(rows, 'completed'),
        cancelled,
        no_show: noShow,
        cancel_rate: pct(cancelled + noShow, rows.length),
        customers_new: Math.round(Math.min(CUSTOMERS.length, rows.length) * 0.4),
        customers_returning: Math.min(CUSTOMERS.length, rows.length) - Math.round(Math.min(CUSTOMERS.length, rows.length) * 0.4),
      },
      prev: body.data.prev
        ? { ...(body.data.prev as object), total: Math.round(rows.length * 0.85), completed: Math.round(rows.length * 0.6), cancelled: 1, no_show: 0 }
        : null,
      by_day: dates.map((date) => {
        const day = rows.filter((r) => r.booking_date === date);
        return { date, count: day.length, completed: count(day, 'completed'), cancelled: count(day, 'cancelled'), no_show: count(day, 'no_show') };
      }),
      by_hour: hours.map((hour) => ({ hour, count: rows.filter((r) => Number(r.start_time.slice(0, 2)) === hour).length })),
      by_status: STATUS_ORDER.map((status) => ({ status, count: count(rows, status) })).filter((x) => x.count > 0),
      popular_services: tally((r) => r.services?.service_name),
      by_branch: tally((r) => r.branches?.branch_name),
      by_staff: staff.map((name) => {
        const own = rows.filter((r) => r.resource_name === name);
        return { name, count: own.length, completed: count(own, 'completed'), cancelled: count(own, 'cancelled'), no_show: count(own, 'no_show') };
      }),
      bookings: {
        rows: rows.map((r) => ({
          id: r.id,
          queue_number: r.queue_number,
          booking_date: r.booking_date,
          start_time: r.start_time.slice(0, 5),
          end_time: r.end_time.slice(0, 5),
          status: r.status,
          customer_name: r.customers ? `${r.customers.nickname} (${r.customers.full_name})` : '-',
          customer_phone: r.customers?.phone ?? '',
          service_name: r.services?.service_name ?? '-',
          branch_name: r.branches?.branch_name ?? '-',
          resource_name: r.resource_name ?? '',
          note: r.note ?? '',
        })),
        total: rows.length,
        truncated: false,
      },
    },
  };
}

/**
 * Body served in place of `POST /me`, which would otherwise upsert a LINE user.
 * The queue is today's on the account page (so check-in shows) and tomorrow's on
 * the booking page, where a same-day queue would trip the one-per-day warning.
 * @param catalog Real catalog of the demo shop.
 * @param queueToday Whether the upcoming queue falls on today.
 * @returns The `/me` response body.
 */
export function meFixture(catalog: ShopCatalog, queueToday: boolean): unknown {
  const today = bangkokToday();
  const [first] = sampleBookings(catalog, queueToday ? today : addDays(today, 1), [{ time: '14:30', status: 'confirmed' }]);
  const past = sampleBookings(catalog, addDays(today, -7), [{ time: '10:00', status: 'completed' }])[0];
  const me = CUSTOMERS[0];
  return {
    data: {
      customer: { id: 'sample-customer', full_name: me.full_name, phone: me.phone, nickname: me.nickname },
      was_registered: false,
      today,
      upcoming: [{ ...first, queue_number: 'A007' }],
      history: [{ ...past, queue_number: 'A003' }],
    },
  };
}
