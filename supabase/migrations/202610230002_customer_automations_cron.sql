-- Scheduler for customer automations (GET /api/cron/customer-automations).
--
-- Same mechanism as 202610090002_slip_recheck_cron.sql: pg_cron + pg_net call
-- the app route, reading `cron_app_url` / `cron_secret` from Vault. Until those
-- secrets exist the trigger returns without calling anything.
--
--   customer-followup  every 5 minutes  (thank-you after a completed queue)
--   customer-winback   03:00 UTC daily  (10:00 Asia/Bangkok — a polite hour)

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.trigger_customer_automations(p_job text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  if p_job not in ('followup', 'winback') then
    return;
  end if;

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
    url := rtrim(v_url, '/') || '/api/cron/customer-automations?job=' || p_job,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 55000
  );
end;
$$;

revoke all on function public.trigger_customer_automations(text) from public;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'customer-followup') then
    perform cron.unschedule('customer-followup');
  end if;
  if exists (select 1 from cron.job where jobname = 'customer-winback') then
    perform cron.unschedule('customer-winback');
  end if;
end $$;

select cron.schedule(
  'customer-followup',
  '*/5 * * * *',
  $$select public.trigger_customer_automations('followup')$$
);

select cron.schedule(
  'customer-winback',
  '0 3 * * *',
  $$select public.trigger_customer_automations('winback')$$
);
