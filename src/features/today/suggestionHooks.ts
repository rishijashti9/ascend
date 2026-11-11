import { burnoutWarning } from '@/core/adaptive/burnout';
import { needsPlan } from '@/features/goals/planState';
import { mayShow } from '@/core/adaptive/patterns';
import { useHabits } from '@/core/state/habits';
import { reminderSuggestion } from '@/core/adaptive/timing';
import { useAppState } from '@/core/state/app';
import { addDays } from '@/core/time';
import { isEnabled } from '@/config/features';
import { useAdaptive } from '@/core/state/adaptive';
import { useGoals } from '@/core/state/goals';
import { useSuggestion } from '@/core/state/suggestion';
import { useToday } from '@/core/state/today';
import { useNudges } from '@/features/goals/useNudges';

/** Visibility of Today's suggestion cards, for the one-card SuggestionSlot (SPEC 6.7). */

/** Whether DifficultyCard has something to show (an applied change's Undo, or a welcome suggestion). */
export function useDifficultyVisible(): boolean {
  const suggestion = useSuggestion((s) => s.suggestion);
  const day = useToday((s) => s.day);
  const history = useGoals((s) => s.history);
  const input = useAdaptive((s) => s.input);
  const applied = history.some(
    (h) => !h.undone_at && day && h.trigger.startsWith('difficulty:') && h.trigger.endsWith(day),
  );
  if (applied) return true;
  if (!suggestion) return false;
  // Kinds Rishi keeps turning down come back less often (never less than weekly).
  return !input || mayShow(input, `difficulty_${suggestion.kind}`);
}

/** The goals listed by GoalNudges (empty when there is nothing to show). */
export function useGoalNudgeRows(): { id: string; title: string; note: string; to: string }[] {
  const nudges = useNudges();
  const mainQuests = useGoals((s) => s.mainQuests);
  const milestones = useGoals((s) => s.milestones);
  const proposals = useGoals((s) => s.proposals);
  if (!isEnabled('goals')) return [];

  // The same rule the Goals cards use (UX-4): one definition of "needs a plan".
  const unplanned = mainQuests.filter((q) => needsPlan(q, milestones, proposals));
  const rows = [
    ...unplanned.map((q) => ({
      id: q.id,
      title: q.title,
      note: 'needs a plan',
      to: `/growth/goals/${q.id}?plan=new`,
    })),
    ...[...new Set(nudges.map((n) => n.mainQuestId))].map((id) => ({
      id,
      title: mainQuests.find((x) => x.id === id)?.title ?? '',
      note: nudges.some((n) => n.mainQuestId === id && n.kind === 'risk')
        ? 'behind schedule'
        : 'monthly check-in',
      to: `/growth/goals/${id}`,
    })),
  ]
    .filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i)
    .slice(0, 3);
  return rows;
}

/** Days a "Not now" on the reminder-time card keeps it away. */
export const REMINDER_CARD_REST_DAYS = 30;

/** The learned core-reminder time to suggest — or today's applied change (for its Undo). */
export function useReminderCard():
  | { kind: 'suggest'; from: string; to: string; why: string }
  | { kind: 'applied'; from: string; to: string }
  | null {
  const input = useAdaptive((s) => s.input);
  const settings = useAppState((s) => s.settings);
  if (!input || !settings) return null;
  const answers = input.events.filter(
    (e) => e.kind === 'suggestion' && e.type === 'reminder_time' && e.outcome !== 'shown',
  );
  const today = answers.filter((e) => e.day === input.today).at(-1);
  if (today?.outcome === 'accepted' && today.values) {
    const v = today.values;
    return { kind: 'applied', from: clock(v.from_min ?? 0), to: clock(v.to_min ?? 0) };
  }
  const restUntil = addDays(input.today, -REMINDER_CARD_REST_DAYS);
  if (answers.some((e) => e.outcome === 'rejected' && e.day > restUntil)) return null;
  const s = reminderSuggestion(input, settings);
  return s ? { kind: 'suggest', from: s.from, to: s.to, why: s.why } : null;
}

const clock = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Days the burnout card rests after any answer. */
export const BURNOUT_REST_DAYS = 14;

/** The burnout warning to show, or today's lighter week (for its Undo). */
export function useBurnoutCard():
  { kind: 'warn'; why: string } | { kind: 'applied'; historyId: string; summary: string } | null {
  const input = useAdaptive((s) => s.input);
  const history = useGoals((s) => s.history);
  const habits = useHabits((s) => s.habits);
  if (!input) return null;
  const applied = history.find((h) => !h.undone_at && h.trigger === `burnout:${input.today}`);
  if (applied) return { kind: 'applied', historyId: applied.id, summary: applied.summary };
  const rest = addDays(input.today, -BURNOUT_REST_DAYS);
  const answered = input.events.some(
    (e) =>
      e.kind === 'suggestion' &&
      e.type === 'burnout' &&
      e.outcome !== 'shown' &&
      e.outcome !== 'ignored' &&
      e.day > rest,
  );
  if (answered) return null;
  const sleep = habits.find((h) => h.status === 'active' && h.measure === 'sleep_hours');
  const w = burnoutWarning(input, sleep?.target_value ?? null);
  return w ? { kind: 'warn', why: w.why } : null;
}
