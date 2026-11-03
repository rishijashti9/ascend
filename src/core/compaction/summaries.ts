import type {
  AutoSource,
  BodyLog,
  DayRecord,
  DayString,
  FocusSession,
  InstanceStatus,
  Measure,
  ProgressEntry,
  QuestInstance,
  Stat,
  XpEvent,
} from '@/core/db/types';
import { isRecoveryId } from '@/core/engine/instances';
import { progressValue } from '@/core/engine/progress';
import { computeDayXp, type DayXp } from '@/core/engine/xp';

/**
 * Compaction summaries (SPEC 6.7 D), pure. Detail older than a cutoff is replaced by one summary
 * per month that keeps everything long-term progress is computed from — in slim form:
 * - each day's final XP (per stat + bonus), exactly as the progress engine computed it;
 * - each quest instance as a short tuple (status, core, source, measure, logged amount, skills)
 *   instead of a full record with every snapshot and its progress entries;
 * - each focus session as a short tuple;
 * - body logs as monthly averages and a count (photos are handled separately).
 * `expandSummaries` turns them back into the minimal records the engines read, so levels,
 * ranks, streaks, skill levels, goal progress and achievements are identical before and after.
 * Recovery quests, days, reviews, goals, habits and quests are never compacted.
 */

/** [id, source_type, source_id, day, status, core, auto, stat, measure, value, skill_ids] */
export type SlimInstance = [
  string,
  'habit' | 'quest',
  string,
  DayString,
  InstanceStatus,
  0 | 1,
  AutoSource | null,
  Stat,
  Measure,
  number | null,
  string[],
];

/** [id, quest_instance_id, stat, skill_ids, planned, actual, completed, face_down, started_at, ended_at, day] */
export type SlimSession = [
  string,
  string | null,
  Stat | null,
  string[],
  number,
  number,
  0 | 1,
  0 | 1,
  string,
  string | null,
  DayString,
];

export interface BodySummary {
  days: number;
  sleep: number | null;
  steps: number | null;
  weight: number | null;
  waist: number | null;
  /** First and last weight of the month (trends). */
  weightFirst: number | null;
  weightLast: number | null;
}

export interface MonthSummary {
  version: 1;
  /** day → [STR, INT, WIL, bonus, total] final XP. */
  xp: Record<DayString, [number, number, number, number, number]>;
  instances: SlimInstance[];
  sessions: SlimSession[];
  body: BodySummary;
  /** Learning events summarised as counts per kind:type:outcome. */
  learning: Record<string, number>;
}

export interface CompactInput {
  cutoff: DayString;
  days: readonly Pick<DayRecord, 'day' | 'streak_at_start' | 'daily_clear' | 'deleted_at'>[];
  xpEvents: readonly XpEvent[];
  instances: readonly QuestInstance[];
  entries: readonly ProgressEntry[];
  sessions: readonly FocusSession[];
  bodyLogs: readonly BodyLog[];
  learning: readonly {
    day: DayString;
    kind: string;
    type: string;
    outcome: string | null;
    deleted_at: string | null;
  }[];
}

export const monthOf = (day: DayString) => day.slice(0, 7);
const avg = (xs: number[]) =>
  xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100 : null;

/** Which instances get compacted: everything before the cutoff except Recovery quests. */
export const compactable = (i: Pick<QuestInstance, 'id' | 'day'>, cutoff: DayString) =>
  i.day < cutoff && !isRecoveryId(i.id);

export function buildSummaries(input: CompactInput): Map<string, MonthSummary> {
  const { cutoff } = input;
  const months = new Map<string, MonthSummary>();
  const month = (day: DayString): MonthSummary => {
    const key = monthOf(day);
    let m = months.get(key);
    if (!m) {
      m = {
        version: 1,
        xp: {},
        instances: [],
        sessions: [],
        body: {
          days: 0,
          sleep: null,
          steps: null,
          weight: null,
          waist: null,
          weightFirst: null,
          weightLast: null,
        },
        learning: {},
      };
      months.set(key, m);
    }
    return m;
  };

  // XP: each old day's final total, computed exactly like the progress engine does.
  const dayRecord = new Map(input.days.filter((d) => !d.deleted_at).map((d) => [d.day, d]));
  const byDay = new Map<DayString, XpEvent[]>();
  for (const e of input.xpEvents) {
    if (e.deleted_at || e.day >= cutoff) continue;
    const list = byDay.get(e.day) ?? [];
    list.push(e);
    byDay.set(e.day, list);
  }
  const xpDays = new Set([...byDay.keys(), ...[...dayRecord.keys()].filter((d) => d < cutoff)]);
  for (const day of xpDays) {
    const r = dayRecord.get(day);
    const x: DayXp = computeDayXp(
      byDay.get(day) ?? [],
      r?.streak_at_start ?? 0,
      r?.daily_clear ?? false,
    );
    if (x.total === 0 && x.bonus === 0) continue;
    month(day).xp[day] = [x.byStat.STR, x.byStat.INT, x.byStat.WIL, x.bonus, x.total];
  }

  const entriesBy = new Map<string, ProgressEntry[]>();
  for (const e of input.entries) {
    const list = entriesBy.get(e.quest_instance_id) ?? [];
    list.push(e);
    entriesBy.set(e.quest_instance_id, list);
  }
  for (const i of input.instances) {
    if (i.deleted_at || !compactable(i, cutoff)) continue;
    const entries = entriesBy.get(i.id) ?? [];
    const value =
      i.measure_snapshot === 'check' || entries.length === 0
        ? null
        : progressValue(i.measure_snapshot, entries);
    month(i.day).instances.push([
      i.id,
      i.source_type,
      i.source_id,
      i.day,
      i.status,
      i.core_snapshot ? 1 : 0,
      i.auto_source_snapshot ?? null,
      i.stat_snapshot,
      i.measure_snapshot,
      value,
      i.skill_ids_snapshot ?? [],
    ]);
  }

  for (const s of input.sessions) {
    if (s.deleted_at || s.day >= cutoff) continue;
    month(s.day).sessions.push([
      s.id,
      s.quest_instance_id,
      s.stat,
      s.skill_ids,
      s.planned_min,
      s.actual_min,
      s.completed ? 1 : 0,
      s.face_down ? 1 : 0,
      s.started_at,
      s.ended_at,
      s.day,
    ]);
  }

  const bodyBy = new Map<string, BodyLog[]>();
  for (const b of input.bodyLogs) {
    if (b.deleted_at || b.day >= cutoff) continue;
    const list = bodyBy.get(monthOf(b.day)) ?? [];
    list.push(b);
    bodyBy.set(monthOf(b.day), list);
  }
  for (const [key, logs] of bodyBy) {
    const sorted = [...logs].sort((a, b) => a.day.localeCompare(b.day));
    const weights = sorted.flatMap((l) => (l.weight === null ? [] : [l.weight]));
    month(`${key}-01`).body = {
      days: logs.length,
      sleep: avg(logs.flatMap((l) => (l.sleep_hours === null ? [] : [l.sleep_hours]))),
      steps: avg(logs.flatMap((l) => (l.steps === null ? [] : [l.steps]))),
      weight: avg(weights),
      waist: avg(logs.flatMap((l) => (l.waist === null ? [] : [l.waist]))),
      weightFirst: weights[0] ?? null,
      weightLast: weights.at(-1) ?? null,
    };
  }

  for (const e of input.learning) {
    if (e.deleted_at || e.day >= cutoff) continue;
    const key = `${e.kind}:${e.type}:${e.outcome ?? '-'}`;
    const m = month(e.day);
    m.learning[key] = (m.learning[key] ?? 0) + 1;
  }
  return months;
}

/** What the engines read, rebuilt from summaries (minimal fields, no snapshots or text). */
export interface Expanded {
  dayXp: Map<DayString, DayXp>;
  instances: QuestInstance[];
  entries: ProgressEntry[];
  sessions: FocusSession[];
  bodyDays: number;
}

const BASE = { created_at: '', updated_at: '', deleted_at: null, schema_version: 1, hlc: '' };

export function expandSummaries(summaries: readonly { data: Record<string, unknown> }[]): Expanded {
  const out: Expanded = { dayXp: new Map(), instances: [], entries: [], sessions: [], bodyDays: 0 };
  for (const s of summaries) {
    const m = s.data as unknown as MonthSummary;
    if (m.version !== 1) continue;
    for (const [day, [STR, INT, WIL, bonus, total]] of Object.entries(m.xp)) {
      out.dayXp.set(day, { byStat: { STR, INT, WIL }, bonus, total });
    }
    for (const [
      id,
      source_type,
      source_id,
      day,
      status,
      core,
      auto,
      stat,
      measure,
      value,
      skills,
    ] of m.instances) {
      out.instances.push({
        ...BASE,
        id,
        source_type,
        source_id,
        day,
        status,
        title_snapshot: '',
        stat_snapshot: stat,
        difficulty_snapshot: 'normal',
        measure_snapshot: measure,
        target_snapshot: null,
        min_snapshot: null,
        full_version_snapshot: '',
        min_version_snapshot: '',
        core_snapshot: core === 1,
        auto_source_snapshot: auto ?? 'none',
        completed_at: null,
        completed_via: null,
        award_revision: 0,
        skill_ids_snapshot: skills,
      });
      if (value !== null) {
        out.entries.push({
          ...BASE,
          id: `summary:${id}`,
          quest_instance_id: id,
          source: 'manual',
          amount: value,
          occurred_at: `${day}T12:00:00.000Z`,
          day,
          ref_id: null,
        });
      }
    }
    for (const [
      id,
      qi,
      stat,
      skills,
      planned,
      actual,
      completed,
      faceDown,
      started,
      ended,
      day,
    ] of m.sessions) {
      out.sessions.push({
        ...BASE,
        id,
        quest_instance_id: qi,
        stat,
        skill_ids: skills,
        planned_min: planned,
        break_min: 0,
        actual_min: actual,
        completed: completed === 1,
        face_down: faceDown === 1,
        started_at: started,
        ended_at: ended,
        day,
      });
    }
    out.bodyDays += m.body.days;
  }
  return out;
}
