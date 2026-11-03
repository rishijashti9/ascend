import type { Capacity } from '@/core/adaptive/patterns';
import type { Confidence } from '@/core/adaptive/model';
import type { DayString, Skill, Stat } from '@/core/db/types';
import type { ProposalItem } from '@/core/planner/types';
import { addDays } from '@/core/time';
import type { Career, CompassSkill } from '@/data/compass/schema';
import { careerSkillGraph, matchSkillTree } from './careers';
import { pack, sourceById } from './pack';

/**
 * Career gap analysis (SPEC 6.7 B), pure: the target career's skills (and prerequisites, in
 * learning order) against the user's skill tree → what's missing, hours left, and when they'd
 * be ready at their real pace. Turned into Goal Planner milestones + this week's quests.
 */
export interface GapItem {
  skill: CompassSkill;
  /** Level the career needs (core 3, important 2, useful / prerequisite 1). */
  need: number;
  /** Level in the user's skill tree (0 if not there). */
  have: number;
  hoursLeft: number;
  importance: 0 | 1 | 2 | 3;
}

export interface Readiness {
  weeks: number | null;
  ready: DayString | null;
  /** Focused hours a week used for the forecast. */
  weeklyHours: number;
  confidence: Confidence;
  why: string;
}

export interface CareerGap {
  career: Career;
  items: GapItem[];
  /** Skills already at the level needed. */
  done: number;
  hoursLeft: number;
  readiness: Readiness;
}

/** Without learned capacity, plan with this many focused hours a week. */
export const DEFAULT_WEEKLY_HOURS = 10;
/** Share of really-done minutes that goes to career learning (the rest is body, mind…). */
const CAREER_SHARE = 0.7;

const fmtMonth = (d: DayString) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

export function careerGap(
  career: Career,
  tree: readonly Pick<Skill, 'id' | 'name' | 'status'>[],
  levelOf: (treeSkillId: string) => number,
  capacity: Capacity | null,
  today: DayString,
): CareerGap {
  const importance = new Map(career.skills.map((s) => [s.id, s.importance]));
  const matches = matchSkillTree(careerSkillGraph(career), tree, levelOf);
  const items: GapItem[] = matches.map(({ skill, level }) => {
    const imp = (importance.get(skill.id) ?? 0) as GapItem['importance'];
    const need = imp === 3 ? 3 : imp === 2 ? 2 : 1;
    const hoursLeft = level >= need ? 0 : Math.round(skill.hours * ((need - level) / need));
    return { skill, need, have: level, hoursLeft, importance: imp };
  });
  const hoursLeft = items.reduce((s, i) => s + i.hoursLeft, 0);
  const known = capacity && capacity.confidence !== 'early';
  const weeklyHours = known
    ? Math.max(2, Math.round(((capacity.doneMinutes * CAREER_SHARE) / 60) * 10) / 10)
    : DEFAULT_WEEKLY_HOURS;
  const weeks = hoursLeft > 0 ? Math.ceil(hoursLeft / weeklyHours) : 0;
  const ready = addDays(today, weeks * 7);
  const pace = known
    ? `At your real pace (about ${weeklyHours} focused hours a week)`
    : `At ${DEFAULT_WEEKLY_HOURS} focused hours a week (your real pace isn’t known yet)`;
  return {
    career,
    items,
    done: items.filter((i) => i.hoursLeft === 0).length,
    hoursLeft,
    readiness: {
      weeks,
      ready: hoursLeft > 0 ? ready : today,
      weeklyHours,
      confidence: known ? capacity.confidence : 'early',
      why:
        hoursLeft === 0
          ? 'You already have every skill this career needs at a working level.'
          : `About ${hoursLeft} hours of focused learning left. ${pace}, that’s about ${weeks} weeks — around ${fmtMonth(ready)}.`,
    },
  };
}

/** Hours of focused work one weekly quest stands for. */
const HOURS_PER_WEEKLY_QUEST = 3;
/** At most this many milestones at once (the rest are planned when these are done). */
const MAX_MILESTONES = 6;

/**
 * Goal Planner items for the gap: one milestone per missing skill (learning order, up to 6,
 * dated at the real pace) and this week's quests for the first one, from its roadmap steps.
 */
export function careerPlanItems(
  gap: CareerGap,
  mainQuestId: string,
  stat: Stat,
  today: DayString,
  weekStart: DayString,
): ProposalItem[] {
  const missing = gap.items.filter((i) => i.hoursLeft > 0).slice(0, MAX_MILESTONES);
  const items: ProposalItem[] = [];
  let weeksSoFar = 0;
  missing.forEach((g, n) => {
    weeksSoFar += Math.max(1, Math.ceil(g.hoursLeft / gap.readiness.weeklyHours));
    const source = g.skill.sources.map((id) => sourceById(id)?.title).find(Boolean);
    items.push({
      id: `m${n + 1}`,
      kind: 'milestone.create',
      selected: true,
      reason: `${g.importance === 3 ? 'Core skill' : g.importance === 0 ? 'Needed first' : 'Skill'} for ${gap.career.title} — about ${g.hoursLeft} h to level ${g.need}.${source ? ` Source: ${source}.` : ''}`,
      data: {
        main_quest_id: mainQuestId,
        title: `${g.skill.name}: reach level ${g.need}`,
        size_weight: g.hoursLeft < 40 ? 1 : g.hoursLeft < 120 ? 2 : 3,
        target_type: 'manual',
        target_value: null,
        current_source: null,
        estimated_weekly_quests: Math.max(1, Math.ceil(g.hoursLeft / HOURS_PER_WEEKLY_QUEST)),
        target_date: addDays(today, weeksSoFar * 7),
        status: n === 0 ? 'active' : 'upcoming',
      },
    });
  });
  const first = missing[0];
  if (first) {
    const steps = pack()
      .roadmaps.flatMap((r) => r.steps.filter((s) => s.skill === first.skill.id))
      .slice(0, 2);
    const titles = steps.length
      ? steps.map((s) => `${first.skill.name}: ${s.title}`)
      : [`${first.skill.name}: ${HOURS_PER_WEEKLY_QUEST} focused hours`];
    titles.forEach((title, k) =>
      items.push({
        id: `w${k + 1}`,
        kind: 'quest.create',
        selected: true,
        reason: steps[k]?.detail ?? 'A first step on the first skill.',
        data: {
          type: 'weekly',
          title,
          stat,
          difficulty: 'normal',
          week_start: weekStart,
          linked_goal_type: 'milestone',
          linked_goal_id: 'ref:m1',
          carried_over_from: null,
        },
      }),
    );
  }
  return items;
}
