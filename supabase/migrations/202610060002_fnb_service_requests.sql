-- "Call staff" and "check the bill" buttons for the F&B ordering sheet.
--
-- Both are customer requests tied to a booking: the customer taps a button in
-- LIFF, staff see it on the order board and acknowledge it, and the customer is
-- told on LINE. A bill request also stores a snapshot of the summary the
-- customer saw (bay fee + food), so staff can tell what was on screen even if
-- more orders arrive afterwards. The amount is an estimate: the app has no
-- session extension / overtime billing yet, so staff confirm the final figure.
--
-- Dedupe is enforced here, not only in the app: a partial unique index allows a
-- single `open` request per (booking, type), so two quick taps cannot create two
-- tickets. The API treats the 23505 as "already requested".
--
-- Depends on 202610060001_fnb_ordering.sql. Run BEFORE deploying the matching
-- app version. Idempotent.

create table if not exists public.fnb_service_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  branch_id uuid references public.branches(id),
  booking_id uuid not null references public.bookings(id),
  resource_id uuid references public.booking_resources(id),
  line_user_id uuid references public.line_users(id),
  request_type text not null check (request_type in ('call_staff', 'bill')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'closed')),
  -- Bill snapshot (request_type = 'bill' only). Estimate, confirmed by staff.
  booking_amount numeric(10,2) check (booking_amount is null or booking_amount >= 0),
  fnb_amount numeric(10,2) check (fnb_amount is null or fnb_amount >= 0),
  total_amount numeric(10,2) check (total_amount is null or total_amount >= 0),
  acknowledged_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create unique index if not exists uq_fnb_service_requests_one_open
  on public.fnb_service_requests(booking_id, request_type)
  where status = 'open' and is_deleted = false;

create index if not exists idx_fnb_service_requests_board
  on public.fnb_service_requests(shop_id, status, created_at desc)
  where is_deleted = false;

alter table public.fnb_service_requests enable row level security;

drop policy if exists fnb_service_requests_shop_all on public.fnb_service_requests;
create policy fnb_service_requests_shop_all on public.fnb_service_requests
for all to authenticated
using (public.can_access_shop(shop_id))
with check (public.can_access_shop(shop_id));
