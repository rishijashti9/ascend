import type { DayString, MainQuest, Milestone } from '@/core/db/types';
import { addDays, diffDays } from '@/core/time';
import type { Confidence } from './model';

/**
 * Goal guidance from real pace (SPEC 6.7 A): when will the active milestone and the main quest
 * be finished if things go on as they have, is that before the deadline, and which goal most
 * deserves this week's focus. Pure; explained in plain words.
 */
export interface Forecast {
  /** Forecast finish day (null = no progress yet, so no pace to go on). */
  finish: DayString | null;
  /** Days late against the deadline (negative = early; null without a deadline or forecast). */
  lateBy: number | null;
  confidence: Confidence;
  /** e.g. "At your pace (40% in 4 weeks), about 6 more weeks — around 15 Dec." */
  why: string;
}

/** Days a milestone has been running before a pace is trusted at all. */
const MIN_DAYS = 7;
/** Late by more than this many days → "behind" (a week of slack). */
export const BEHIND_DAYS = 7;

const fmtDay = (d: DayString) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

const weeksText = (days: number) => (days < 14 ? `${days} days` : `${Math.round(days / 7)} weeks`);

/** Day a milestone started: when the previous one was done, else when it was created. */
export function milestoneStart(
  m: Milestone,
  all: readonly Milestone[],
  dayOfIso: (iso: string) => DayString,
): DayString {
  const previous = all
    .filter((x) => x.main_quest_id === m.main_quest_id && x.order < m.order && x.done_at)
    .sort((a, b) => b.order - a.order)[0];
  return dayOfIso(previous?.done_at ?? m.created_at);
}

export function milestoneForecast(
  m: Milestone,
  progress: number,
  start: DayString,
  today: DayString,
): Forecast {
  const elapsed = diffDays(start, today);
  if (m.status === 'done' || progress >= 1)
    return { finish: today, lateBy: null, confidence: 'confident', why: 'Target reached.' };
  if (elapsed < MIN_DAYS)
    return { finish: null, lateBy: null, confidence: 'early', why: 'Too early to tell.' };
  if (progress <= 0)
    return {
      finish: null,
      lateBy: null,
      confidence: elapsed >= 14 ? 'likely' : 'early',
      why: `No progress yet in ${weeksText(elapsed)}.`,
    };
  const perDay = progress / elapsed;
  const left = Math.ceil((1 - progress) / perDay);
  const finish = addDays(today, left);
  const lateBy = m.target_date ? diffDays(m.target_date, finish) : null;
  const confidence: Confidence =
    elapsed >= 28 && progress >= 0.15 ? 'confident' : elapsed >= 14 ? 'likely' : 'early';
  return {
    finish,
    lateBy,
    confidence,
    why: `At your pace (${Math.round(progress * 100)}% in ${weeksText(elapsed)}), about ${weeksText(left)} more — around ${fmtDay(finish)}.`,
  };
}

/**
 * Main quest: the active milestone's forecast, plus the remaining milestones at the pace of the
 * ones already done (days per unit of size), or at the active one's pace if none is done yet.
 */
export function mainQuestForecast(
  q: MainQuest,
  milestones: readonly Milestone[],
  progressOf: (id: string) => number,
  today: DayString,
  dayOfIso: (iso: string) => DayString,
): Forecast | null {
  const own = milestones
    .filter((m) => m.main_quest_id === q.id && m.status !== 'archived' && !m.deleted_at)
    .sort((a, b) => a.order - b.order);
  const active = own.find((m) => m.status === 'active');
  if (!active) return null;
  const f = milestoneForecast(
    active,
    progressOf(active.id),
    milestoneStart(active, own, dayOfIso),
    today,
  );
  if (!f.finish) return { ...f, lateBy: null };
  const done = own.filter((m) => m.status === 'done' && m.done_at);
  const doneWeight = done.reduce((s, m) => s + m.size_weight, 0);
  const started = dayOfIso(q.created_at);
  const activeDays = diffDays(milestoneStart(active, own, dayOfIso), f.finish);
  const perWeight =
    doneWeight > 0
      ? Math.max(1, diffDays(started, dayOfIso(done.at(-1)?.done_at ?? q.created_at))) / doneWeight
      : activeDays / Math.max(1, active.size_weight);
  const rest = own
    .filter((m) => m.status === 'upcoming' || (m.status === 'active' && m.id !== active.id))
    .reduce((s, m) => s + m.size_weight, 0);
  const finish = addDays(f.finish, Math.round(rest * perWeight));
  const lateBy = q.target_date ? diffDays(q.target_date, finish) : null;
  return {
    finish,
    lateBy,
    confidence:
      f.confidence === 'confident' && doneWeight > 0
        ? 'confident'
        : f.confidence === 'early'
          ? 'early'
          : 'likely',
    why:
      rest > 0
        ? `“${active.title}” around ${fmtDay(f.finish)}, then the rest at the same pace — around ${fmtDay(finish)}.`
        : f.why,
  };
}

/** One plain sentence when a forecast is clearly behind its deadline (else null). */
export function behindMessage(
  title: string,
  f: Forecast,
  deadline: DayString | null,
): string | null {
  if (!deadline || f.lateBy === null || f.lateBy <= BEHIND_DAYS || f.confidence === 'early')
    return null;
  return `At your current pace “${title}” finishes around ${fmtDay(f.finish ?? deadline)} — ${weeksText(f.lateBy)} after its date (${fmtDay(deadline)}). Catching up now is easier than later.`;
}

export interface FocusGoal {
  mainQuestId: string;
  why: string;
}

/**
 * This week's focus goal: the active main quest that most needs it — furthest behind its
 * deadline first, then the nearest deadline, then the one with the least progress.
 */
export function focusGoalOfWeek(
  mainQuests: readonly MainQuest[],
  forecasts: ReadonlyMap<string, Forecast | null>,
  progressOf: (mainQuestId: string) => number,
  today: DayString,
): FocusGoal | null {
  const active = mainQuests.filter((q) => q.status === 'active' && !q.deleted_at);
  if (active.length === 0) return null;
  const scored = active.map((q) => {
    const f = forecasts.get(q.id) ?? null;
    const late = f && f.confidence !== 'early' ? (f.lateBy ?? -999) : -999;
    const daysLeft = q.target_date ? diffDays(today, q.target_date) : 9999;
    return { q, late, daysLeft, progress: progressOf(q.id) };
  });
  scored.sort((a, b) => b.late - a.late || a.daysLeft - b.daysLeft || a.progress - b.progress);
  const top = scored[0];
  if (!top) return null;
  const why =
    top.late > BEHIND_DAYS
      ? `It's ${weeksText(top.late)} behind its date at the current pace.`
      : top.daysLeft < 9999
        ? `Its deadline is the nearest (${fmtDay(q(top))}).`
        : `It has the most still to do (${Math.round(top.progress * 100)}% done).`;
  return { mainQuestId: top.q.id, why };
}

const q = (s: { q: MainQuest }) => s.q.target_date ?? '';
