-- Phase 8 Part C (SPEC 6.7): "Ask the System" — a daily question limit and a short answer cache
-- per user, used only by the `ask` Edge Function (service role). Users can't read or write them
-- directly (RLS on, no policies).
create table if not exists public.ask_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);
alter table public.ask_usage enable row level security;

create table if not exists public.ask_cache (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  answer jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.ask_cache enable row level security;

-- Counts one question for today and returns the new count (atomic).
create or replace function public.ask_take(p_user uuid, p_limit int) returns int
  language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  insert into public.ask_usage (user_id, day, count) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set count = public.ask_usage.count + 1
  returning count into n;
  if n > p_limit then
    update public.ask_usage set count = count - 1 where user_id = p_user and day = current_date;
    return -1;
  end if;
  return n;
end;
$$;
revoke all on function public.ask_take(uuid, int) from public, anon, authenticated;
