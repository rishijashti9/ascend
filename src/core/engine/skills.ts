import { GAME } from '@/config/game';
import type {
  DayString,
  FocusSession,
  ProgressEntry,
  Quest,
  QuestInstance,
  Skill,
  SkillEvidence,
  SkillTrack,
} from '@/core/db/types';
import { isDone, progressValue } from './progress';

/**
 * Skill levels (SPEC 6.5, pure). A skill's level 0–5 is computed from what really happened —
 * never stored — unless Rishi sets it by hand:
 * - focus sessions tagged with the skill (a session linked to a quest without its own tags
 *   counts for that quest's skills);
 * - quests linked to the skill: a minutes quest counts its logged minutes, any other finished
 *   quest counts as `questCreditMinutes`;
 * - finished projects (stored evidence with a note / link), which the top levels require.
 * Minutes shared by several skills are split evenly, so every minute counts once.
 */

export interface SkillInput {
  skills: readonly Skill[];
  evidence: readonly SkillEvidence[];
  sessions: readonly Pick<
    FocusSession,
    'id' | 'quest_instance_id' | 'skill_ids' | 'actual_min' | 'ended_at' | 'day' | 'deleted_at'
  >[];
  instances: readonly Pick<
    QuestInstance,
    | 'id'
    | 'source_type'
    | 'source_id'
    | 'day'
    | 'status'
    | 'measure_snapshot'
    | 'skill_ids_snapshot'
    | 'deleted_at'
  >[];
  entries: readonly Pick<
    ProgressEntry,
    'quest_instance_id' | 'source' | 'amount' | 'occurred_at' | 'deleted_at'
  >[];
  quests: readonly Pick<Quest, 'id' | 'skill_ids' | 'deleted_at'>[];
}

/** One piece of practice credited to one skill. */
export interface Contribution {
  skillId: string;
  day: DayString;
  minutes: number;
  kind: 'session' | 'quest' | 'project';
  refId: string;
}

export interface SkillProgress {
  skillId: string;
  minutes: number;
  questsDone: number;
  projects: number;
  computedLevel: number;
  /** The level shown: the manual override when set, otherwise the computed one. */
  level: number;
  overridden: boolean;
  /** What the next computed level needs, or null at level 5. */
  next: { level: number; hours: number; projects: number } | null;
}

export const MAX_SKILL_LEVEL = 5;

/** Computed level from total minutes and finished projects. */
export function levelFor(minutes: number, projects: number): number {
  const { levelHours, levelProjects } = GAME.skills;
  let level = 0;
  for (let i = 0; i < levelHours.length; i++) {
    if (minutes >= (levelHours[i] ?? Infinity) * 60 && projects >= (levelProjects[i] ?? 0)) {
      level = i + 1;
    } else break;
  }
  return level;
}

function live<T extends { deleted_at: string | null }>(rows: readonly T[]): T[] {
  return rows.filter((r) => r.deleted_at === null);
}

/** Every credited piece of practice, split per skill. Unknown or deleted skills are ignored. */
export function skillContributions(input: SkillInput): Contribution[] {
  const known = new Set(live(input.skills).map((s) => s.id));
  const out: Contribution[] = [];
  const credit = (
    ids: readonly string[],
    minutes: number,
    day: DayString,
    kind: Contribution['kind'],
    refId: string,
  ) => {
    const targets = [...new Set(ids)].filter((id) => known.has(id));
    if (targets.length === 0) return;
    for (const skillId of targets) {
      out.push({ skillId, day, minutes: minutes / targets.length, kind, refId });
    }
  };

  const questSkills = new Map(live(input.quests).map((q) => [q.id, q.skill_ids]));
  const instanceSkills = (i: SkillInput['instances'][number]): readonly string[] =>
    i.source_type === 'habit' ? (i.skill_ids_snapshot ?? []) : (questSkills.get(i.source_id) ?? []);

  // Focus sessions with their own skill tags; their minutes leave the linked quest's share.
  const taggedMinutesByInstance = new Map<string, number>();
  for (const s of live(input.sessions)) {
    if (s.ended_at === null || s.actual_min <= 0 || s.skill_ids.length === 0) continue;
    credit(s.skill_ids, s.actual_min, s.day, 'session', s.id);
    if (s.quest_instance_id) {
      const id = s.quest_instance_id;
      taggedMinutesByInstance.set(id, (taggedMinutesByInstance.get(id) ?? 0) + s.actual_min);
    }
  }

  const entriesByInstance = new Map<string, SkillInput['entries'][number][]>();
  for (const e of input.entries) {
    const list = entriesByInstance.get(e.quest_instance_id) ?? [];
    list.push(e);
    entriesByInstance.set(e.quest_instance_id, list);
  }

  for (const i of live(input.instances)) {
    const ids = instanceSkills(i);
    if (ids.length === 0) continue;
    if (i.measure_snapshot === 'minutes') {
      const logged = progressValue('minutes', entriesByInstance.get(i.id) ?? []);
      const own = Math.max(0, logged - (taggedMinutesByInstance.get(i.id) ?? 0));
      if (own > 0) credit(ids, own, i.day, 'quest', i.id);
    } else if (isDone(i.status)) {
      credit(ids, GAME.skills.questCreditMinutes, i.day, 'quest', i.id);
    }
  }

  for (const e of live(input.evidence)) {
    credit(
      [e.skill_id],
      Math.max(0, e.minutes),
      e.day,
      e.type === 'project' ? 'project' : 'session',
      e.id,
    );
  }
  return out;
}

/** Level and totals for every live skill. */
export function skillProgress(input: SkillInput): Map<string, SkillProgress> {
  const contributions = skillContributions(input);
  const doneQuests = new Set(
    live(input.instances)
      .filter((i) => isDone(i.status))
      .map((i) => i.id),
  );
  const result = new Map<string, SkillProgress>();
  for (const skill of live(input.skills)) {
    const mine = contributions.filter((c) => c.skillId === skill.id);
    const minutes = mine.reduce((sum, c) => sum + c.minutes, 0);
    const projects = mine.filter((c) => c.kind === 'project').length;
    const questsDone = new Set(
      mine.filter((c) => c.kind === 'quest' && doneQuests.has(c.refId)).map((c) => c.refId),
    ).size;
    const computedLevel = levelFor(minutes, projects);
    const override = skill.manual_level_override;
    const nextLevel = computedLevel + 1;
    result.set(skill.id, {
      skillId: skill.id,
      minutes,
      questsDone,
      projects,
      computedLevel,
      level: override ?? computedLevel,
      overridden: override !== null,
      next:
        nextLevel > MAX_SKILL_LEVEL
          ? null
          : {
              level: nextLevel,
              hours: GAME.skills.levelHours[nextLevel - 1] ?? 0,
              projects: GAME.skills.levelProjects[nextLevel - 1] ?? 0,
            },
    });
  }
  return result;
}

/** A project's title is the first line of its note; the rest is the note. */
export function projectTitle(e: Pick<SkillEvidence, 'note'>): string {
  return (e.note ?? '').split('\n')[0] || 'Project';
}

export function projectNote(e: Pick<SkillEvidence, 'note'>): string | null {
  const rest = (e.note ?? '').split('\n').slice(1).join('\n').trim();
  return rest || null;
}

export interface TrackBalance {
  minutes: Record<SkillTrack, number>;
  /** AI & Robotics ÷ (AI & Robotics + Games), or null when neither has minutes. */
  aiShare: number | null;
}

/** Study minutes per track between two days (inclusive) — the 70/30 balance. */
export function trackBalance(
  contributions: readonly Contribution[],
  skills: readonly Pick<Skill, 'id' | 'track'>[],
  from: DayString,
  to: DayString,
): TrackBalance {
  const trackOf = new Map(skills.map((s) => [s.id, s.track ?? 'other']));
  const minutes: Record<SkillTrack, number> = { ai_robotics: 0, games: 0, other: 0 };
  for (const c of contributions) {
    if (c.day < from || c.day > to) continue;
    minutes[trackOf.get(c.skillId) ?? 'other'] += c.minutes;
  }
  const both = minutes.ai_robotics + minutes.games;
  return { minutes, aiShare: both > 0 ? minutes.ai_robotics / both : null };
}
