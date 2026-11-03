-- Phase 8 Part D (SPEC 6.7): Settings → My data shows how much the user's cloud copy takes.
-- Runs as the caller, so Row Level Security limits it to their own rows.
create or replace function public.my_cloud_usage() returns jsonb
  language sql stable security invoker as $$
    select jsonb_build_object(
      'records', count(*),
      'bytes', coalesce(sum(pg_column_size(data)), 0)
    )
    from public.sync_records
    where user_id = auth.uid() and not deleted;
  $$;
revoke all on function public.my_cloud_usage() from public;
grant execute on function public.my_cloud_usage() to authenticated;
