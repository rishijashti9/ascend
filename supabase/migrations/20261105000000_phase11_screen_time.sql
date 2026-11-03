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
