-- Scheduler for the slip recheck (GET /api/cron/slip-recheck).
--
-- Same mechanism as 202609120005_booking_reminder_cron.sql: pg_cron + pg_net
-- call the app route every 5 minutes, reading the app URL and the shared
-- secret from Vault (`cron_app_url`, `cron_secret`). Those two secrets already
-- exist wherever booking reminders run; until they do the trigger function
-- returns without calling anything, so applying this early is harmless.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.trigger_slip_recheck()
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
    url := rtrim(v_url, '/') || '/api/cron/slip-recheck',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 55000
  );
end;
$$;

revoke all on function public.trigger_slip_recheck() from public;

-- Re-register idempotently so re-running the migration does not stack jobs.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'slip-recheck') then
    perform cron.unschedule('slip-recheck');
  end if;
end $$;

select cron.schedule(
  'slip-recheck',
  '*/5 * * * *',
  $$select public.trigger_slip_recheck()$$
);
