-- Per-shop switch for the chatbot's fallback reply.
--
-- When a customer types something the rule-based intent parser does not
-- recognise, the webhook answers with a menu ("ต้องการทำรายการใดคะ?" + quick
-- replies). Some shops chat with customers by hand in LINE OA Chat and find
-- that menu noisy, so it can now be turned off from /portal/line-settings.
--
-- Default true keeps the current behaviour for every existing shop. The
-- inbound message is still logged when the switch is off; only the reply is
-- skipped. Recognised intents are not affected.

alter table public.shops
  add column if not exists fallback_reply_enabled boolean not null default true;

comment on column public.shops.fallback_reply_enabled is
  'When false, the LINE webhook stays silent on text it cannot match to an intent instead of replying with the fallback menu.';
