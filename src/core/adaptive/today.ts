import type { Measure } from '@/core/db/types';
import { diffDays, weekdayOf, type DayString } from '@/core/time';
import { chanceOn, type HabitModel } from './habits';
import type { HourWindow } from './patterns';
import type { Confidence } from './model';

/**
 * Today's helpers (SPEC 6.7 A): which quests are likely to be skipped, and the one best next
 * action. Pure; every result explains itself in plain words.
 */

const WEEKDAY = [
  'Sundays',
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
];

export interface PendingQuest {
  instanceId: string;
  habitId: string;
  title: string;
  measure: Measure;
  core: boolean;
  /** Minutes still to go for a minutes quest (to its minimum, or full if the minimum is done). */
  remainingMin: number | null;
  /** Deadline of the goal it serves (milestone or main quest), if any. */
  goalDeadline: DayString | null;
}

export interface Risk {
  instanceId: string;
  /** Chance it gets done today (0–1). */
  chance: number;
  confidence: Confidence;
  /** e.g. "Often skipped on Mondays — done 2 of the last 6." */
  why: string;
}

/** Below this chance a pending quest counts as "at risk". */
export const RISK_BELOW = 0.5;
/** At most this many quests are highlighted, so it stays a hint and not a list of worries. */
export const MAX_RISKS = 2;

function recentOnWeekday(model: HabitModel, day: DayString): string | null {
  const est = model.byWeekday[weekdayOf(day)];
  if (!est || est.count < 3) return null;
  return WEEKDAY[weekdayOf(day)] ?? null;
}

export function atRiskToday(
  today: DayString,
  models: ReadonlyMap<string, HabitModel>,
  pending: readonly PendingQuest[],
  lowEnergy: boolean,
): Risk[] {
  // A low-energy day is for minimums; no extra pressure.
  if (lowEnergy) return [];
  const out: Risk[] = [];
  for (const q of pending) {
    const m = models.get(q.habitId);
    if (!m) continue;
    const est = chanceOn(m, today);
    if (est.p >= RISK_BELOW || est.confidence === 'early') continue;
    const wd = recentOnWeekday(m, today);
    const why = wd
      ? `Often skipped on ${wd} — about ${Math.round(est.p * 100)}% get done. The minimum counts.`
      : `Skipped often lately — about ${Math.round(est.p * 100)}% get done. The minimum counts.`;
    out.push({ instanceId: q.instanceId, chance: est.p, confidence: est.confidence, why });
  }
  return out.sort((a, b) => a.chance - b.chance).slice(0, MAX_RISKS);
}

export interface NextAction {
  instanceId: string;
  title: string;
  /** Plain-words reason, e.g. "Core quest · your best focus time is now". */
  why: string;
  /** Start a focus session for it (minutes quests). */
  focus: boolean;
  confidence: Confidence;
}

/**
 * "What should I do now?" — one quest, chosen from: core first, then the riskiest (likely to
 * slip if left for later), a goal deadline coming up, and whether now is the user's real focus
 * time (for minutes quests). Nothing pending → null.
 */
export function whatNow(
  today: DayString,
  hour: number,
  models: ReadonlyMap<string, HabitModel>,
  pending: readonly PendingQuest[],
  focus: HourWindow | null,
): NextAction | null {
  let best: { q: PendingQuest; score: number; reasons: string[]; conf: Confidence } | null = null;
  const inFocus =
    focus !== null && focus.confidence !== 'early' && (hour - focus.start + 24) % 24 < focus.hours;
  for (const q of pending) {
    const m = models.get(q.habitId);
    const est = m ? chanceOn(m, today) : null;
    const reasons: string[] = [];
    let score = 1;
    if (q.core) {
      score += 1.5;
      reasons.push('core quest');
    }
    if (est && est.confidence !== 'early') {
      score += 1 - est.p;
      if (est.p < RISK_BELOW) reasons.push('it often slips when left for later');
    }
    if (q.goalDeadline) {
      const left = diffDays(today, q.goalDeadline);
      if (left >= 0 && left <= 30) {
        score += (30 - left) / 30;
        reasons.push(`its goal is due in ${left} day${left === 1 ? '' : 's'}`);
      }
    }
    if (q.measure === 'minutes') {
      if (inFocus) {
        score += 0.75;
        reasons.push('this is your best focus time');
      }
    } else if (q.measure === 'check') {
      score += 0.2; // quick to finish
    }
    if (!best || score > best.score) best = { q, score, reasons, conf: est?.confidence ?? 'early' };
  }
  if (!best) return null;
  const { q, reasons } = best;
  const short =
    q.measure === 'minutes' && q.remainingMin !== null
      ? ` ${q.remainingMin} min reaches the ${q.remainingMin > 0 ? 'next step' : 'target'}.`
      : '';
  const why = reasons.length
    ? `${reasons[0]?.[0]?.toUpperCase()}${reasons.join(', ').slice(1)}.${short}`
    : `Next in your list.${short}`;
  return {
    instanceId: q.instanceId,
    title: q.title,
    why,
    focus: q.measure === 'minutes',
    confidence: best.conf,
  };
}
