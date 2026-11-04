-- Phase 11 (SPEC 6.8): Screen Time. Four more local tables sync through the same generic
-- sync_records: screen_days (daily totals per app), screen_rules, screen_locks, screen_events.
alter table public.sync_records drop constraint if exists sync_records_tbl;
alter table public.sync_records add constraint sync_records_tbl check (tbl in (
  'profile', 'settings', 'dreams', 'main_quests', 'milestones', 'habits', 'quests',
  'quest_instances', 'progress_entries', 'days', 'focus_sessions', 'body_logs', 'reviews',
  'xp_events', 'achievements_unlocked', 'skills', 'skill_evidence', 'job_applications',
  'plan_history', 'plan_proposals', 'learning_events', 'summaries', 'compactions',
  'screen_days', 'screen_rules', 'screen_locks', 'screen_events'
));

-- The app keeps the Phase 11 tables on the device until this returns 3.
create or replace function public.sync_server_version() returns int
  language sql stable as $$ select 3 $$;
revoke all on function public.sync_server_version() from public;
grant execute on function public.sync_server_version() to authenticated;

-- Trusted time for screen-time locks: a lock ends only when the server's clock passes its end,
-- so changing the phone's clock never unlocks it. Callable without an account (no data).
create or replace function public.server_time() returns timestamptz
  language sql stable as $$ select now() $$;
revoke all on function public.server_time() from public;
grant execute on function public.server_time() to anon, authenticated;

-- Conflict rules: as before (…_instance_merge.sql), plus: a screen-time lock only ever gets
-- longer — the copy that ends later wins (ISO timestamps compare as text). Same rules as
-- src/core/sync/merge.ts (a test runs both).
create or replace function public.sync_incoming_wins(
  p_tbl text,
  p_old_data jsonb,
  p_old_sort text,
  p_new_data jsonb,
  p_new_sort text
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  old_set text;
  new_set text;
  old_rev int;
  new_rev int;
  old_rank int;
  new_rank int;
begin
  if p_tbl = 'xp_events' then
    return false; -- append-only: the first copy of an award is the award
  end if;
  if p_tbl = 'days' then
    old_set := coalesce(p_old_data ->> 'low_energy_set_at', '');
    new_set := coalesce(p_new_data ->> 'low_energy_set_at', '');
    return new_set > old_set or (new_set = old_set and p_new_sort > p_old_sort);
  end if;
  if p_tbl = 'screen_locks' then
    old_set := coalesce(p_old_data ->> 'end_at', '');
    new_set := coalesce(p_new_data ->> 'end_at', '');
    if new_set <> old_set then
      return new_set > old_set;
    end if;
  end if;
  if p_tbl = 'quest_instances' then
    old_rev := coalesce((p_old_data ->> 'award_revision')::int, 0);
    new_rev := coalesce((p_new_data ->> 'award_revision')::int, 0);
    if new_rev <> old_rev then
      return new_rev > old_rev;
    end if;
    old_rank := case p_old_data ->> 'status'
      when 'done_full' then 3 when 'done_min' then 2 when 'done_late' then 1 else 0 end;
    new_rank := case p_new_data ->> 'status'
      when 'done_full' then 3 when 'done_min' then 2 when 'done_late' then 1 else 0 end;
    if new_rank <> old_rank then
      return new_rank > old_rank;
    end if;
  end if;
  return p_new_sort > p_old_sort;
end;
$$;

-- Compaction (SPEC 6.7 D) also removes old screen-time days from the cloud once a compaction
-- has synced (they live on as monthly totals in the summaries). Same as core/compaction/apply.ts.
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
    (tbl in ('xp_events', 'focus_sessions', 'body_logs', 'learning_events', 'screen_days')
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
