import type { MainQuest, Milestone, Skill } from '@/core/db/types';
import type { AskContext } from './provider';

/**
 * What Ask the System may send (SPEC 6.7 C): goal / skill / quest progress and completion
 * numbers — built from an explicit allow-list, so nothing else can slip in. NEVER health data
 * (sleep, weight, steps, body logs), journal text, mood or energy, or photos.
 */
export interface ContextSources {
  level: number;
  rank: string;
  streak: number;
  /** Share of daily quests done recently (0–1), or null. */
  completion: number | null;
  mainQuests: readonly Pick<MainQuest, 'id' | 'title' | 'status' | 'target_date'>[];
  milestones: readonly Pick<Milestone, 'main_quest_id' | 'title' | 'status' | 'target_date'>[];
  mainQuestProgress: Record<string, number>;
  skills: readonly Pick<Skill, 'id' | 'name' | 'status'>[];
  skillLevel: (id: string) => number;
  targetCareer: string | null;
}

/** Every key that may ever be sent — checked by a test. */
export const ALLOWED_KEYS = [
  'level',
  'rank',
  'streak_days',
  'daily_completion_pct',
  'goals',
  'skill_levels',
  'target_career',
] as const;

const clip = (s: string, n = 80) => s.slice(0, n);

export function buildAskContext(src: ContextSources): AskContext {
  const goals = src.mainQuests
    .filter((q) => q.status === 'active')
    .slice(0, 5)
    .map((q) => {
      const active = src.milestones.find((m) => m.main_quest_id === q.id && m.status === 'active');
      return [
        clip(q.title),
        Math.round((src.mainQuestProgress[q.id] ?? 0) * 100),
        q.target_date ?? '',
        active ? clip(active.title) : '',
      ].join(' | ');
    });
  const skillLevels: Record<string, number> = {};
  for (const s of src.skills.filter((x) => x.status === 'active')) {
    const level = src.skillLevel(s.id);
    if (level > 0) skillLevels[clip(s.name, 40)] = level;
  }
  const ctx: AskContext = {
    level: src.level,
    rank: src.rank,
    streak_days: src.streak,
    goals,
    skill_levels: Object.fromEntries(Object.entries(skillLevels).slice(0, 15)),
  };
  if (src.completion !== null) ctx.daily_completion_pct = Math.round(src.completion * 100);
  if (src.targetCareer) ctx.target_career = clip(src.targetCareer);
  return ctx;
}
