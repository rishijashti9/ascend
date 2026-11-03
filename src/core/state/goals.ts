import { loadExpanded } from '@/core/compaction/expanded';
import {
  focusGoalOfWeek,
  mainQuestForecast,
  milestoneForecast,
  milestoneStart,
  type FocusGoal,
  type Forecast,
} from '@/core/adaptive/goals';
import { currentTimeZone, dayOf, nowMs } from '@/core/time';
import { createStore, useStore } from 'zustand';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import type { Dream, MainQuest, Milestone, PlanHistory, PlanProposal } from '@/core/db/types';
import {
  dreamProgress,
  mainQuestProgress,
  milestoneProgress,
  type MilestoneProgress,
} from '@/core/engine/goals';
import { logError } from '@/core/errorLog';
import { subscribeAll } from '@/core/pipeline';

/** Dreams → main quests → milestones with their computed progress (SPEC 5, 6.6). */
export interface GoalsState {
  status: 'loading' | 'ready';
  dreams: Dream[];
  mainQuests: MainQuest[];
  milestones: Milestone[];
  milestoneProgress: Record<string, MilestoneProgress>;
  /** Pace forecasts (SPEC 6.7 A): active milestones and main quests. */
  forecasts: Record<string, Forecast | null>;
  /** This week's focus goal (feeds the weekly plan and weekly review). */
  focusGoal: FocusGoal | null;
  mainQuestProgress: Record<string, number>;
  dreamProgress: Record<string, number>;
  /** Planner proposals waiting for review, newest first. */
  proposals: PlanProposal[];
  /** Plan history (applied plans, newest first) — for "what changed and why" and Undo. */
  history: PlanHistory[];
}

export const goalsStore = createStore<GoalsState>(() => ({
  status: 'loading',
  dreams: [],
  mainQuests: [],
  milestones: [],
  milestoneProgress: {},
  forecasts: {},
  focusGoal: null,
  mainQuestProgress: {},
  dreamProgress: {},
  proposals: [],
  history: [],
}));

export function useGoals<T>(selector: (state: GoalsState) => T): T {
  return useStore(goalsStore, selector);
}

const live = <T extends { deleted_at: string | null }>(rows: T[]) =>
  rows.filter((r) => r.deleted_at === null);
const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

export async function loadGoals(database: AscendDB = defaultDb): Promise<void> {
  try {
    const tables = [
      'dreams',
      'main_quests',
      'milestones',
      'habits',
      'quests',
      'quest_instances',
      'body_logs',
      'job_applications',
      'focus_sessions',
      'plan_proposals',
      'plan_history',
      'summaries',
    ] as const;
    const data = await database.transaction('r', [...tables], async () => ({
      dreams: live(await database.dreams.toArray()).sort(byOrder),
      mainQuests: live(await database.main_quests.toArray()).sort(byOrder),
      milestones: live(await database.milestones.toArray()).sort(byOrder),
      habits: await database.habits.toArray(),
      quests: await database.quests.toArray(),
      instances: [
        ...(await database.quest_instances.toArray()),
        ...(await loadExpanded(database)).instances,
      ],
      bodyLogs: await database.body_logs.toArray(),
      jobs: await database.job_applications.toArray(),
      sessions: [
        ...(await database.focus_sessions.toArray()),
        ...(await loadExpanded(database)).sessions,
      ],
      proposals: (await database.plan_proposals.where('status').equals('pending').toArray())
        .filter((p) => p.deleted_at === null)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
      history: live(await database.plan_history.toArray()).sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      ),
    }));

    const mp = Object.fromEntries(data.milestones.map((m) => [m.id, milestoneProgress(m, data)]));
    const qp = Object.fromEntries(
      data.mainQuests.map((q) => [q.id, mainQuestProgress(q, data.milestones)]),
    );
    const dp = Object.fromEntries(
      data.dreams.map((d) => [d.id, dreamProgress(d, data.mainQuests, (id) => qp[id] ?? 0)]),
    );
    const settings = await database.settings.get('settings');
    const today = dayOf(nowMs(), currentTimeZone(), settings?.day_start_hour ?? 3);
    const dayOfIso = (iso: string) =>
      dayOf(Date.parse(iso), currentTimeZone(), settings?.day_start_hour ?? 3);
    const forecasts: Record<string, Forecast | null> = {};
    for (const q of data.mainQuests) {
      if (q.status !== 'active') continue;
      forecasts[q.id] = mainQuestForecast(
        q,
        data.milestones,
        (id) => mp[id]?.progress ?? 0,
        today,
        dayOfIso,
      );
      const active = data.milestones.find((m) => m.main_quest_id === q.id && m.status === 'active');
      if (active)
        forecasts[active.id] = milestoneForecast(
          active,
          mp[active.id]?.progress ?? 0,
          milestoneStart(active, data.milestones, dayOfIso),
          today,
        );
    }
    const focusGoal = focusGoalOfWeek(
      data.mainQuests,
      new Map(Object.entries(forecasts)),
      (id) => qp[id] ?? 0,
      today,
    );
    goalsStore.setState({
      status: 'ready',
      forecasts,
      focusGoal,
      dreams: data.dreams,
      mainQuests: data.mainQuests,
      milestones: data.milestones,
      milestoneProgress: mp,
      mainQuestProgress: qp,
      dreamProgress: dp,
      proposals: data.proposals,
      history: data.history,
    });
  } catch (error) {
    logError(error, 'goals.load');
  }
}

/** Initial load, then reload after every action. */
export async function startGoals(database: AscendDB = defaultDb): Promise<() => void> {
  const unsubscribe = subscribeAll(() => loadGoals(database));
  await loadGoals(database);
  return unsubscribe;
}
