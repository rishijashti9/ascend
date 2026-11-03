import { isDone } from '@/core/engine/progress';
import { addDays, diffDays, type DayString } from '@/core/time';
import type { AdaptiveInput } from './input';
import { learnFrom, learnSince } from './input';

/**
 * Early burnout warning (SPEC 6.7 A), pure. Looks at the last two weeks against the two before:
 * completion slipping, low-energy days piling up, short sleep, low check-in energy. Two or more
 * of these together → a gentle warning with a lighter week on offer. Never more load, never
 * less sleep.
 */
export interface BurnoutSignal {
  key: 'slipping' | 'low_energy' | 'short_sleep' | 'low_energy_checkins';
  text: string;
}

export interface BurnoutWarning {
  signals: BurnoutSignal[];
  /** One plain paragraph. */
  why: string;
}

const WINDOW = 14;

/** Share of daily quests done per day (closed days, not skipped). */
function dailyRates(input: AdaptiveInput, from: DayString): Map<DayString, number> {
  const per = new Map<DayString, { done: number; all: number }>();
  for (const i of input.instances) {
    if (i.day >= input.today || i.day < from || i.status === 'skipped') continue;
    const e = per.get(i.day) ?? { done: 0, all: 0 };
    e.all++;
    if (isDone(i.status)) e.done++;
    per.set(i.day, e);
  }
  return new Map([...per].map(([d, e]) => [d, e.done / e.all]));
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export function burnoutWarning(
  input: AdaptiveInput,
  sleepTarget: number | null,
): BurnoutWarning | null {
  const from = learnFrom(input.events, null);
  const recentStart = addDays(input.today, -WINDOW);
  const priorStart = addDays(input.today, -2 * WINDOW);
  const rates = dailyRates(input, from > priorStart ? from : priorStart);
  const recent = [...rates].filter(([d]) => d >= recentStart).map(([, r]) => r);
  const prior = [...rates].filter(([d]) => d < recentStart).map(([, r]) => r);
  const signals: BurnoutSignal[] = [];

  const r = mean(recent);
  const p = mean(prior);
  if (r !== null && p !== null && recent.length >= 7 && prior.length >= 7 && p - r >= 0.15) {
    signals.push({
      key: 'slipping',
      text: `completion has slipped from ${Math.round(p * 100)}% to ${Math.round(r * 100)}%`,
    });
  }

  const lowDays = input.lowEnergyDays.filter((d) => d >= recentStart && d < input.today).length;
  if (lowDays >= 3) signals.push({ key: 'low_energy', text: `${lowDays} low-energy days` });

  const sleep = input.sleep.filter(
    (s) =>
      diffDays(s.day, input.today) <= 7 &&
      s.day <= input.today &&
      s.day >= learnSince(input.events, 'sleep'),
  );
  const avgSleep = mean(sleep.map((s) => s.value));
  const short = Math.min(6.5, (sleepTarget ?? 7.5) - 0.75);
  if (avgSleep !== null && sleep.length >= 4 && avgSleep < short) {
    signals.push({ key: 'short_sleep', text: `short sleep (${avgSleep.toFixed(1)} h a night)` });
  }

  const energy = input.energy.filter(
    (e) => diffDays(e.day, input.today) <= 7 && e.day >= learnSince(input.events, 'energy'),
  );
  const avgEnergy = mean(energy.map((e) => e.value));
  if (avgEnergy !== null && energy.length >= 3 && avgEnergy <= 2.2) {
    signals.push({ key: 'low_energy_checkins', text: 'low energy in your check-ins' });
  }

  if (signals.length < 2) return null;
  const list =
    signals.length === 2
      ? `${signals[0]?.text} and ${signals[1]?.text}`
      : `${signals
          .slice(0, -1)
          .map((s) => s.text)
          .join(', ')} and ${signals.at(-1)?.text}`;
  return {
    signals,
    why: `In the last two weeks: ${list}. Together that's often the start of running down — easing off now usually saves a longer break later. Sleep comes first.`,
  };
}
