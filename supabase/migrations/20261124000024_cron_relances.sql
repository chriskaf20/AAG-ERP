-- Phase 2 — Planification quotidienne (07:00 Lubumbashi = 05:00 UTC) de l'Edge Function « relances ».
-- Les secrets ne sont jamais dans les migrations : ils sont lus dans Supabase Vault
-- (relances_url, cron_secret), créés une fois par l'administrateur.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'relances-quotidiennes',
  '0 5 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'relances_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
