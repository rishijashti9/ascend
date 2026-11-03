import type { GoalType, Habit, MainQuest, Milestone } from '@/core/db/types';
import { addDays, diffDays } from '@/core/time';
import {
  activeHabits,
  analyze,
  DAILY_LOAD_LIMIT_MIN,
  estimateMinutes,
  matchTemplate,
  tokens,
  type PlannerState,
} from './analyze';
import type { Answers, Plan, PlanMilestone, PlanTemplate, ProposalItem } from './types';
import { applicationCount } from './jobs';

/**
 * Plans (SPEC 6.3 step 3): milestones with dates, this week's weekly quests and new daily
 * quests (each with a minimum version), sized to the real available time. Nothing is written
 * here — the result is a proposal Rishi approves.
 */

type NewItem = ProposalItem extends infer T
  ? T extends ProposalItem
    ? Omit<T, 'id'>
    : never
  : never;

export function itemList() {
  const items: ProposalItem[] = [];
  return {
    items,
    add(item: NewItem): string {
      const id = `i${items.length + 1}`;
      items.push({ ...item, id } as ProposalItem);
      return id;
    },
  };
}

const lower = (s: string) => s.trim().toLowerCase();
const capAt = (day: string, limit: string | null) => (limit && day > limit ? limit : day);
const STOP = new Set([
  'and',
  'the',
  'for',
  'with',
  'from',
  'into',
  'your',
  'study',
  'daily',
  'core',
  'practice',
  'phone',
  'free',
]);

/** An existing active habit that already covers this (shares a meaningful word). */
function similarHabit(
  habits: readonly Habit[],
  title: string,
  goalTitle: string,
): Habit | undefined {
  const words = new Set(
    [...tokens(title), ...tokens(goalTitle)].filter((w) => w.length >= 4 && !STOP.has(w)),
  );
  return habits.find((h) => tokens(h.title).some((w) => words.has(w)));
}

/** Habits and open weekly quests linked to a main quest (directly or via its milestones). */
export function linkedTo(state: PlannerState, mainQuestId: string) {
  const milestoneIds = new Set(
    state.milestones.filter((m) => m.main_quest_id === mainQuestId).map((m) => m.id),
  );
  const isLinked = (x: { linked_goal_type: GoalType | null; linked_goal_id: string | null }) =>
    (x.linked_goal_type === 'main_quest' && x.linked_goal_id === mainQuestId) ||
    (x.linked_goal_type === 'milestone' &&
      x.linked_goal_id !== null &&
      milestoneIds.has(x.linked_goal_id));
  return {
    habits: state.habits.filter((h) => h.deleted_at === null && isLinked(h)),
    weekly: state.quests.filter(
      (q) =>
        q.deleted_at === null &&
        q.type === 'weekly' &&
        q.status === 'active' &&
        q.week_start === state.weekStart &&
        isLinked(q),
    ),
  };
}

export function weeklyCount(
  template: { weeklyPerWeek: number },
  completionRate: number | null,
): number {
  // A shaky recent record means a lighter week (SPEC 6.3: plans fit real life).
  return completionRate !== null && completionRate < 0.6
    ? Math.min(2, template.weeklyPerWeek)
    : template.weeklyPerWeek;
}

/** Weekly quest ideas for a milestone: from its template if it came from one. */
export function weeklyIdeas(
  title: string,
  templateMilestones: readonly PlanMilestone[],
): readonly string[] {
  const match = templateMilestones.find((m) => lower(m.title) === lower(title));
  return match?.weekly.length
    ? match.weekly
    : [`Work session toward “${title}”`, `Review progress on “${title}” and plan the next step`];
}

export function planMainQuest(
  state: PlannerState,
  goal: MainQuest,
  answers: Answers,
  template: PlanTemplate = matchTemplate(goal.title, { ...goal.planner_context, ...answers }),
): Plan {
  const all = { ...goal.planner_context, ...answers };
  const analysis = analyze(state, goal);
  const deadline =
    goal.target_date ?? (typeof all.deadline === 'string' && all.deadline ? all.deadline : null);
  const built = template.build(all, { goalTitle: goal.title, today: state.today, deadline });
  const { items, add } = itemList();

  // ---- Milestones with dates that fit the deadline ----
  const existing = state.milestones.filter(
    (m) => m.main_quest_id === goal.id && m.deleted_at === null && m.status !== 'archived',
  );
  const existingTitles = new Set(existing.map((m) => lower(m.title)));
  const fresh = built.milestones.filter((m) => !existingTitles.has(lower(m.title)));
  const totalWeeks = fresh.reduce((sum, m) => sum + m.weeks, 0);
  const availableWeeks = deadline ? Math.max(1, diffDays(state.today, deadline) / 7) : totalWeeks;
  const factor = deadline && totalWeeks > availableWeeks ? availableWeeks / totalWeeks : 1;
  if (factor < 0.6) {
    analysis.conflicts.push(
      `This plan usually takes ${totalWeeks} weeks and the deadline is in ${Math.round(availableWeeks)} — milestones are squeezed; consider a later deadline or a smaller scope.`,
    );
  }

  let activeMilestone: Pick<Milestone, 'id' | 'title'> | undefined = existing.find(
    (m) => m.status === 'active',
  );
  let activeRef: string | null = activeMilestone?.id ?? null;
  let weeksSoFar = 0;
  for (const m of fresh) {
    weeksSoFar += Math.max(1, m.weeks * factor);
    const becomesActive = activeRef === null;
    const id = add({
      kind: 'milestone.create',
      selected: true,
      reason: becomesActive
        ? 'Your first step — weekly quests start here.'
        : `About ${Math.round(m.weeks * factor)} weeks.`,
      data: {
        main_quest_id: goal.id,
        title: m.title,
        size_weight: m.weight,
        target_type: m.target_type,
        target_value: m.target_value,
        current_source: m.current_source,
        estimated_weekly_quests: m.estimated_weekly_quests,
        // Never past the deadline, even when every step is squeezed to its 1-week minimum.
        target_date: capAt(addDays(state.today, Math.round(weeksSoFar * 7)), deadline),
        status: becomesActive ? 'active' : 'upcoming',
      },
    });
    if (becomesActive) {
      activeRef = `ref:${id}`;
      activeMilestone = { id: activeRef, title: m.title };
    }
  }

  // ---- This week's weekly quests (only if none are planned yet) ----
  const linked = linkedTo(state, goal.id);
  if (activeMilestone && activeRef && linked.weekly.length === 0) {
    const ideas = weeklyIdeas(activeMilestone.title, built.milestones);
    const count = Math.min(weeklyCount(built, analysis.completionRate), ideas.length);
    for (const title of ideas.slice(0, count)) {
      add({
        kind: 'quest.create',
        selected: true,
        reason: `This week, toward “${activeMilestone.title}”.`,
        data: {
          type: 'weekly',
          title,
          stat: goal.stat,
          difficulty: 'normal',
          week_start: state.weekStart,
          linked_goal_type: 'milestone',
          linked_goal_id: activeRef,
          carried_over_from: null,
          ...applicationCount(title),
        },
      });
    }
  }

  // ---- Daily quests: reuse a similar habit (link it) or add a new one ----
  const habits = activeHabits(state);
  let addedMinutes = 0;
  for (const h of built.habits) {
    const similar = similarHabit(habits, h.title, goal.title);
    if (similar) {
      const alreadyLinked = linked.habits.some((x) => x.id === similar.id);
      if (!alreadyLinked && !similar.linked_goal_id) {
        add({
          kind: 'habit.update',
          habitId: similar.id,
          title: similar.title,
          selected: true,
          reason: `“${similar.title}” already covers this — link it to ${goal.title} instead of adding another quest.`,
          changes: { linked_goal_type: 'main_quest', linked_goal_id: goal.id },
        });
      }
      continue;
    }
    addedMinutes += (estimateMinutes(h) * (h.schedule?.length ?? 7)) / 7;
    const minText =
      h.measure === 'minutes'
        ? `${h.target_value} min (minimum ${h.min_value} min)`
        : `${h.full_version} (minimum: ${h.min_version})`;
    add({
      kind: 'habit.create',
      selected: true,
      reason: `New daily quest: ${minText}.`,
      data: {
        ...h,
        schedule: h.schedule ?? [0, 1, 2, 3, 4, 5, 6],
        linked_goal_type: 'main_quest',
        linked_goal_id: goal.id,
      },
    });
  }

  // ---- Load check: suggest trimming the biggest non-core minutes quest ----
  if (addedMinutes > 0 && analysis.dailyLoadMin + addedMinutes > DAILY_LOAD_LIMIT_MIN) {
    const biggest = habits
      .filter((h) => !h.core && h.measure === 'minutes' && (h.target_value ?? 0) >= 30)
      .sort((a, b) => (b.target_value ?? 0) - (a.target_value ?? 0))[0];
    if (biggest?.target_value) {
      const target = Math.max(15, Math.round((biggest.target_value * 0.75) / 5) * 5);
      add({
        kind: 'habit.update',
        habitId: biggest.id,
        title: biggest.title,
        selected: false,
        reason: `This adds about ${Math.round(addedMinutes)} min a day. I suggest reducing “${biggest.title}” from ${biggest.target_value} to ${target} min.`,
        changes: { target_value: target, min_value: Math.min(biggest.min_value ?? target, target) },
      });
    }
  }

  const count = (kind: ProposalItem['kind']) => items.filter((i) => i.kind === kind).length;
  const parts = [
    count('milestone.create') && `${count('milestone.create')} milestones`,
    count('quest.create') && `${count('quest.create')} weekly quests for this week`,
    count('habit.create') &&
      `${count('habit.create')} new daily quest${count('habit.create') === 1 ? '' : 's'}`,
  ].filter(Boolean);
  return {
    templateId: template.id,
    analysis,
    items,
    summary: parts.length
      ? `Plan for ${goal.title}: ${parts.join(', ')}.`
      : `${goal.title} is already planned.`,
  };
}
