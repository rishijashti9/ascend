-- Hardening Phase 4 (docs/audit/phase-2-security-assessment.md).
--
-- V-10 Least privilege: Supabase grants EXECUTE on new functions and table access to `anon`
-- and `authenticated` directly, so `revoke … from public` alone left them reachable. Only what
-- the app really calls stays callable, only by signed-in users; every function gets a fixed
-- empty search_path (all names below are schema-qualified).
--
-- V-02 Resource limits: push_records now refuses a request over 8 MB and stops a user's cloud
-- copy at sync_row_limit() rows (generous: ten years of heavy use is ~120,000 rows), so no
-- account — even a stolen session — can fill the project's database.

-- ── V-10: grants ─────────────────────────────────────────────────────────────────────────────
revoke all on public.ask_usage from anon, authenticated;
revoke all on public.ask_cache from anon, authenticated;

revoke execute on function public.compact_my_records(text) from anon;
revoke execute on function public.sync_server_version() from anon;
revoke execute on function public.my_cloud_usage() from anon;
-- Internals used only inside push_records (which runs as the owner). Postgres also grants
-- EXECUTE to PUBLIC by default, so that goes too.
revoke execute on function public.sync_sort_key(text, bigint) from public, anon, authenticated;
revoke execute on function public.sync_incoming_wins(text, jsonb, text, jsonb, text)
  from public, anon, authenticated;

-- ── V-10: fixed search_path ──────────────────────────────────────────────────────────────────
alter function public.compact_my_records(text) set search_path = '';
alter function public.ask_take(uuid, int) set search_path = '';
alter function public.sync_server_version() set search_path = '';
alter function public.my_cloud_usage() set search_path = '';
alter function public.server_time() set search_path = '';

-- ── V-02: limits ─────────────────────────────────────────────────────────────────────────────
-- One place for the row ceiling (tests replace it with a small number).
create or replace function public.sync_row_limit() returns int
  language sql immutable set search_path = '' as $$ select 250000 $$;
revoke all on function public.sync_row_limit() from public, anon, authenticated;

-- Same as 20261103000000_sync_records.sql, plus the two limits.
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
  stored int;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) > 500 then
    raise exception 'Send an array of at most 500 records' using errcode = '22023';
  end if;
  if pg_column_size(p_records) > 8 * 1024 * 1024 then
    raise exception 'Request too large' using errcode = '54000';
  end if;

  select count(*) into stored from public.sync_records where user_id = uid;

  for rec in select value from jsonb_array_elements(p_records) loop
    v_sort := public.sync_sort_key(rec ->> 'hlc', now_ms);
    if stored >= public.sync_row_limit() then
      -- At the ceiling: existing records may still change, nothing new is added.
      inserted := 0;
    else
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
    end if;

    if inserted = 1 then
      accepted := accepted + 1;
      stored := stored + 1;
    else
      select data, sort_key into v_old_data, v_old_sort
      from public.sync_records
      where user_id = uid and tbl = rec ->> 'tbl' and id = rec ->> 'id'
      for update;
      if not found then
        raise exception 'Cloud storage limit reached (% records)', public.sync_row_limit()
          using errcode = '53400';
      end if;
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
revoke all on function public.push_records(jsonb) from public, anon;
grant execute on function public.push_records(jsonb) to authenticated;
