-- Schedules the due-reminders edge function to run every 15 minutes.
-- Reads the shared secret out of Vault at call time — never appears in
-- this file or in plain text in the cron job definition.
--
-- Replace the project ref in the URL below with your own if you're setting
-- this up on a different Supabase project.
select cron.schedule(
  'taskboard-due-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://yihpqinsjcaknxngnssp.supabase.co/functions/v1/due-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_shared_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
