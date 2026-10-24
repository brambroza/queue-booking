-- Customer automations (Phase 1): post-service follow-up + win-back.
--
-- * shops: owner switches and limits. Both automations default OFF.
-- * bookings.completed_at: stamped by trigger on every path that marks a
--   booking completed (portal PATCH, queue board, SQL), so the follow-up cron
--   never depends on one route remembering to set it. Old completed bookings
--   stay NULL on purpose: they must not receive a late "thank you".
-- * bookings.followup_sent_at: claim flag, one follow-up per booking.
-- * automation_sends: one row per automated push, the source of the monthly
--   cap and of "the system brought back N queues = ฿X". Written by the service
--   role only; staff may read their own shop's rows.
--
-- The app reads every new column defensively, so deploying the code before
-- this migration only leaves the automations off.

alter table public.shops
  add column if not exists followup_enabled boolean not null default false,
  add column if not exists followup_delay_minutes integer not null default 120,
  add column if not exists google_review_url text,
  add column if not exists winback_enabled boolean not null default false,
  add column if not exists winback_default_days integer not null default 30,
  add column if not exists automation_monthly_cap integer not null default 300;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shops_followup_delay_minutes_check') then
    alter table public.shops
      add constraint shops_followup_delay_minutes_check check (followup_delay_minutes between 0 and 1440);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shops_winback_default_days_check') then
    alter table public.shops
      add constraint shops_winback_default_days_check check (winback_default_days between 7 and 365);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shops_automation_monthly_cap_check') then
    alter table public.shops
      add constraint shops_automation_monthly_cap_check check (automation_monthly_cap between 0 and 100000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shops_google_review_url_check') then
    alter table public.shops
      add constraint shops_google_review_url_check
      check (google_review_url is null or (google_review_url ~ '^https://' and char_length(google_review_url) <= 500));
  end if;
end $$;

alter table public.bookings
  add column if not exists completed_at timestamptz,
  add column if not exists followup_sent_at timestamptz;

-- Follow-up cron: "completed recently, not followed up yet" per shop.
create index if not exists idx_bookings_followup_due
  on public.bookings(shop_id, completed_at)
  where status = 'completed' and followup_sent_at is null and completed_at is not null;

create or replace function public.stamp_booking_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed'
     and (tg_op = 'INSERT' or old.status is distinct from 'completed')
     and new.completed_at is null then
    new.completed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_booking_completed_at on public.bookings;
create trigger trg_stamp_booking_completed_at
  before insert or update of status on public.bookings
  for each row execute function public.stamp_booking_completed_at();

create table if not exists public.automation_sends (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  customer_id uuid references public.customers(id),
  line_user_id uuid references public.line_users(id),
  kind text not null check (kind in ('followup', 'winback')),
  source_booking_id uuid references public.bookings(id),
  status text not null check (status in ('sent', 'failed')),
  error text check (error is null or char_length(error) <= 300),
  sent_at timestamptz not null default now(),
  converted_booking_id uuid references public.bookings(id),
  converted_at timestamptz,
  revenue_estimate numeric(12,2) check (revenue_estimate is null or revenue_estimate >= 0)
);

-- Monthly cap + ROI per shop.
create index if not exists idx_automation_sends_shop_kind
  on public.automation_sends(shop_id, kind, sent_at desc);
-- Win-back cooldown and booking attribution per customer.
create index if not exists idx_automation_sends_customer
  on public.automation_sends(shop_id, customer_id, sent_at desc);
-- A booking is followed up at most once, even if two cron ticks overlap.
create unique index if not exists uq_automation_sends_followup_booking
  on public.automation_sends(source_booking_id)
  where kind = 'followup' and status = 'sent';

alter table public.automation_sends enable row level security;

drop policy if exists automation_sends_shop_read on public.automation_sends;
create policy automation_sends_shop_read on public.automation_sends
for select to authenticated
using (public.can_access_shop(shop_id));
