-- Quest instances merge by what happened, not by clocks (task 7.8).
--
-- Every device creates today's quest instances as `pending` when it opens. With the
-- received-time cap, a device whose clock runs fast could push its fresh `pending` copy later
-- and beat a completion that arrived earlier. For the same instance:
--   1. a higher award_revision wins (it only grows on a same-day un-tick — a deliberate undo);
--   2. same revision: more progress wins — done_full > done_min > done_late > anything else
--      (progress only goes up within a revision, SPEC 4.8), so a completion always beats
--      `pending` and the rollover's `missed`;
--   3. otherwise: last write wins (capped HLC), as for every other table.
-- Same rules as src/core/sync/merge.ts (a test runs both).

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
