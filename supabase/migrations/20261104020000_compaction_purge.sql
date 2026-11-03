-- Phase 8 Part D (SPEC 6.7): after a compaction has synced, the old detail it summarised is
-- removed from the cloud too (so other devices never download it and space is freed).
-- Same rules as core/compaction/apply.ts: everything dated before the cutoff except
-- Recovery quests (they decide streak repairs); answered plans created before it.
create or replace function public.compact_my_records(p_cutoff text) returns int
  language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if p_cutoff !~ '^[0-9]{4}-[0-9]{2}-01$' then
    raise exception 'cutoff must be the first day of a month';
  end if;
  -- Only after the compaction itself (and so its summaries) reached the server.
  if not exists (
    select 1 from public.sync_records
    where user_id = uid and tbl = 'compactions' and not deleted
      and data ->> 'cutoff_day' >= p_cutoff
  ) then
    raise exception 'that compaction has not synced yet';
  end if;
  delete from public.sync_records
  where user_id = uid and (
    (tbl in ('xp_events', 'focus_sessions', 'body_logs', 'learning_events')
      and data ->> 'day' < p_cutoff)
    or (tbl = 'quest_instances' and data ->> 'day' < p_cutoff and id not like 'recovery:%')
    or (tbl = 'progress_entries' and data ->> 'day' < p_cutoff
      and coalesce(data ->> 'quest_instance_id', '') not like 'recovery:%')
    or (tbl in ('plan_history', 'plan_proposals') and data ->> 'created_at' < p_cutoff
      and coalesce(data ->> 'status', '') <> 'pending')
  );
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.compact_my_records(text) from public;
grant execute on function public.compact_my_records(text) to authenticated;
