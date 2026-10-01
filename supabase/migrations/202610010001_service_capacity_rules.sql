-- Slot capacity that differs by time of day (e.g. 2 queues per slot in the
-- morning, 3 in the afternoon).
--
-- `services.capacity_per_slot` stays the setting and still applies to every
-- slot by default (decided 2026-09-29, migration 202609290001). This adds an
-- optional overlay on top of it: `service_capacity_rules` rows, each covering
-- a time range of the day for one service, optionally narrowed to a branch
-- and/or a weekday. A shop with no rules behaves exactly as before.
--
-- One resolver, `resolve_slot_capacity`, returns the capacity for a given
-- slot and is the only place the precedence lives. The two slot RPCs and the
-- insert trigger all call it, so the LIFF grid, the LINE chatbot, the portal
-- drawer and the guard that refuses a full slot always agree. Precedence when
-- several rules cover the same slot:
--
--   1. branch set + weekday set
--   2. branch set + every weekday
--   3. every branch + weekday set
--   4. every branch + every weekday
--   5. services.capacity_per_slot
--
-- Within one tier ranges must not overlap; the portal API refuses such a save.
-- Should overlapping rows still appear, the resolver orders by time_from and
-- takes the first, so it stays deterministic. `time_to` is exclusive: a rule
-- 13:00–18:00 covers the 17:30 slot and not the 18:00 one.
--
-- The three function bodies below are copied from their latest definitions
-- (202609150002 for get_slot_availability, 202605160001 for
-- get_available_slots, 202609290001 for enforce_slot_capacity) with only the
-- capacity lookup changed. supabase/functions.sql is an outdated mirror and
-- not what runs on the database; the migrations are.
--
-- Run BEFORE deploying the matching app version. The app reads the resolver
-- through a helper that falls back to services.capacity_per_slot when the
-- function does not exist yet, and the rule editor in the portal fails until
-- the table exists. Existing bookings are not touched; rules apply to new
-- inserts and moves only.

-- ── 1. Rules ────────────────────────────────────────────────────────────────

create table if not exists public.service_capacity_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  service_id uuid not null references public.services(id),
  -- NULL = every branch of the shop.
  branch_id uuid references public.branches(id),
  -- 0 = Sunday … 6 = Saturday (extract(dow)). NULL = every weekday.
  weekday int check (weekday between 0 and 6),
  time_from time not null,
  -- Exclusive upper bound: a slot matches when time_from <= slot < time_to.
  time_to time not null,
  capacity int not null check (capacity >= 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false,
  constraint service_capacity_rules_range_check check (time_from < time_to)
);

comment on table public.service_capacity_rules is
  'Optional per-time-range override of services.capacity_per_slot. No rows = the service value applies all day.';
comment on column public.service_capacity_rules.time_to is
  'Exclusive. A slot matches when time_from <= slot_time < time_to.';

create index if not exists idx_service_capacity_rules_lookup
  on public.service_capacity_rules(shop_id, service_id)
  where is_deleted = false and active = true;

alter table public.service_capacity_rules enable row level security;

-- Portal access goes through the API (shop-scoped, role-checked); the slot
-- RPCs and the trigger run as security definer and read it directly.
drop policy if exists service_capacity_rules_shop_read on public.service_capacity_rules;
create policy service_capacity_rules_shop_read on public.service_capacity_rules
for select to authenticated
using (
  exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.shop_id = service_capacity_rules.shop_id
  )
);

drop policy if exists service_capacity_rules_shop_write on public.service_capacity_rules;
create policy service_capacity_rules_shop_write on public.service_capacity_rules
for all to authenticated
using (
  exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.shop_id = service_capacity_rules.shop_id
  )
)
with check (
  exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.shop_id = service_capacity_rules.shop_id
  )
);

comment on column public.services.capacity_per_slot is
  'Default queues this service accepts at the same start time, per branch. Overridden per time range by service_capacity_rules.';

-- ── 2. Resolver ─────────────────────────────────────────────────────────────

create or replace function public.resolve_slot_capacity(
  p_shop_id uuid,
  p_service_id uuid,
  p_branch_id uuid,
  p_date date,
  p_slot_time time
)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select r.capacity
      from public.service_capacity_rules r
      where r.shop_id = p_shop_id
        and r.service_id = p_service_id
        and r.active = true
        and r.is_deleted = false
        and (r.branch_id is null or r.branch_id = p_branch_id)
        and (r.weekday is null or r.weekday = extract(dow from p_date)::int)
        and p_slot_time >= r.time_from
        and p_slot_time < r.time_to
      order by (r.branch_id is not null) desc, (r.weekday is not null) desc, r.time_from
      limit 1
    ),
    (
      select s.capacity_per_slot
      from public.services s
      where s.id = p_service_id
        and s.shop_id = p_shop_id
    )
  );
$$;

comment on function public.resolve_slot_capacity(uuid, uuid, uuid, date, time) is
  'Capacity of one slot: the most specific active service_capacity_rules row covering it, else services.capacity_per_slot. NULL when the service is unknown.';

-- ── 3. get_slot_availability (LIFF grid, full slots included) ───────────────

create or replace function public.get_slot_availability(
  p_shop_id uuid,
  p_branch_id uuid,
  p_service_id uuid,
  p_date date,
  p_resource_type text default null,
  p_party_size int default null,
  p_resource_id uuid default null
)
returns table(slot_time time, capacity int, booked_count int, remaining_capacity int)
language plpgsql
as $$
declare
  v_weekday int;
  v_open time;
  v_close time;
  v_break_start time;
  v_break_end time;
  v_interval int;
  v_capacity int;
  v_service_duration int;
  v_current_ts timestamp;
  v_close_ts timestamp;
  v_slot_time time;
  v_booked int;
  v_available int;
  v_resource_total int;
  v_start_ts timestamptz;
  v_end_ts timestamptz;
begin
  if exists(
    select 1 from public.holidays h
    where h.shop_id = p_shop_id
      and (h.branch_id is null or h.branch_id = p_branch_id)
      and h.holiday_date = p_date
      and h.is_deleted = false
  ) then
    return;
  end if;

  v_weekday := extract(dow from p_date);

  select wh.open_time, wh.close_time, wh.break_start, wh.break_end, wh.slot_interval_minutes, wh.capacity_per_slot
  into v_open, v_close, v_break_start, v_break_end, v_interval, v_capacity
  from public.working_hours wh
  where wh.shop_id = p_shop_id
    and wh.weekday = v_weekday
    and wh.active = true
    and wh.is_deleted = false
    and (wh.branch_id = p_branch_id or wh.branch_id is null)
  order by case when wh.branch_id = p_branch_id then 0 else 1 end
  limit 1;

  if v_open is null then
    return;
  end if;

  select coalesce(s.duration_minutes, v_interval), coalesce(s.capacity_per_slot, v_capacity)
  into v_service_duration, v_capacity
  from public.services s
  where s.id = p_service_id
    and s.shop_id = p_shop_id
    and s.active = true
    and s.is_deleted = false
  limit 1;

  -- Total resources of the requested type; computed once, the per-slot loop
  -- only needs how many of them are free.
  if p_resource_id is null and p_resource_type is not null then
    select count(*) into v_resource_total
    from public.booking_resources r
    where r.shop_id = p_shop_id
      and (p_branch_id is null or r.branch_id = p_branch_id)
      and r.resource_type = coalesce(p_resource_type, 'table')
      and r.active = true
      and r.is_deleted = false
      and r.capacity >= greatest(coalesce(p_party_size, 1), 1);
  end if;

  v_current_ts := p_date::timestamp + v_open;
  v_close_ts := p_date::timestamp + v_close;

  while v_current_ts + make_interval(mins => coalesce(v_service_duration, v_interval)) <= v_close_ts loop
    v_slot_time := v_current_ts::time;

    if v_break_start is not null and v_break_end is not null and v_slot_time >= v_break_start and v_slot_time < v_break_end then
      v_current_ts := v_current_ts + make_interval(mins => v_interval);
      continue;
    end if;

    if p_resource_type is null and p_resource_id is null then
      select count(*) into v_booked
      from public.bookings b
      where b.shop_id = p_shop_id
        and b.branch_id = p_branch_id
        and b.service_id = p_service_id
        and b.booking_date = p_date
        and b.start_time = v_slot_time
        and b.status not in ('cancelled','no_show')
        and b.is_deleted = false;

      slot_time := v_slot_time;
      -- Per-slot capacity: a time-range rule if one covers this slot, else the
      -- service default read above.
      capacity := coalesce(
        public.resolve_slot_capacity(p_shop_id, p_service_id, p_branch_id, p_date, v_slot_time),
        v_capacity,
        0
      );
      booked_count := v_booked;
      remaining_capacity := greatest(capacity - v_booked, 0);
      return next;
    else
      v_start_ts := (p_date::text || ' ' || v_slot_time::text || '+07')::timestamptz;
      v_end_ts := v_start_ts + make_interval(mins => coalesce(v_service_duration, v_interval));
      if v_end_ts <= v_start_ts then
        v_end_ts := v_start_ts + interval '1 minute';
      end if;

      if p_resource_id is not null then
        select count(*) into v_booked
        from public.bookings b
        cross join lateral (
          select
            (b.booking_date::text || ' ' || b.start_time::text || '+07')::timestamptz as b_start_ts,
            (b.booking_date::text || ' ' || coalesce(b.end_time, b.start_time + interval '30 minutes')::text || '+07')::timestamptz as b_end_raw_ts
        ) t
        where b.shop_id = p_shop_id
          and b.branch_id = p_branch_id
          and b.resource_id = p_resource_id
          and b.status not in ('cancelled','no_show','skipped','completed')
          and b.is_deleted = false
          and tstzrange(
            t.b_start_ts,
            case when t.b_end_raw_ts > t.b_start_ts then t.b_end_raw_ts else t.b_start_ts + interval '1 minute' end,
            '[)'
          ) && tstzrange(v_start_ts, v_end_ts, '[)');

        slot_time := v_slot_time;
        capacity := 1;
        booked_count := case when v_booked > 0 then 1 else 0 end;
        remaining_capacity := 1 - booked_count;
        return next;
      else
        select count(*) into v_available
        from public.find_available_resources(
          p_shop_id,
          p_branch_id,
          coalesce(p_resource_type, 'table'),
          coalesce(p_party_size, 1),
          v_start_ts,
          v_end_ts
        );

        slot_time := v_slot_time;
        capacity := coalesce(v_resource_total, 0);
        booked_count := greatest(capacity - v_available, 0);
        remaining_capacity := v_available;
        return next;
      end if;
    end if;

    v_current_ts := v_current_ts + make_interval(mins => v_interval);
  end loop;

  return;
end;
$$;

-- ── 4. get_available_slots (LINE chatbot + portal drawer, open slots only) ──

create or replace function public.get_available_slots(
  p_shop_id uuid,
  p_branch_id uuid,
  p_service_id uuid,
  p_date date,
  p_resource_type text default null,
  p_party_size int default null,
  p_resource_id uuid default null
)
returns table(slot_time time, remaining_capacity int)
language plpgsql
as $$
declare
  v_weekday int;
  v_open time;
  v_close time;
  v_break_start time;
  v_break_end time;
  v_interval int;
  v_capacity int;
  v_slot_capacity int;
  v_service_duration int;
  v_current_ts timestamp;
  v_close_ts timestamp;
  v_slot_time time;
  v_booked int;
  v_resource_count int;
  v_start_ts timestamptz;
  v_end_ts timestamptz;
begin
  if exists(
    select 1 from public.holidays h
    where h.shop_id = p_shop_id
      and (h.branch_id is null or h.branch_id = p_branch_id)
      and h.holiday_date = p_date
      and h.is_deleted = false
  ) then
    return;
  end if;

  v_weekday := extract(dow from p_date);

  select wh.open_time, wh.close_time, wh.break_start, wh.break_end, wh.slot_interval_minutes, wh.capacity_per_slot
  into v_open, v_close, v_break_start, v_break_end, v_interval, v_capacity
  from public.working_hours wh
  where wh.shop_id = p_shop_id
    and wh.weekday = v_weekday
    and wh.active = true
    and wh.is_deleted = false
    and (wh.branch_id = p_branch_id or wh.branch_id is null)
  order by case when wh.branch_id = p_branch_id then 0 else 1 end
  limit 1;

  if v_open is null then
    return;
  end if;

  select coalesce(s.duration_minutes, v_interval), coalesce(s.capacity_per_slot, v_capacity)
  into v_service_duration, v_capacity
  from public.services s
  where s.id = p_service_id
    and s.shop_id = p_shop_id
    and s.active = true
    and s.is_deleted = false
  limit 1;

  v_current_ts := p_date::timestamp + v_open;
  v_close_ts := p_date::timestamp + v_close;

  while v_current_ts + make_interval(mins => coalesce(v_service_duration, v_interval)) <= v_close_ts loop
    v_slot_time := v_current_ts::time;

    if v_break_start is not null and v_break_end is not null and v_slot_time >= v_break_start and v_slot_time < v_break_end then
      v_current_ts := v_current_ts + make_interval(mins => v_interval);
      continue;
    end if;

    if p_resource_type is null and p_resource_id is null then
      select count(*) into v_booked
      from public.bookings b
      where b.shop_id = p_shop_id
        and b.branch_id = p_branch_id
        and b.service_id = p_service_id
        and b.booking_date = p_date
        and b.start_time = v_slot_time
        and b.status not in ('cancelled','no_show')
        and b.is_deleted = false;

      -- Per-slot capacity: a time-range rule if one covers this slot, else the
      -- service default read above.
      v_slot_capacity := coalesce(
        public.resolve_slot_capacity(p_shop_id, p_service_id, p_branch_id, p_date, v_slot_time),
        v_capacity,
        0
      );

      if v_booked < v_slot_capacity then
        slot_time := v_slot_time;
        remaining_capacity := v_slot_capacity - v_booked;
        return next;
      end if;
    else
      v_start_ts := (p_date::text || ' ' || v_slot_time::text || '+07')::timestamptz;
      v_end_ts := v_start_ts + make_interval(mins => coalesce(v_service_duration, v_interval));
      if v_end_ts <= v_start_ts then
        v_end_ts := v_start_ts + interval '1 minute';
      end if;

      if p_resource_id is not null then
        select count(*) into v_booked
        from public.bookings b
        cross join lateral (
          select
            (b.booking_date::text || ' ' || b.start_time::text || '+07')::timestamptz as b_start_ts,
            (b.booking_date::text || ' ' || coalesce(b.end_time, b.start_time + interval '30 minutes')::text || '+07')::timestamptz as b_end_raw_ts
        ) t
        where b.shop_id = p_shop_id
          and b.branch_id = p_branch_id
          and b.resource_id = p_resource_id
          and b.status not in ('cancelled','no_show','skipped','completed')
          and b.is_deleted = false
          and tstzrange(
            t.b_start_ts,
            case when t.b_end_raw_ts > t.b_start_ts then t.b_end_raw_ts else t.b_start_ts + interval '1 minute' end,
            '[)'
          ) && tstzrange(v_start_ts, v_end_ts, '[)');

        if v_booked = 0 then
          slot_time := v_slot_time;
          remaining_capacity := 1;
          return next;
        end if;
      else
        select count(*) into v_resource_count
        from public.find_available_resources(
          p_shop_id,
          p_branch_id,
          coalesce(p_resource_type, 'table'),
          coalesce(p_party_size, 1),
          v_start_ts,
          v_end_ts
        );

        if v_resource_count > 0 then
          slot_time := v_slot_time;
          remaining_capacity := v_resource_count;
          return next;
        end if;
      end if;
    end if;

    v_current_ts := v_current_ts + make_interval(mins => v_interval);
  end loop;

  return;
end;
$$;

-- ── 5. enforce_slot_capacity (insert guard) ─────────────────────────────────
-- Same exemptions, lock and count as 202609290001; only the capacity lookup
-- goes through the resolver.

create or replace function public.enforce_slot_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity int;
  v_booked int;
begin
  if new.created_by is not null
     or coalesce(new.is_demo, false)
     or new.resource_id is not null
     or new.service_id is null
     or new.status in ('cancelled', 'no_show') then
    return new;
  end if;

  v_capacity := public.resolve_slot_capacity(
    new.shop_id, new.service_id, new.branch_id, new.booking_date, new.start_time
  );

  -- Unknown service: not this trigger's business, the foreign key decides.
  if v_capacity is null then
    return new;
  end if;

  -- Serialise per slot so two concurrent inserts cannot both pass the count.
  perform pg_advisory_xact_lock(
    hashtext(
      new.shop_id::text || ':slot:' || coalesce(new.branch_id::text, '') || ':' || new.service_id::text
      || ':' || new.booking_date::text || ':' || new.start_time::text
    )
  );

  select count(*) into v_booked
  from public.bookings b
  where b.shop_id = new.shop_id
    and b.branch_id is not distinct from new.branch_id
    and b.service_id = new.service_id
    and b.booking_date = new.booking_date
    and b.start_time = new.start_time
    and b.is_deleted = false
    and b.status not in ('cancelled', 'no_show');

  if v_booked >= v_capacity then
    raise exception 'slot_full' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Same trigger as 202609290001, recreated so this migration also stands on a
-- database where that one was never applied.
drop trigger if exists trg_bookings_slot_capacity on public.bookings;
create trigger trg_bookings_slot_capacity
before insert on public.bookings
for each row execute function public.enforce_slot_capacity();

create index if not exists idx_bookings_slot_capacity
  on public.bookings(shop_id, branch_id, service_id, booking_date, start_time)
  where is_deleted = false;
