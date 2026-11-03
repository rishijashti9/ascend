-- Phase 8 (SPEC 6.7): three more local tables sync through the same generic sync_records.
-- learning_events (Adaptive System), summaries + compactions (compaction). Same conflict rules
-- (last write wins), so only the allowed table list changes.
alter table public.sync_records drop constraint if exists sync_records_tbl;
alter table public.sync_records add constraint sync_records_tbl check (tbl in (
  'profile', 'settings', 'dreams', 'main_quests', 'milestones', 'habits', 'quests',
  'quest_instances', 'progress_entries', 'days', 'focus_sessions', 'body_logs', 'reviews',
  'xp_events', 'achievements_unlocked', 'skills', 'skill_evidence', 'job_applications',
  'plan_history', 'plan_proposals', 'learning_events', 'summaries', 'compactions'
));

-- Lets the app check the server is ready for these tables before it sends them: an app
-- deployed before this migration is applied keeps them on the device until it returns 2.
create or replace function public.sync_server_version() returns int
  language sql stable as $$ select 2 $$;
revoke all on function public.sync_server_version() from public;
grant execute on function public.sync_server_version() to authenticated;
