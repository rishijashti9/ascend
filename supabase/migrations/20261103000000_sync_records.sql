-- ASCEND sync store (Phase 7, SPEC 9).
--
-- Local-first: the app's real database is IndexedDB on each device. The server only keeps the
-- latest version of every record, per user, so devices can exchange changes:
--   * one row per local record (`tbl` = local table name, `id` = local record id) with the
--     record itself as JSON in `data` — so local schema changes never need a server migration;
--   * last-write-wins per record using the writer's hybrid logical clock (HLC), with its
--     physical time capped at the time the server received it (`sort_key`), so a phone with a
--     clock in the future can't overwrite newer data;
--   * `xp_events` are append-only: the row id is the event's idempotency key, and an existing
--     event is never replaced — the same award from two devices is stored once;
--   * `days` are derived and recomputed on each device; only the low-energy choice travels, so
--     its row is decided by `low_energy_set_at`;
--   * a completed quest instance always beats one the day rollover marked `missed` (a real
--     completion that arrives late turns a missed day into an active one, SPEC 4.8);
--   * `seq` grows on every accepted write, so a device pulls "everything after seq N".
-- Row Level Security: a user can only ever read their own rows; all writes go through
-- push_records(), which uses the signed-in user's id and applies the rules above.

create sequence if not exists public.sync_seq;

create table if not exists public.sync_records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tbl text not null,
  id text not null,
  hlc text not null,
  sort_key text not null,
  deleted boolean not null default false,
  data jsonb not null,
  seq bigint not null default nextval('public.sync_seq'),
  received_at timestamptz not null default now(),
  primary key (user_id, tbl, id),
  constraint sync_records_tbl check (tbl in (
    'profile', 'settings', 'dreams', 'main_quests', 'milestones', 'habits', 'quests',
    'quest_instances', 'progress_entries', 'days', 'focus_sessions', 'body_logs', 'reviews',
    'xp_events', 'achievements_unlocked', 'skills', 'skill_evidence', 'job_applications',
    'plan_history', 'plan_proposals'
  )),
  constraint sync_records_hlc check (hlc ~ '^[0-9]{15}-[0-9a-z]{4,}-.+$'),
  constraint sync_records_id check (length(id) between 1 and 300),
  constraint sync_records_size check (pg_column_size(data) < 262144)
);

create index if not exists sync_records_pull on public.sync_records (user_id, seq);

alter table public.sync_records enable row level security;

drop policy if exists "Users read their own records" on public.sync_records;
create policy "Users read their own records" on public.sync_records
  for select to authenticated
  using (user_id = (select auth.uid()));

-- No insert / update / delete policies: writes only through the functions below.
revoke all on public.sync_records from anon, authenticated;
grant select on public.sync_records to authenticated;

-- The HLC with its physical part capped at the server-received time (ms).
create or replace function public.sync_sort_key(p_hlc text, p_received_ms bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select lpad(least(split_part(p_hlc, '-', 1)::bigint, p_received_ms)::text, 15, '0')
    || substr(p_hlc, 16)
$$;

-- Does an incoming version replace the stored one? (Same rules as src/core/sync/merge.ts.)
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
  done constant text[] := array['done_full', 'done_min', 'done_late'];
  old_set text;
  new_set text;
begin
  if p_tbl = 'xp_events' then
    return false; -- append-only: the first copy of an award is the award
  end if;
  if p_tbl = 'days' then
    old_set := coalesce(p_old_data ->> 'low_energy_set_at', '');
    new_set := coalesce(p_new_data ->> 'low_energy_set_at', '');
    return new_set > old_set or (new_set = old_set and p_new_sort > p_old_sort);
  end if;
  if p_tbl = 'quest_instances' then
    if p_old_data ->> 'status' = 'missed' and p_new_data ->> 'status' = any (done) then
      return true;
    end if;
    if p_new_data ->> 'status' = 'missed' and p_old_data ->> 'status' = any (done) then
      return false;
    end if;
  end if;
  return p_new_sort > p_old_sort;
end;
$$;

-- Push a batch of local records: [{tbl, id, hlc, deleted, data}, …] (max 500).
-- Returns {accepted, kept}: how many were stored, and how many lost to a newer version.
create or replace function public.push_records(p_records jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  rec jsonb;
  now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_sort text;
  v_old_data jsonb;
  v_old_sort text;
  inserted int;
  accepted int := 0;
  kept int := 0;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) > 500 then
    raise exception 'Send an array of at most 500 records' using errcode = '22023';
  end if;

  for rec in select value from jsonb_array_elements(p_records) loop
    v_sort := public.sync_sort_key(rec ->> 'hlc', now_ms);
    insert into public.sync_records (user_id, tbl, id, hlc, sort_key, deleted, data)
    values (
      uid,
      rec ->> 'tbl',
      rec ->> 'id',
      rec ->> 'hlc',
      v_sort,
      coalesce((rec ->> 'deleted')::boolean, false),
      rec -> 'data'
    )
    on conflict (user_id, tbl, id) do nothing;
    get diagnostics inserted = row_count;

    if inserted = 1 then
      accepted := accepted + 1;
    else
      select data, sort_key into v_old_data, v_old_sort
      from public.sync_records
      where user_id = uid and tbl = rec ->> 'tbl' and id = rec ->> 'id'
      for update;
      if public.sync_incoming_wins(rec ->> 'tbl', v_old_data, v_old_sort, rec -> 'data', v_sort) then
        update public.sync_records
        set hlc = rec ->> 'hlc',
            sort_key = v_sort,
            deleted = coalesce((rec ->> 'deleted')::boolean, false),
            data = rec -> 'data',
            seq = nextval('public.sync_seq'),
            received_at = now()
        where user_id = uid and tbl = rec ->> 'tbl' and id = rec ->> 'id';
        accepted := accepted + 1;
      else
        kept := kept + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('accepted', accepted, 'kept', kept);
end;
$$;

-- "Use this device's data" (first sign-in): clear this user's cloud copy before uploading.
create or replace function public.reset_my_cloud_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  delete from public.sync_records where user_id = auth.uid();
end;
$$;

revoke all on function public.push_records(jsonb) from public, anon;
revoke all on function public.reset_my_cloud_data() from public, anon;
grant execute on function public.push_records(jsonb) to authenticated;
grant execute on function public.reset_my_cloud_data() to authenticated;
