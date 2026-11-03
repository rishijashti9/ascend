import { diffDays, type DayString } from '@/core/time';

/**
 * Small, explainable statistics the Adaptive System is built from (SPEC 6.7 A). Pure and
 * deterministic: the same records give the same numbers on every device.
 *
 * Recency: every observation is weighted by 0.5^(age / HALF_LIFE_DAYS), so the last month
 * counts most and the System re-adapts after a life change. Observations older than
 * WINDOW_DAYS weigh almost nothing and are not read at all (fast with 10 years of data).
 */
export const ADAPTIVE = {
  halfLifeDays: 21,
  windowDays: 365,
  /** Weight of the prior, in observations (cold start: a few days of real data outweigh it). */
  priorStrength: 4,
  /** Prior completion chance before anything is known (the rule engine's expectation). */
  defaultPrior: 0.7,
  /** Effective observations needed for "likely" / "confident". */
  likelyN: 4,
  confidentN: 10,
  /** 80% interval width allowed for "confident". */
  confidentWidth: 0.3,
} as const;

export type Confidence = 'early' | 'likely' | 'confident';

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  early: 'early guess',
  likely: 'likely',
  confident: 'confident',
};

/** Weight of an observation `ageDays` old. */
export function recencyWeight(ageDays: number, halfLife: number = ADAPTIVE.halfLifeDays): number {
  return Math.pow(0.5, Math.max(0, ageDays) / halfLife);
}

export interface Estimate {
  /** Posterior mean probability (0–1). */
  p: number;
  /** Effective (recency-weighted) number of real observations. */
  n: number;
  /** Raw number of observations. */
  count: number;
  /** ~80% credible interval. */
  lo: number;
  hi: number;
  confidence: Confidence;
}

export function confidenceOf(n: number, width: number): Confidence {
  if (n >= ADAPTIVE.confidentN && width <= ADAPTIVE.confidentWidth) return 'confident';
  if (n >= ADAPTIVE.likelyN) return 'likely';
  return 'early';
}

/**
 * Beta-Bernoulli with recency weights: start from Beta(prior·s, (1-prior)·s), add each
 * observation with its weight. The interval uses the Beta's normal approximation (z = 1.28).
 */
export function betaEstimate(
  obs: readonly { day: DayString; success: boolean }[],
  today: DayString,
  prior: number = ADAPTIVE.defaultPrior,
  strength: number = ADAPTIVE.priorStrength,
  halfLife: number = ADAPTIVE.halfLifeDays,
): Estimate {
  const p0 = Math.min(0.97, Math.max(0.03, prior));
  let a = p0 * strength;
  let b = (1 - p0) * strength;
  let n = 0;
  for (const o of obs) {
    const w = recencyWeight(diffDays(o.day, today), halfLife);
    n += w;
    if (o.success) a += w;
    else b += w;
  }
  const p = a / (a + b);
  const sd = Math.sqrt((a * b) / ((a + b) ** 2 * (a + b + 1)));
  const lo = Math.max(0, p - 1.28 * sd);
  const hi = Math.min(1, p + 1.28 * sd);
  return { p, n, count: obs.length, lo, hi, confidence: confidenceOf(n, hi - lo) };
}

/** Recency-weighted average of values (null when there are none). */
export function recencyAverage(
  points: readonly { day: DayString; value: number }[],
  today: DayString,
): { value: number; n: number } | null {
  let sum = 0;
  let weight = 0;
  for (const pt of points) {
    const w = recencyWeight(diffDays(pt.day, today));
    sum += w * pt.value;
    weight += w;
  }
  return weight > 0 ? { value: sum / weight, n: weight } : null;
}

/**
 * Trend of recency-weighted values: average of the last `recent` days minus the average of
 * the `recent` days before them (null without enough points in both halves).
 */
export function recentChange(
  points: readonly { day: DayString; value: number }[],
  today: DayString,
  recent = 14,
): number | null {
  const a: number[] = [];
  const b: number[] = [];
  for (const pt of points) {
    const age = diffDays(pt.day, today);
    if (age >= 1 && age <= recent) a.push(pt.value);
    else if (age > recent && age <= recent * 2) b.push(pt.value);
  }
  if (a.length < recent / 3 || b.length < recent / 3) return null;
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  return mean(a) - mean(b);
}

/** Brier score of probability forecasts (lower is better). */
export function brier(pairs: readonly { p: number; outcome: boolean }[]): number {
  if (pairs.length === 0) return 0;
  return pairs.reduce((s, x) => s + (x.p - (x.outcome ? 1 : 0)) ** 2, 0) / pairs.length;
}
