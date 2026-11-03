import type { DayString, Habit } from '@/core/db/types';
import type { ProposalItem } from '@/core/planner/types';
import { addDays } from '@/core/time';
import type { HealthCheckIn, HealthGap } from './health';
import { sourceById } from './pack';
import { earliestSafeDate, sleepChangeAllowed } from './safety';

/**
 * Health roadmap (SPEC 6.7 B), pure: from the check-in goals and the gap analysis to Goal
 * Planner items — gradual training progression (≤ 10 % more a week), a sleep routine (a target
 * only ever goes up), simple Indian nutrition habits, and fat loss at a safe rate only.
 * Approval first, undoable — it goes through the normal plan path.
 */
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6] as const;
const cite = (id: string) => sourceById(id)?.publisher ?? id;

export function healthPlanItems(input: {
  checkIn: HealthCheckIn;
  gap: HealthGap;
  habits: readonly Habit[];
  mainQuestId: string;
  today: DayString;
  weekStart: DayString;
  /** Latest weight (kg), for a safe fat-loss milestone. */
  weightKg: number | null;
}): ProposalItem[] {
  const { checkIn, gap, habits, mainQuestId, today, weekStart, weightKg } = input;
  const items: ProposalItem[] = [];
  const active = habits.filter((h) => h.status === 'active' && !h.deleted_at);
  let m = 0;
  const milestone = (
    title: string,
    weeks: number,
    weekly: number,
    reason: string,
    extra: Partial<Extract<ProposalItem, { kind: 'milestone.create' }>['data']> = {},
  ) => {
    m++;
    items.push({
      id: `m${m}`,
      kind: 'milestone.create',
      selected: true,
      reason,
      data: {
        main_quest_id: mainQuestId,
        title,
        size_weight: weeks <= 4 ? 1 : 2,
        target_type: 'manual',
        target_value: null,
        current_source: null,
        estimated_weekly_quests: weekly,
        target_date: addDays(today, weeks * 7),
        status: m === 1 ? 'active' : 'upcoming',
        ...extra,
      },
    });
    return `ref:m${m}`;
  };
  const weekly = (title: string, ref: string, reason: string, stat: 'STR' | 'WIL' = 'STR') =>
    items.push({
      id: `w${items.length + 1}`,
      kind: 'quest.create',
      selected: true,
      reason,
      data: {
        type: 'weekly',
        title,
        stat,
        difficulty: 'normal',
        week_start: weekStart,
        linked_goal_type: 'milestone',
        linked_goal_id: ref,
        carried_over_from: null,
      },
    });
  const habit = (
    title: string,
    full: string,
    min: string,
    reason: string,
    stat: 'STR' | 'WIL' = 'STR',
  ) => {
    if (active.some((h) => h.title.toLowerCase() === title.toLowerCase())) return;
    items.push({
      id: `h${items.length + 1}`,
      kind: 'habit.create',
      selected: true,
      reason,
      data: {
        title,
        stat,
        difficulty: 'easy',
        measure: 'check',
        target_value: null,
        min_value: null,
        full_version: full,
        min_version: min,
        schedule: [...EVERY_DAY],
        linked_goal_type: 'main_quest',
        linked_goal_id: mainQuestId,
      },
    });
  };
  const status = (id: string) => gap.items.find((i) => i.guideline.id === id)?.status ?? 'unknown';
  const goals = new Set(checkIn.goals);

  if (goals.has('strength') || status('activity-strength') === 'below') {
    const first = checkIn.strengthDays === 0;
    const ref = milestone(
      'Strength training twice a week, for 6 weeks',
      6,
      12,
      `WHO: muscle-strengthening on 2+ days a week. ${first ? 'Starting from zero, so sessions start short.' : ''} Source: ${cite('who-activity-2020')}.`,
    );
    weekly(
      first
        ? 'Strength session: 20 min, bodyweight (squats, push-ups, rows)'
        : 'Strength session 1 (full body)',
      ref,
      'Start small, increase gradually — about 10 % more a week at most.',
    );
    weekly(
      first ? 'Strength session: 20 min, bodyweight' : 'Strength session 2 (full body)',
      ref,
      'Two days a week meets the WHO guideline.',
    );
  }

  if (goals.has('stamina') || status('activity-aerobic') === 'below') {
    const ref = milestone(
      'Build up to 150 active minutes a week',
      8,
      16,
      `WHO: 150–300 min of moderate activity a week; build up by about 10 % a week. Source: ${cite('who-activity-2020')}.`,
    );
    weekly(
      'Three brisk walks of 20 minutes',
      ref,
      'Brisk walking counts as moderate activity — the easiest place to start.',
    );
  }

  if (
    goals.has('better_sleep') ||
    status('sleep-duration') === 'below' ||
    status('sleep-duration') === 'close'
  ) {
    const sleepHabit = active.find((h) => h.measure === 'sleep_hours');
    milestone(
      'Sleep 7+ hours on most nights for 4 weeks',
      4,
      4,
      `Adults need 7+ hours regularly. Source: ${cite('aasm-sleep-2015')}.`,
    );
    if (
      sleepHabit?.target_value &&
      sleepHabit.target_value < 7 &&
      sleepChangeAllowed(sleepHabit.target_value, 7)
    ) {
      items.push({
        id: `u${items.length + 1}`,
        kind: 'habit.update',
        habitId: sleepHabit.id,
        title: sleepHabit.title,
        selected: true,
        reason: `Sleep target ${sleepHabit.target_value} → 7 h (a sleep target only ever goes up).`,
        changes: { target_value: 7 },
      });
    }
    habit(
      'Wind down: screens off 30 min before bed',
      'Screens off 30 min before bed',
      'Screens off 10 min before bed',
      'A steady wind-down makes the 7 hours easier.',
      'WIL',
    );
  }

  if (goals.has('fat_loss') && weightKg) {
    // Conservative: 0.5 % of body weight a week for 8 weeks, never faster than the safe rate.
    const target = Math.round(weightKg * (1 - 0.005 * 8) * 2) / 2;
    const safe = earliestSafeDate(weightKg, target, today);
    const date = safe > addDays(today, 56) ? safe : addDays(today, 56);
    milestone(
      `Reach ${target} kg (from ${weightKg} kg), slowly and safely`,
      8,
      8,
      'About 0.5 % of body weight a week — well within the safe rate, so muscle and energy are kept.',
      {
        target_type: 'metric',
        target_value: target,
        current_source: {
          kind: 'body_metric',
          metric: 'weight',
          direction: 'down',
          start_value: weightKg,
        },
        target_date: date,
      },
    );
    habit(
      'Half the plate vegetables at lunch and dinner',
      'Half plate vegetables at both main meals',
      'Vegetables at one meal',
      `A balanced Indian plate. Source: ${cite('icmr-nin-2024')}.`,
    );
  }

  if (goals.has('strength') || goals.has('fat_loss')) {
    habit(
      'Dal, chana, paneer or curd at every main meal',
      'Protein at every main meal',
      'Protein at one meal',
      `Cereals plus pulses cover protein for most people. Source: ${cite('icmr-nin-2024')}.`,
    );
  }

  if (goals.has('less_stress')) {
    const ref = milestone(
      'A calmer routine for 4 weeks',
      4,
      4,
      `Sleep, movement and time with people you trust help wellbeing. Source: ${cite('who-mental-facts')}.`,
    );
    weekly('One evening walk with no phone', ref, 'Movement plus a break from screens.', 'WIL');
  }
  return items;
}
