import { createStore, useStore } from 'zustand';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import type { Skill, SkillEvidence, SkillTrack } from '@/core/db/types';
import {
  skillContributions,
  skillProgress,
  type Contribution,
  type SkillInput,
  type SkillProgress,
} from '@/core/engine/skills';
import { logError } from '@/core/errorLog';
import { subscribeAll, type DomainEvent } from '@/core/pipeline';

/** A branch of the tree: its skills in order (archived ones listed separately). */
export interface Branch {
  name: string;
  track: SkillTrack;
  skills: Skill[];
}

export interface SkillsState {
  status: 'loading' | 'ready';
  /** Live skills (active and archived). */
  skills: Skill[];
  branches: Branch[];
  progress: Map<string, SkillProgress>;
  contributions: Contribution[];
  /** Finished projects per skill, newest first. */
  projects: Map<string, SkillEvidence[]>;
}

export const skillsStore = createStore<SkillsState>(() => ({
  status: 'loading',
  skills: [],
  branches: [],
  progress: new Map(),
  contributions: [],
  projects: new Map(),
}));

export function useSkills<T>(selector: (state: SkillsState) => T): T {
  return useStore(skillsStore, selector);
}

/** Branches in the order of their first skill; skills by order. */
export function groupBranches(skills: readonly Skill[]): Branch[] {
  const sorted = [...skills].sort((a, b) => a.order - b.order);
  const byName = new Map<string, Branch>();
  for (const s of sorted) {
    const b = byName.get(s.branch) ?? { name: s.branch, track: s.track ?? 'other', skills: [] };
    b.skills.push(s);
    byName.set(s.branch, b);
  }
  return [...byName.values()];
}

/** Reads only what can count for a skill: tagged sessions and quests that carry skills. */
export async function readSkillInput(database: AscendDB): Promise<SkillInput> {
  const quests = (await database.quests.toArray()).filter(
    (q) => q.deleted_at === null && q.skill_ids.length > 0,
  );
  const questIds = new Set(quests.map((q) => q.id));
  const instances = await database.quest_instances
    .filter((i) =>
      i.source_type === 'habit'
        ? (i.skill_ids_snapshot?.length ?? 0) > 0
        : questIds.has(i.source_id),
    )
    .toArray();
  const instanceIds = new Set(instances.map((i) => i.id));
  // An untagged session linked to a quest already counts through that quest's minutes.
  const sessions = await database.focus_sessions.filter((s) => s.skill_ids.length > 0).toArray();
  const entries = await database.progress_entries
    .filter((e) => instanceIds.has(e.quest_instance_id))
    .toArray();
  return {
    skills: await database.skills.toArray(),
    evidence: await database.skill_evidence.toArray(),
    sessions,
    instances,
    entries,
    quests,
  };
}

export async function loadSkills(database: AscendDB = defaultDb): Promise<void> {
  try {
    const input = await readSkillInput(database);
    const skills = input.skills.filter((s) => s.deleted_at === null);
    const projects = new Map<string, SkillEvidence[]>();
    for (const e of input.evidence) {
      if (e.deleted_at !== null || e.type !== 'project') continue;
      projects.set(e.skill_id, [...(projects.get(e.skill_id) ?? []), e]);
    }
    for (const list of projects.values()) list.sort((a, b) => b.day.localeCompare(a.day));
    skillsStore.setState({
      status: 'ready',
      skills,
      branches: groupBranches(skills),
      progress: skillProgress(input),
      contributions: skillContributions(input),
      projects,
    });
  } catch (error) {
    logError(error, 'skills.load');
  }
}

/** Events that can change a skill's minutes, projects or the tree itself. */
const RELEVANT = new Set<DomainEvent['type']>([
  'SkillChanged',
  'ProgressAdded',
  'QuestCompleted',
  'QuestUncompleted',
  'SessionFinished',
  'HabitChanged',
  'QuestChanged',
  'DayChanged',
  'DataSynced',
  'DataImported',
  'DataReset',
]);

export async function startSkills(database: AscendDB = defaultDb): Promise<() => void> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsubscribe = subscribeAll((event) => {
    if (!RELEVANT.has(event.type)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void loadSkills(database), 150);
  });
  await loadSkills(database);
  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}
