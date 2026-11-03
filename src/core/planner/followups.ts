import type { Dream, MainQuest, Milestone } from '@/core/db/types';
import { analyze, matchTemplate, type PlannerState } from './analyze';
import { applicationCount } from './jobs';
import { itemList, linkedTo, weeklyCount, weeklyIdeas } from './plan';
import type { ProposalItem } from './types';

/**
 * Follow-up planning (SPEC 6.3 step 5): a milestone's week, what to do with linked items when
 * a goal's status changes, and unlocking the next milestone.
 */

/** Weekly quests for one milestone's week (a new/changed milestone, or the next one unlocking). */
export function planMilestoneWeek(
  state: PlannerState,
  milestone: Milestone,
  goal: MainQuest,
  idsPrefix = '',
): ProposalItem[] {
  const already = state.quests.some(
    (q) =>
      q.deleted_at === null &&
      q.type === 'weekly' &&
      q.week_start === state.weekStart &&
      q.linked_goal_type === 'milestone' &&
      q.linked_goal_id === milestone.id,
  );
  if (already) return [];
  const template = matchTemplate(goal.title, goal.planner_context);
  const built = template.build(goal.planner_context, {
    goalTitle: goal.title,
    today: state.today,
    deadline: goal.target_date,
  });
  const ideas = weeklyIdeas(milestone.title, built.milestones);
  const a = analyze(state);
  const n = Math.min(weeklyCount(built, a.completionRate, a.capacityRatio ?? null), ideas.length);
  return ideas.slice(0, n).map((title, i) => ({
    id: `${idsPrefix}w${i + 1}`,
    kind: 'quest.create',
    selected: true,
    reason: `This week, toward “${milestone.title}”.`,
    data: {
      type: 'weekly',
      title,
      stat: goal.stat,
      difficulty: 'normal',
      week_start: state.weekStart,
      linked_goal_type: 'milestone',
      linked_goal_id: milestone.id,
      carried_over_from: null,
      ...applicationCount(title),
    },
  }));
}

/**
 * When a goal is paused, resumed, finished or archived, propose what to do with its linked
 * daily quests and this week's weekly quests, so nothing is left orphaned (SPEC 6.3).
 */
export function planStatusChange(
  state: PlannerState,
  goal: { type: 'dream'; record: Dream } | { type: 'main_quest'; record: MainQuest },
  status: 'active' | 'paused' | 'done' | 'archived',
  dreamQuests: readonly MainQuest[] = [],
): ProposalItem[] {
  const { items, add } = itemList();
  const mainQuests =
    goal.type === 'main_quest'
      ? [goal.record]
      : dreamQuests.filter((q) => q.dream_id === goal.record.id && q.deleted_at === null);

  for (const mq of mainQuests) {
    if (goal.type === 'dream') {
      const mqTarget = status === 'active' ? 'active' : status;
      if (
        (status === 'active' && mq.status === 'paused') ||
        (status !== 'active' && mq.status === 'active')
      ) {
        add({
          kind: 'mainQuest.setStatus',
          mainQuestId: mq.id,
          title: mq.title,
          status: mqTarget,
          selected: true,
          reason: `Part of this dream — ${status === 'active' ? 'resume' : status === 'paused' ? 'pause' : status === 'done' ? 'finish' : 'archive'} it too.`,
        });
      }
    }
    const linked = linkedTo(state, mq.id);
    for (const h of linked.habits) {
      if (status === 'active' && h.status === 'paused') {
        add({
          kind: 'habit.restore',
          habitId: h.id,
          title: h.title,
          selected: true,
          reason: `Bring “${h.title}” back.`,
        });
      } else if (status === 'paused' && h.status === 'active') {
        add({
          kind: 'habit.pause',
          habitId: h.id,
          title: h.title,
          selected: true,
          reason: `Pause “${h.title}” while ${mq.title} is paused (untick to keep it).`,
        });
      } else if ((status === 'done' || status === 'archived') && h.status !== 'archived') {
        add({
          kind: 'habit.archive',
          habitId: h.id,
          title: h.title,
          selected: true,
          reason: `Archive “${h.title}” — its goal is ${status === 'done' ? 'finished' : 'archived'} (untick to keep it).`,
        });
      }
    }
    if (status !== 'active') {
      for (const q of linked.weekly) {
        add({
          kind: 'quest.archive',
          questId: q.id,
          title: q.title,
          selected: true,
          reason: `This week’s quest for ${mq.title} — archive it.`,
        });
      }
    }
  }
  return items;
}

/** After a milestone is done: start the next upcoming one and plan its week (SPEC 6.3 step 5). */
export function planNextMilestone(
  state: PlannerState,
  done: Milestone,
  goal: MainQuest,
): ProposalItem[] {
  const next = state.milestones
    .filter(
      (m) =>
        m.main_quest_id === done.main_quest_id && m.deleted_at === null && m.status === 'upcoming',
    )
    .sort((a, b) => a.order - b.order)[0];
  if (!next) return [];
  return [
    {
      id: 'n1',
      kind: 'milestone.setStatus',
      milestoneId: next.id,
      title: next.title,
      status: 'active',
      selected: true,
      reason: `Next milestone after “${done.title}”.`,
    },
    ...planMilestoneWeek(state, { ...next, status: 'active' }, goal, 'n'),
  ];
}
