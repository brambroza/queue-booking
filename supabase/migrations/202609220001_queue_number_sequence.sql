-- Queue numbers are issued by the database instead of the two TS write paths.
--
-- Before this migration both /api/bookings and /api/public/shop/[shopKey]/book
-- counted the day's rows and formatted `A` + 3 digits themselves. That had two
-- problems: the count → insert pair is not atomic (two concurrent bookings got
-- the same number, and nothing stopped them), and past 999 the number simply
-- grew (`A1000`). The trigger below serialises per (shop, branch, day) with an
-- advisory lock, rolls the letter after 999 (`A999` → `B001` … `Z999`) and a
-- unique index makes a duplicate impossible even if the lock is ever bypassed.
--
-- Rows that arrive with a queue_number already set (demo sandbox uses the `D`
-- prefix) are left alone. Cancelled / deleted / demo rows still count, so a
-- number is never reused within the day — same as the old TS behaviour.
--
-- Run BEFORE deploying the matching app version: the app no longer sends
-- queue_number, so without the trigger inserts fail on the NOT NULL constraint.

create or replace function public.format_queue_number(p_ordinal integer)
returns text
language sql
immutable
as $$
  select
    case
      -- Past Z999 keep the letter and let the number grow so it stays unique.
      when (p_ordinal - 1) / 999 >= 26 then 'Z' || (p_ordinal - 25 * 999)::text
      else chr(65 + (p_ordinal - 1) / 999) || lpad((((p_ordinal - 1) % 999) + 1)::text, 3, '0')
    end;
$$;

create or replace function public.assign_queue_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if new.queue_number is not null and new.queue_number <> '' then
    return new;
  end if;

  -- Serialise number issuing per (shop, branch, day) until this transaction ends.
  perform pg_advisory_xact_lock(
    hashtext(new.shop_id::text || ':' || new.branch_id::text || ':' || new.booking_date::text)
  );

  select count(*) into v_count
  from public.bookings b
  where b.shop_id = new.shop_id
    and b.branch_id = new.branch_id
    and b.booking_date = new.booking_date;

  new.queue_number := public.format_queue_number(v_count + 1);
  return new;
end;
$$;

drop trigger if exists trg_bookings_assign_queue_number on public.bookings;
create trigger trg_bookings_assign_queue_number
before insert on public.bookings
for each row execute function public.assign_queue_number();

-- Heal duplicates the old race already produced, otherwise the unique index
-- below cannot be created. For each duplicated (shop, branch, day, number) the
-- earliest row keeps its number; every later one gets the next number of that
-- day that nobody holds yet. Only rows in a duplicate group change.
do $$
declare
  r record;
  v_next integer;
  v_candidate text;
begin
  for r in
    select b.id, b.shop_id, b.branch_id, b.booking_date, b.queue_number
    from public.bookings b
    where exists (
      select 1
      from public.bookings d
      where d.shop_id = b.shop_id
        and d.branch_id = b.branch_id
        and d.booking_date = b.booking_date
        and d.queue_number = b.queue_number
        and (d.created_at < b.created_at or (d.created_at = b.created_at and d.id < b.id))
    )
    order by b.booking_date, b.created_at, b.id
  loop
    select count(*) into v_next
    from public.bookings
    where shop_id = r.shop_id and branch_id = r.branch_id and booking_date = r.booking_date;

    loop
      v_next := v_next + 1;
      v_candidate := public.format_queue_number(v_next);
      exit when not exists (
        select 1 from public.bookings
        where shop_id = r.shop_id and branch_id = r.branch_id
          and booking_date = r.booking_date and queue_number = v_candidate
      );
    end loop;

    update public.bookings set queue_number = v_candidate where id = r.id;
    raise notice 'queue number healed: booking % on % % -> %', r.id, r.booking_date, r.queue_number, v_candidate;
  end loop;
end
$$;

create unique index if not exists uq_bookings_queue_number_per_day
  on public.bookings(shop_id, branch_id, booking_date, queue_number);
