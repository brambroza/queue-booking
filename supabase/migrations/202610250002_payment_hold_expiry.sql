-- Hold an unpaid LIFF booking as `pending_approval` until it is paid, and
-- release the seat automatically when the payment deadline passes.
--
-- `payment_hold_booking_id` = the booking whose payment releases this hold:
-- the booking itself for a single queue, the first (paying) queue for the other
-- queues of a multi-pick order. NULL = not held (shop without online payment,
-- staff-created booking, service that needs manual approval). It is kept after
-- an expiry cancel so a late payment can still be traced to the order.
--
-- The app reads and writes the column defensively: before this runs, bookings
-- keep the old behaviour (confirmed straight away, never expired).

alter table public.bookings
  add column if not exists payment_hold_booking_id uuid references public.bookings(id) on delete set null;

comment on column public.bookings.payment_hold_booking_id is
  'Booking whose payment releases this pending_approval hold (self, or the paying queue of a multi-pick order). NULL = not held for payment.';

create index if not exists idx_bookings_payment_hold
  on public.bookings(payment_hold_booking_id)
  where payment_hold_booking_id is not null;

-- Scheduler for GET /api/cron/payment-expiry, same mechanism as
-- 202610090002_slip_recheck_cron.sql (Vault secrets `cron_app_url`, `cron_secret`).
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.trigger_payment_expiry()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets
   where name = 'cron_app_url'
   limit 1;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets
   where name = 'cron_secret'
   limit 1;

  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_get(
    url := rtrim(v_url, '/') || '/api/cron/payment-expiry',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 55000
  );
end;
$$;

revoke all on function public.trigger_payment_expiry() from public;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'payment-expiry') then
    perform cron.unschedule('payment-expiry');
  end if;
end $$;

select cron.schedule(
  'payment-expiry',
  '*/5 * * * *',
  $$select public.trigger_payment_expiry()$$
);
