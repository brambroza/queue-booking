-- Closing time 00:00 = midnight at the END of the day.
--
-- A shop open 08:00–00:00 (vspin, SHOP-847DS3, 2026-10-25) got no slots at
-- all: the slot loop compared `date + open + duration <= date + close`, and
-- `date + 00:00` is the midnight BEFORE opening. From now on a closing time of
-- exactly 00:00 with a later opening time means the following midnight, so the
-- last slot is 23:00–00:00. Only 00:00 is special: a closing time before the
-- opening (e.g. 02:00) is still "no slots" — slots past midnight would belong
-- to the next booking_date and are not supported.
--
-- A booking that ends at midnight stores end_time 00:00. The overlap checks
-- used to read that as before the start and shrink the booking to one minute
-- (the legacy-row guard), so another booking could overlap it. They now go
-- through `booking_end_ts`, which applies the same 00:00 rule. The guard for
-- other end-before-start rows (old UTC bug) is unchanged.
--
-- Bodies copied from their latest definitions (202610010001 for the two slot
-- RPCs, 202605160001 for find_available_resources, 202608210001 for
-- is_resource_available) with only the close / end-time handling changed. The
-- app counterpart is `endTimeMinutes` in src/lib/booking/multi-slot.ts.
--
-- Safe to run live; no data changes. Run BEFORE deploying the matching app
-- version: the app now writes end_time 00:00 for a 23:00 slot, which the old
-- overlap functions would read as a one-minute booking.

-- ── 1. End of a stored booking ──────────────────────────────────────────────

create or replace function public.booking_end_ts(p_date date, p_start time, p_end time)
returns timestamptz
language sql
stable
as $$
  select case
    when p_end = time '00:00' and p_start > time '00:00'
      then ((p_date + 1)::text || ' 00:00:00+07')::timestamptz
    else (p_date::text || ' ' || coalesce(p_end, p_start + interval '30 minutes')::text || '+07')::timestamptz
  end;
$$;

comment on function public.booking_end_ts(date, time, time) is
  'Bangkok end of a booking row. end_time 00:00 after a later start = next midnight; NULL = start + 30 min.';

-- ── 2. get_slot_availability (LIFF grid) ──────────────────────────────────

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
  -- 00:00 after a later opening = midnight at the end of the day.
  if v_close = time '00:00' and v_open > time '00:00' then
    v_close_ts := v_close_ts + interval '1 day';
  end if;

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
            public.booking_end_ts(b.booking_date, b.start_time, b.end_time) as b_end_raw_ts
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

-- ── 3. get_available_slots (chatbot + portal drawer) ──────────────────────

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
  -- 00:00 after a later opening = midnight at the end of the day.
  if v_close = time '00:00' and v_open > time '00:00' then
    v_close_ts := v_close_ts + interval '1 day';
  end if;

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
            public.booking_end_ts(b.booking_date, b.start_time, b.end_time) as b_end_raw_ts
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

-- ── 4. find_available_resources ───────────────────────────────────────────

create or replace function public.find_available_resources(
  p_shop_id uuid,
  p_branch_id uuid,
  p_resource_type text,
  p_party_size int,
  p_start_time timestamptz,
  p_end_time timestamptz
)
returns table(
  resource_id uuid,
  resource_code text,
  resource_name text,
  capacity int
)
language sql
stable
as $$
  with candidates as (
    select r.id, r.resource_code, r.resource_name, r.capacity
    from public.booking_resources r
    where r.shop_id = p_shop_id
      and (p_branch_id is null or r.branch_id = p_branch_id)
      and r.resource_type = p_resource_type
      and r.active = true
      and r.is_deleted = false
      and r.capacity >= greatest(coalesce(p_party_size, 1), 1)
  ),
  occupied as (
    select b.resource_id
    from public.bookings b
    cross join lateral (
      select
        (b.booking_date::text || ' ' || b.start_time::text || '+07')::timestamptz as b_start_ts,
        public.booking_end_ts(b.booking_date, b.start_time, b.end_time) as b_end_raw_ts
    ) t
    where b.shop_id = p_shop_id
      and (p_branch_id is null or b.branch_id = p_branch_id)
      and b.resource_id is not null
      and b.is_deleted = false
      and b.status not in ('cancelled','no_show','skipped','completed')
      and tstzrange(
        t.b_start_ts,
        case when t.b_end_raw_ts > t.b_start_ts then t.b_end_raw_ts else t.b_start_ts + interval '1 minute' end,
        '[)'
      ) && tstzrange(
        p_start_time,
        case when p_end_time > p_start_time then p_end_time else p_start_time + interval '1 minute' end,
        '[)'
      )
  )
  select c.id, c.resource_code, c.resource_name, c.capacity
  from candidates c
  left join occupied o on o.resource_id = c.id
  where o.resource_id is null
  order by c.capacity asc, c.resource_code asc nulls last, c.resource_name asc;
$$;

-- ── 5. is_resource_available ──────────────────────────────────────────────

create or replace function public.is_resource_available(
  p_shop_id uuid,
  p_resource_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_exclude_booking_id uuid default null
)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1
    from public.bookings b
    cross join lateral (
      select
        (b.booking_date::text || ' ' || b.start_time::text || '+07')::timestamptz as b_start_ts,
        public.booking_end_ts(b.booking_date, b.start_time, b.end_time) as b_end_raw_ts
    ) t
    where b.shop_id = p_shop_id
      and b.resource_id = p_resource_id
      and b.is_deleted = false
      and b.status not in ('cancelled','no_show','skipped','completed')
      and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
      and tstzrange(
        t.b_start_ts,
        case when t.b_end_raw_ts > t.b_start_ts then t.b_end_raw_ts else t.b_start_ts + interval '1 minute' end,
        '[)'
      ) && tstzrange(
        p_start,
        case when p_end > p_start then p_end else p_start + interval '1 minute' end,
        '[)'
      )
  );
$$;
