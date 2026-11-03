import { isDone } from '@/core/engine/progress';
import { diffDays, type DayString } from '@/core/time';
import type { AdaptiveInput } from './input';

/**
 * Career–health balance (SPEC 6.7 B), pure. Uses what the Adaptive System sees — a heavy study
 * week, short sleep, low-energy days — to tell the weekly plan to make room for recovery, and
 * explains it with the user's own sleep-vs-completion pattern when there's enough data.
 */
export interface Balance {
  needed: boolean;
  why: string;
  /** e.g. "On days after 7+ hours of sleep you finish 86% of your quests, vs 61% after less." */
  sleepInsight: string | null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/** Daily completion share for closed days. */
function completionByDay(input: AdaptiveInput): Map<DayString, number> {
  const per = new Map<DayString, { done: number; all: number }>();
  for (const i of input.instances) {
    if (i.day >= input.today || i.status === 'skipped' || i.measure === 'sleep_hours') continue;
    const e = per.get(i.day) ?? { done: 0, all: 0 };
    e.all++;
    if (isDone(i.status)) e.done++;
    per.set(i.day, e);
  }
  return new Map([...per].map(([d, e]) => [d, e.done / e.all]));
}

export function sleepInsight(input: AdaptiveInput): string | null {
  const done = completionByDay(input);
  const good: number[] = [];
  const short: number[] = [];
  for (const s of input.sleep) {
    const rate = done.get(s.day); // sleep belongs to the day you wake into
    if (rate === undefined) continue;
    (s.value >= 7 ? good : short).push(rate);
  }
  if (good.length < 5 || short.length < 5) return null;
  const g = mean(good) ?? 0;
  const sh = mean(short) ?? 0;
  if (Math.abs(g - sh) < 0.08) return null;
  return `On days after 7+ hours of sleep you finish ${Math.round(g * 100)}% of your quests, vs ${Math.round(sh * 100)}% after less.`;
}

export function balanceSignal(input: AdaptiveInput): Balance {
  const last7 = (d: DayString) => diffDays(d, input.today) >= 1 && diffDays(d, input.today) <= 7;
  const prior = (d: DayString) => diffDays(d, input.today) > 7 && diffDays(d, input.today) <= 35;
  const minutes = (pred: (d: DayString) => boolean) =>
    input.instances
      .filter((i) => i.measure === 'minutes' && pred(i.day))
      .reduce((s, i) => s + (i.value ?? 0), 0);
  const weekMin = minutes(last7);
  const usual = minutes(prior) / 4;
  const heavy = usual > 0 && weekMin > usual * 1.25;
  const sleep = input.sleep.filter((s) => last7(s.day));
  const avgSleep = mean(sleep.map((s) => s.value));
  const shortSleep = sleep.length >= 4 && avgSleep !== null && avgSleep < 6.5;
  const lowEnergy = input.lowEnergyDays.filter(last7).length >= 2;
  const needed = (heavy && (shortSleep || lowEnergy)) || (shortSleep && lowEnergy);
  const parts = [
    heavy &&
      `a heavy study week (${Math.round(weekMin / 60)} h vs your usual ${Math.round(usual / 60)} h)`,
    shortSleep && `short sleep (${avgSleep?.toFixed(1)} h a night)`,
    lowEnergy && 'low-energy days',
  ].filter(Boolean);
  return {
    needed,
    why: needed ? `Last week: ${parts.join(', ')}. This week keeps room for recovery.` : '',
    sleepInsight: sleepInsight(input),
  };
}
