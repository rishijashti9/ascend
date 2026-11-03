import type { Habit, LearningEvent } from '@/core/db/types';
import type { AdaptiveState } from '@/core/state/adaptive';
import { localParts } from '@/core/time';
import type { AdaptiveInput } from './input';
import { learnSince } from './input';
import { recencyAverage, type Confidence } from './model';
import { suggestionWelcome } from './patterns';

/**
 * "What the System knows about you" (SPEC 6.7 A): every learned item in plain words, with its
 * confidence and how to clear it. Pure.
 */
export type ClearHow = { kind: 'reset'; habitId: string } | { kind: 'forget'; key: string };

export interface KnownItem {
  key: string;
  group: 'Quests' | 'Time' | 'Load' | 'Suggestions' | 'Wellbeing';
  title: string;
  text: string;
  confidence: Confidence;
  clear: ClearHow;
}

const WEEKDAY = [
  'Sundays',
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
];
const pct = (p: number) => `${Math.round(p * 100)}%`;
const clock = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
const hours = (min: number) =>
  min >= 60 ? `${Math.round(min / 6) / 10} h` : `${Math.round(min)} min`;

const SUGGESTION_NAMES: Record<string, string> = {
  plan_weekly: 'Weekly plans',
  plan_replan: 'Goal plans',
  difficulty_ease: 'Smaller targets',
  difficulty_raise: 'Bigger targets',
  goal_risk: 'Deadline catch-up options',
  goal_checkin: 'Monthly goal check-ins',
  reminder_time: 'Reminder time changes',
  burnout: 'Lighter weeks',
};

export function knownItems(state: AdaptiveState, habits: readonly Habit[]): KnownItem[] {
  const input = state.input;
  if (!input) return [];
  const items: KnownItem[] = [];

  for (const h of habits) {
    const m = state.models.get(h.id);
    if (!m || m.observed < 3) continue;
    const hardest = m.byWeekday
      .map((e, wd) => ({ e, wd }))
      .filter((x) => x.e && x.e.count >= 3)
      .sort((a, b) => (a.e?.p ?? 1) - (b.e?.p ?? 1))[0];
    const weekday =
      hardest?.e && hardest.e.p < m.done.p - 0.1
        ? ` Hardest on ${WEEKDAY[hardest.wd]} (${pct(hardest.e.p)}).`
        : '';
    items.push({
      key: `habit:${h.id}`,
      group: 'Quests',
      title: h.title,
      text: `Done on about ${pct(m.done.p)} of days, in full on ${pct(m.full.p)}.${weekday}`,
      confidence: m.done.confidence,
      clear: { kind: 'reset', habitId: h.id },
    });
  }

  if (state.focus && state.focus.confidence !== 'early') {
    const f = state.focus;
    items.push({
      key: 'focus_window',
      group: 'Time',
      title: 'Best focus time',
      text: `Your focus mostly happens ${clock(f.start)}–${clock(f.start + f.hours)} (${pct(f.share)} of it).`,
      confidence: f.confidence,
      clear: { kind: 'forget', key: 'focus_window' },
    });
  }
  if (state.completion && state.completion.confidence !== 'early') {
    const c = state.completion;
    items.push({
      key: 'completion_window',
      group: 'Time',
      title: 'When quests get done',
      text: `Most quests get done ${clock(c.start)}–${clock(c.start + c.hours)} (${pct(c.share)}).`,
      confidence: c.confidence,
      clear: { kind: 'forget', key: 'completion_window' },
    });
  }
  if (state.capacity && state.capacity.confidence !== 'early') {
    const c = state.capacity;
    items.push({
      key: 'capacity',
      group: 'Load',
      title: 'Real weekly capacity',
      text: `You really do about ${hours(c.doneMinutes / 7)} a day of the ${hours(c.plannedMinutes / 7)} your daily quests ask for (${c.weeks} weeks).`,
      confidence: c.confidence,
      clear: { kind: 'forget', key: 'capacity' },
    });
  }

  const types = new Set(
    input.events.filter((e) => e.kind === 'suggestion' && e.outcome !== 'shown').map((e) => e.type),
  );
  for (const type of [...types].sort()) {
    const w = suggestionWelcome(input, type);
    if (w.estimate.count < 3) continue;
    items.push({
      key: `welcome:${type}`,
      group: 'Suggestions',
      title: SUGGESTION_NAMES[type] ?? type.replace(/_/g, ' '),
      text:
        w.everyDays > 1
          ? `Usually turned down (${pct(w.estimate.p)} welcome) — shown at most every ${w.everyDays} days.`
          : `Usually welcome (${pct(w.estimate.p)}).`,
      confidence: w.estimate.confidence,
      clear: { kind: 'forget', key: `welcome:${type}` },
    });
  }

  for (const [key, title, points, fmt] of [
    ['sleep', 'Sleep', input.sleep, (v: number) => `about ${v.toFixed(1)} h a night lately`],
    ['energy', 'Check-in energy', input.energy, (v: number) => `about ${v.toFixed(1)} of 5 lately`],
  ] as const) {
    const since = learnSince(input.events, key);
    const avg = recencyAverage(
      points.filter((p) => p.day >= since),
      input.today,
    );
    if (!avg || avg.n < 3) continue;
    items.push({
      key,
      group: 'Wellbeing',
      title,
      text: `${fmt(avg.value)[0]?.toUpperCase()}${fmt(avg.value).slice(1)}. Stays on this device and your own account.`,
      confidence: avg.n >= 10 ? 'confident' : 'likely',
      clear: { kind: 'forget', key },
    });
  }
  return items;
}

// ---- CSV export (SPEC 6.7: a clean export of the learning data for a future bigger model) ----

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (header: string[], rows: unknown[][]) =>
  [header, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n';

/** Learning events, one per row; numeric values as `key=value` pairs. */
export function learningEventsCsv(events: readonly LearningEvent[]): string {
  return csv(
    ['id', 'kind', 'type', 'outcome', 'at', 'day', 'ref_id', 'values'],
    [...events]
      .filter((e) => !e.deleted_at)
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((e) => [
        e.id,
        e.kind,
        e.type,
        e.outcome,
        e.at,
        e.day,
        e.ref_id,
        e.values
          ? Object.entries(e.values)
              .map(([k, v]) => `${k}=${v}`)
              .join(';')
          : '',
      ]),
  );
}

/** Daily-quest outcomes, one per quest per day: the features a model would learn from. */
export function dailyOutcomesCsv(input: AdaptiveInput): string {
  return csv(
    [
      'day',
      'weekday',
      'habit_id',
      'stat',
      'core',
      'measure',
      'target',
      'value',
      'status',
      'low_energy',
      'completed_hour',
    ],
    input.instances.map((i) => [
      i.day,
      new Date(`${i.day}T12:00:00Z`).getUTCDay(),
      i.habitId,
      i.stat,
      i.core ? 1 : 0,
      i.measure,
      i.target,
      i.value,
      i.status,
      i.lowEnergy ? 1 : 0,
      i.completedAt ? localParts(Date.parse(i.completedAt), input.tz).hour : '',
    ]),
  );
}
