import { db as defaultDb, type AscendDB } from '@/core/db/db';
import { logError } from '@/core/errorLog';
import { recordAction } from '@/core/pipeline';
import { addDays } from '@/core/time';
import type { PlannerState } from './analyze';
import { planMilestoneWeek } from './followups';
import { jobSuggestion } from './jobs';
import { knownCapacity, matchTemplate } from './analyze';
import { loadPlannerState } from './state';
import type { ProposalItem } from './types';

/** Weekly quests per week across all goals (SPEC 4.5: 3–5 concrete steps). */
export const MAX_WEEKLY = 5;

/**
 * Next week's quests (SPEC 6.3 step 5): last week's unfinished quests carried over first (if
 * their goal is still active), then the next steps for each active milestone — at most 5.
 */
export function planWeek(state: PlannerState): ProposalItem[] {
  const prevWeek = addDays(state.weekStart, -7);
  const activeMainQuests = new Set(
    state.mainQuests.filter((q) => q.status === 'active').map((q) => q.id),
  );
  // A milestone only counts while its main quest is active too (pausing a goal pauses its work).
  const activeMilestones = new Set(
    state.milestones
      .filter((m) => m.status === 'active' && activeMainQuests.has(m.main_quest_id))
      .map((m) => m.id),
  );
  const alreadyCarried = new Set(state.quests.map((q) => q.carried_over_from).filter(Boolean));
  const items: ProposalItem[] = [];

  for (const q of state.quests) {
    if (q.type !== 'weekly' || q.week_start !== prevWeek || q.deleted_at !== null) continue;
    if (q.status !== 'active' && q.status !== 'not_done') continue;
    if (alreadyCarried.has(q.id)) continue;
    const linkOk =
      q.linked_goal_type === 'milestone'
        ? activeMilestones.has(q.linked_goal_id ?? '')
        : q.linked_goal_type === 'main_quest'
          ? activeMainQuests.has(q.linked_goal_id ?? '')
          : true;
    if (!linkOk || !q.linked_goal_type || !q.linked_goal_id) continue;
    items.push({
      id: `c${items.length + 1}`,
      kind: 'quest.create',
      selected: true,
      reason: 'Not finished last week — carried over.',
      data: {
        type: 'weekly',
        title: q.title,
        stat: q.stat,
        difficulty: q.difficulty,
        week_start: state.weekStart,
        linked_goal_type: q.linked_goal_type === 'milestone' ? 'milestone' : 'main_quest',
        linked_goal_id: q.linked_goal_id,
        carried_over_from: q.id,
        ...(q.skill_ids.length > 0 ? { skill_ids: [...q.skill_ids] } : {}),
      },
    });
  }

  const titles = new Set(items.map((i) => (i.kind === 'quest.create' ? i.data.title : '')));
  for (const goal of state.mainQuests.filter((q) => q.status === 'active')) {
    const milestone = state.milestones
      .filter((m) => m.main_quest_id === goal.id && m.status === 'active')
      .sort((a, b) => a.order - b.order)[0];
    if (!milestone) continue;
    for (const item of planMilestoneWeek(state, milestone, goal, `${goal.id.slice(0, 4)}-`)) {
      if (item.kind === 'quest.create' && titles.has(item.data.title)) continue;
      items.push(item);
    }
  }
  // The job stats add one step to an active job-search goal (task 9.5), e.g. a mock interview.
  const suggestion = jobSuggestion(state.jobStats);
  if (suggestion && !titles.has(suggestion.title)) {
    for (const goal of state.mainQuests.filter((q) => q.status === 'active')) {
      if (matchTemplate(goal.title, goal.planner_context).id !== 'jobs') continue;
      const milestone = state.milestones
        .filter((m) => m.main_quest_id === goal.id && m.status === 'active')
        .sort((a, b) => a.order - b.order)[0];
      if (!milestone) continue;
      const taken = state.quests.some(
        (q) =>
          q.deleted_at === null &&
          q.type === 'weekly' &&
          q.week_start === state.weekStart &&
          q.title === suggestion.title,
      );
      if (taken) break;
      items.splice(Math.min(items.length, MAX_WEEKLY - 1), 0, {
        id: 'job1',
        kind: 'quest.create',
        selected: true,
        reason: suggestion.reason,
        data: {
          type: 'weekly',
          title: suggestion.title,
          stat: goal.stat,
          difficulty: 'normal',
          week_start: state.weekStart,
          linked_goal_type: 'milestone',
          linked_goal_id: milestone.id,
          carried_over_from: null,
        },
      });
      break;
    }
  }
  return items.slice(0, weeklyLimit(state));
}

/** 5 a week — fewer when the learned real capacity is clearly below what's asked (SPEC 6.7 A). */
export function weeklyLimit(state: PlannerState): number {
  const c = knownCapacity(state);
  if (!c) return MAX_WEEKLY;
  return c.ratio < 0.6 ? 3 : c.ratio < 0.8 ? 4 : MAX_WEEKLY;
}

/**
 * Runs once per week (on the first day the app is opened in that week): plans the week and
 * applies it straight away, with Undo (SPEC 4.5 — an empty week helps nobody).
 */
export async function runWeeklyPlan(database: AscendDB = defaultDb): Promise<void> {
  try {
    const profile = await database.profile.get('profile');
    if (!profile?.onboarded_at) return;
    const state = await loadPlannerState(database);
    if (profile.start_day && state.today < profile.start_day) return;
    await recordAction(
      {
        type: 'plan.weekly',
        source: 'planner',
        payload: { week_start: state.weekStart, items: planWeek(state) },
      },
      { db: database },
    );
  } catch (error) {
    logError(error, 'weekly-plan');
  }
}
