import { createStore, useStore } from 'zustand';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import type { Dream, MainQuest, Milestone } from '@/core/db/types';
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
  mainQuestProgress: Record<string, number>;
  dreamProgress: Record<string, number>;
}

export const goalsStore = createStore<GoalsState>(() => ({
  status: 'loading',
  dreams: [],
  mainQuests: [],
  milestones: [],
  milestoneProgress: {},
  mainQuestProgress: {},
  dreamProgress: {},
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
    ] as const;
    const data = await database.transaction('r', [...tables], async () => ({
      dreams: live(await database.dreams.toArray()).sort(byOrder),
      mainQuests: live(await database.main_quests.toArray()).sort(byOrder),
      milestones: live(await database.milestones.toArray()).sort(byOrder),
      habits: await database.habits.toArray(),
      quests: await database.quests.toArray(),
      instances: await database.quest_instances.toArray(),
      bodyLogs: await database.body_logs.toArray(),
      jobs: await database.job_applications.toArray(),
      sessions: await database.focus_sessions.toArray(),
    }));

    const mp = Object.fromEntries(data.milestones.map((m) => [m.id, milestoneProgress(m, data)]));
    const qp = Object.fromEntries(
      data.mainQuests.map((q) => [q.id, mainQuestProgress(q, data.milestones)]),
    );
    const dp = Object.fromEntries(
      data.dreams.map((d) => [d.id, dreamProgress(d, data.mainQuests, (id) => qp[id] ?? 0)]),
    );
    goalsStore.setState({
      status: 'ready',
      dreams: data.dreams,
      mainQuests: data.mainQuests,
      milestones: data.milestones,
      milestoneProgress: mp,
      mainQuestProgress: qp,
      dreamProgress: dp,
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
