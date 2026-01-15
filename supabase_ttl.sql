-- 1. Create a cleanup function (Security Definer to bypass RLS)
create or replace function delete_expired_rooms()
returns void
language plpgsql
security definer
as $$
begin
  -- Delete rooms where expires_at is in the past
  -- Cascade delete will handle messages if correctly set up, 
  -- otherwise we delete messages first.
  delete from rooms where expires_at < now();
end;
$$;

-- 2. Validate pg_cron extension availability
-- Note: pg_cron is available on Supabase Pro or some Free tier projects depending on region/version.
-- If this fails, you may need to enable the extension in the Dashboard:
-- Database -> Extensions -> Search "pg_cron" -> Enable.

create extension if not exists pg_cron;

-- 3. Schedule the job (Run every 5 minutes)
-- Cron format: minute hour day month day_of_week
select cron.schedule(
  'cleanup-expired-rooms', -- unique job name
  '*/5 * * * *',           -- every 5 minutes
  'select delete_expired_rooms()'
);

-- To verify: select * from cron.job;
