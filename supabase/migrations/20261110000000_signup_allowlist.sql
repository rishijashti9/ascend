-- Hardening V-01 (docs/audit/phase-2-security-assessment.md): ASCEND is a personal app, but the
-- project accepted sign-ups from anyone, who could then fill the database and spend the shared
-- AI quota. The dashboard switch "Allow new users to sign up" is the first lock; this is the
-- second, in the database itself, so a dashboard slip can't reopen it.
--
-- A new auth user (first sign-in with Google or an email link) is created only if their email is
-- in private.signup_allowlist. Existing accounts are untouched: signing in again never inserts
-- into auth.users. The list starts EMPTY (closed to everyone new). To let someone in, run in the
-- Supabase SQL editor:   insert into private.signup_allowlist (email) values ('name@example.com');

create schema if not exists private;
revoke all on schema private from public;

create table if not exists private.signup_allowlist (
  email text primary key,
  added_at timestamptz not null default now(),
  constraint signup_allowlist_lower check (email = lower(email))
);
revoke all on private.signup_allowlist from public;

create or replace function private.guard_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from private.signup_allowlist a where a.email = lower(coalesce(new.email, ''))
  ) then
    raise exception 'Sign-ups are closed for this project' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_signup() from public;

drop trigger if exists guard_signup on auth.users;
create trigger guard_signup
  before insert on auth.users
  for each row execute function private.guard_signup();
