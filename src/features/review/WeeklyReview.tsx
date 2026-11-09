import { FocusGoalLine } from '@/features/goals/ForecastLine';
import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db } from '@/core/db/db';
import { weekStats } from '@/core/engine/weekStats';
import { loadPlannerState, planWeek, type ProposalItem } from '@/core/planner';
import { useFocus } from '@/core/state/focus';
import { useGoals } from '@/core/state/goals';
import { useProgress } from '@/core/state/progress';
import { useQuests } from '@/core/state/quests';
import { useReviews } from '@/core/state/reviews';
import { addDays } from '@/core/time';
import { formatDay } from '@/features/goals/format';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { useAction } from '@/ui/hooks/useAction';
import { isEnabled } from '@/config/features';
import { ScreenWeekLine } from '@/features/screentime/ScreenWeekLine';
import { Stat } from './Stat';

const TEXTAREA = 'control w-full p-3 text-base';

type Quest = Extract<ProposalItem, { kind: 'quest.create' }>;

/**
 * Weekly review (SPEC 4.5, 7.7): how the week went, two questions, and next week's quests to
 * confirm or edit before the week starts. If skipped, the plan is applied on the week's first
 * day anyway (with Undo) — an empty week helps nobody.
 */
export function WeeklyReview({ weekStart, today }: { weekStart: string; today: string }) {
  const nextWeek = addDays(weekStart, 7);
  const perDay = useProgress((s) => s.progress?.perDay);
  const sessions = useFocus((s) => s.sessions);
  const weekly = useQuests((s) => s.weekly);
  const history = useGoals((s) => s.history);
  const existing = useReviews((s) =>
    s.reviews.find((r) => r.type === 'weekly' && r.period === weekStart),
  );
  const [well, setWell] = useState(existing?.answers.went_well ?? '');
  const [notWell, setNotWell] = useState(existing?.answers.didnt_go_well ?? '');
  const [items, setItems] = useState<Quest[] | null>(null);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);
  const { run, busy, error } = useAction();
  const planned = history.find((h) => h.trigger === `weekly:${nextWeek}` && !h.undone_at);

  useEffect(() => {
    if (planned) return;
    void loadPlannerState(db).then((state) => {
      const list = planWeek({ ...state, weekStart: nextWeek }).filter(
        (i): i is Quest => i.kind === 'quest.create',
      );
      setItems(list);
      setKept(new Set(list.map((i) => i.id)));
    });
  }, [nextWeek, planned]);

  const stats = perDay
    ? weekStats({ weekStart, today, perDay, sessions, weeklyQuests: weekly })
    : null;
  const rename = (id: string, title: string) =>
    setItems(
      (list) => list?.map((i) => (i.id === id ? { ...i, data: { ...i.data, title } } : i)) ?? null,
    );
  const toggle = (id: string) => {
    const next = new Set(kept);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setKept(next);
  };
  const chosen = (items ?? []).filter((i) => kept.has(i.id) && i.data.title.trim());

  async function save() {
    setSaved(false);
    const ok = await run({
      type: 'review.save',
      payload: {
        type: 'weekly',
        period: weekStart,
        answers: { went_well: well, didnt_go_well: notWell },
      },
    });
    if (!ok) return;
    if (!planned && chosen.length > 0) {
      const planOk = await run({
        type: 'plan.weekly',
        payload: { week_start: nextWeek, items: chosen },
      });
      if (!planOk) return;
    }
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="This week" className="panel flex flex-col gap-3 p-4">
        <h2 className="display">Week of {formatDay(weekStart)}</h2>
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Active days" value={`${stats.activeDays} of ${stats.daysSoFar}`} />
            <Stat label="Daily Clears" value={String(stats.dailyClears)} />
            <Stat label="XP" value={stats.xp.toLocaleString()} />
            <Stat label="Focus" value={`${stats.focusMin} min`} />
            <Stat label="Weekly quests" value={`${stats.weeklyDone} of ${stats.weeklyTotal}`} />
          </div>
        )}
        {isEnabled('screenTime') && <ScreenWeekLine weekStart={weekStart} today={today} />}
      </section>

      <form
        aria-label="Weekly review"
        className="panel flex flex-col gap-4 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="What went well?">
          {(id) => (
            <textarea
              id={id}
              rows={3}
              maxLength={2000}
              value={well}
              onChange={(e) => setWell(e.target.value)}
              className={TEXTAREA}
            />
          )}
        </Field>
        <Field label="What didn’t, and why?">
          {(id) => (
            <textarea
              id={id}
              rows={3}
              maxLength={2000}
              value={notWell}
              onChange={(e) => setNotWell(e.target.value)}
              className={TEXTAREA}
            />
          )}
        </Field>

        <section aria-label="Next week's quests" className="flex flex-col gap-2">
          <h3 className="display">Next week’s quests</h3>
          <FocusGoalLine prefix="Focus goal" />
          {planned ? (
            <p className="text-muted text-sm">
              Next week is planned — see Plan history to undo it.
            </p>
          ) : items === null ? (
            <p className="text-muted text-sm">Preparing next week…</p>
          ) : items.length === 0 ? (
            <p className="text-muted text-sm">
              Nothing to plan yet — plan a goal in Goals to get weekly quests.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={kept.has(i.id)}
                    aria-label={`Keep: ${i.data.title}`}
                    onClick={() => toggle(i.id)}
                    className={`flex size-11 shrink-0 items-center justify-center rounded-full border-2 ${
                      kept.has(i.id)
                        ? 'bg-accent-fill text-on-accent border-transparent'
                        : 'border-muted'
                    }`}
                  >
                    {kept.has(i.id) && <Check aria-hidden size={20} />}
                  </button>
                  <label className="flex min-w-0 flex-1 flex-col text-sm">
                    <span className="sr-only">Quest title</span>
                    <input
                      value={i.data.title}
                      maxLength={120}
                      onChange={(e) => rename(i.id, e.target.value)}
                      className="control min-h-11 px-3 text-base"
                    />
                    {i.data.carried_over_from && (
                      <span className="text-muted text-xs">Carried over</span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>
            {!planned && chosen.length > 0
              ? `Save and plan ${chosen.length} quest${chosen.length === 1 ? '' : 's'}`
              : 'Save review'}
          </Button>
          {saved && (
            <span role="status" className="text-success-text text-sm">
              Saved
            </span>
          )}
        </div>
        {error && (
          <p role="alert" className="text-warning-text text-sm">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
