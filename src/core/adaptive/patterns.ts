import {
  addDays,
  diffDays,
  localParts,
  weekStartOf,
  type DayString,
  type Weekday,
} from '@/core/time';
import type { AdaptiveInput } from './input';
import { learnFrom } from './input';
import {
  ADAPTIVE,
  betaEstimate,
  confidenceOf,
  recencyAverage,
  recencyWeight,
  type Confidence,
  type Estimate,
} from './model';

/**
 * Patterns learned from when and how much the user really does things (SPEC 6.7 A): best
 * hours, real weekly capacity, and how welcome each kind of suggestion is. Pure.
 */

// ---- Best hours ----

export interface HourWindow {
  /** Local clock hour the window starts (0–23) and its length in hours. */
  start: number;
  hours: number;
  /** Share of all recency-weighted activity that falls inside it (0–1). */
  share: number;
  /** Effective number of sessions/completions it's based on. */
  n: number;
  confidence: Confidence;
}

/** Hour of an instant in the user's timezone. */
const hourOf = (iso: string, tz: string) => localParts(Date.parse(iso), tz).hour;

function bestWindow(
  points: readonly { day: DayString; hour: number; weight: number }[],
  today: DayString,
  hours: number,
): HourWindow | null {
  const bins = new Array<number>(24).fill(0);
  let total = 0;
  let n = 0;
  for (const p of points) {
    const w = recencyWeight(diffDays(p.day, today)) * p.weight;
    bins[p.hour] = (bins[p.hour] ?? 0) + w;
    total += w;
    n += recencyWeight(diffDays(p.day, today));
  }
  if (total <= 0) return null;
  let best = 0;
  let bestSum = -1;
  for (let h = 0; h < 24; h++) {
    let sum = 0;
    for (let k = 0; k < hours; k++) sum += bins[(h + k) % 24] ?? 0;
    // Ties: the window that starts where the activity starts (not an empty hour before it).
    const eps = 1e-9;
    if (
      sum > bestSum + eps ||
      (Math.abs(sum - bestSum) <= eps && (bins[h] ?? 0) > (bins[best] ?? 0))
    ) {
      bestSum = sum;
      best = h;
    }
  }
  const share = bestSum / total;
  // Confident only when there's enough evidence AND activity really clusters there.
  const conf = confidenceOf(n, share >= 0.4 ? 0 : 1);
  return { start: best, hours, share, n, confidence: share < 0.3 ? 'early' : conf };
}

/** When focus really happens: sessions (by minutes) and minutes quests' completion times. */
export function focusWindow(input: AdaptiveInput): HourWindow | null {
  const from = learnFrom(input.events, null);
  const points = [
    ...input.focus
      .filter((f) => f.day >= from && f.day < input.today)
      .map((f) => ({ day: f.day, hour: hourOf(f.startedAt, input.tz), weight: f.minutes / 30 })),
    ...input.instances
      .filter(
        (i) => i.measure === 'minutes' && i.completedAt && i.day >= from && i.day < input.today,
      )
      .map((i) => ({ day: i.day, hour: hourOf(i.completedAt ?? '', input.tz), weight: 0.5 })),
  ];
  return bestWindow(points, input.today, 2);
}

/** When quests usually get done (any quest, or core only) — a reminder fits just before. */
export function completionWindow(input: AdaptiveInput, coreOnly = false): HourWindow | null {
  const from = learnFrom(input.events, null);
  const points = input.instances
    .filter(
      (i) =>
        (!coreOnly || i.core) &&
        !i.wake &&
        i.completedAt &&
        i.day >= from &&
        i.day < input.today &&
        i.measure !== 'sleep_hours',
    )
    .map((i) => ({ day: i.day, hour: hourOf(i.completedAt ?? '', input.tz), weight: 1 }));
  return bestWindow(points, input.today, 2);
}

// ---- Real weekly capacity ----

export interface Capacity {
  /** Recency-weighted minutes really done per week (daily minutes quests + unlinked focus). */
  doneMinutes: number;
  /** Minutes the daily quests asked for per week (targets). */
  plannedMinutes: number;
  /** done / planned (1 = everything planned was done). */
  ratio: number;
  /** Closed weeks it's based on. */
  weeks: number;
  confidence: Confidence;
}

export function weeklyCapacity(input: AdaptiveInput): Capacity | null {
  const from = learnFrom(input.events, null);
  const ws = input.settings.week_start as Weekday;
  const thisWeek = weekStartOf(input.today, ws);
  const weeks = new Map<DayString, { done: number; planned: number }>();
  const first = input.startDay ? addDays(input.startDay, 1) : '';
  for (const i of input.instances) {
    if (i.measure !== 'minutes' || i.day < from || i.day < first || i.status === 'skipped')
      continue;
    const w = weekStartOf(i.day, ws);
    if (w >= thisWeek) continue;
    const e = weeks.get(w) ?? { done: 0, planned: 0 };
    e.done += Math.min(i.value ?? 0, (i.target ?? 0) * 2);
    e.planned += i.target ?? 0;
    weeks.set(w, e);
  }
  for (const f of input.focus) {
    if (f.linked || f.day < from || f.day < first) continue;
    const w = weekStartOf(f.day, ws);
    if (w >= thisWeek) continue;
    const e = weeks.get(w) ?? { done: 0, planned: 0 };
    e.done += f.minutes;
    weeks.set(w, e);
  }
  if (weeks.size === 0) return null;
  // A week counts at the recency of its last day.
  const pts = [...weeks.entries()];
  const done = recencyAverage(
    pts.map(([w, e]) => ({ day: addDays(w, 6), value: e.done })),
    input.today,
  );
  const planned = recencyAverage(
    pts.map(([w, e]) => ({ day: addDays(w, 6), value: e.planned })),
    input.today,
  );
  if (!done || !planned) return null;
  const n = pts.length;
  return {
    doneMinutes: Math.round(done.value),
    plannedMinutes: Math.round(planned.value),
    ratio: planned.value > 0 ? done.value / planned.value : 1,
    weeks: n,
    confidence: n >= 4 ? 'confident' : n >= 2 ? 'likely' : 'early',
  };
}

// ---- How welcome a kind of suggestion is ----

export interface SuggestionWelcome {
  /** P(accepted or edited) — recency-weighted, prior 0.6. */
  estimate: Estimate;
  /** Show at most once every N days (1 = whenever it applies). */
  everyDays: number;
}

/** Never show a suggestion less often than once every this many days (so it can recover). */
export const MAX_GAP_DAYS = 7;

export function suggestionWelcome(input: AdaptiveInput, type: string): SuggestionWelcome {
  const from = learnFrom(input.events, null);
  const answers = input.events.filter(
    (e) =>
      e.kind === 'suggestion' &&
      e.type === type &&
      e.day >= from &&
      e.outcome !== null &&
      e.outcome !== 'shown',
  );
  const estimate = betaEstimate(
    answers.map((e) => ({
      day: e.day,
      success: e.outcome === 'accepted' || e.outcome === 'edited',
    })),
    input.today,
    0.6,
    3,
  );
  // At 50%+ welcome it shows whenever it applies; below that, it comes back less often.
  const everyDays =
    estimate.p >= 0.5 ? 1 : Math.min(MAX_GAP_DAYS, Math.ceil(0.5 / Math.max(estimate.p, 0.07)));
  return { estimate, everyDays };
}

/**
 * May a suggestion of this type be shown today? Not if one of the same type was shown less
 * than `everyDays` ago.
 */
export function mayShow(input: AdaptiveInput, type: string): boolean {
  const { everyDays } = suggestionWelcome(input, type);
  if (everyDays <= 1) return true;
  const last = input.events
    .filter((e) => e.kind === 'suggestion' && e.type === type && e.outcome === 'shown')
    .map((e) => e.day)
    .sort()
    .at(-1);
  return !last || last === input.today || diffDays(last, input.today) >= everyDays;
}

export { ADAPTIVE };
