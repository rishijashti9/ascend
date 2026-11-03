import type { AscendDB, TableName } from '@/core/db/db';
import type { Compaction, DayString, Summary } from '@/core/db/types';
import { newBase, touch } from '@/core/pipeline/records';
import { buildSummaries, compactable, type MonthSummary } from './summaries';

/**
 * Applying a compaction (SPEC 6.7 D), inside the caller's transaction over COMPACTION_TABLES:
 * old detail becomes monthly summaries and is then removed for good (not soft-deleted — the
 * point is to free space). The cutoff is always the first day of a month, so a month is
 * summarised whole. `plan()` computes everything first so a preview shows the same numbers.
 */
export const COMPACTION_TABLES: TableName[] = [
  'days',
  'xp_events',
  'quest_instances',
  'progress_entries',
  'focus_sessions',
  'body_logs',
  'photos',
  'plan_history',
  'plan_proposals',
  'learning_events',
  'summaries',
  'compactions',
];

export const monthStart = (day: DayString): DayString => `${day.slice(0, 7)}-01`;

export interface CompactionPlan {
  cutoff: DayString;
  months: Map<string, MonthSummary>;
  /** Ids to remove per table. */
  remove: Partial<Record<TableName, string[]>>;
  /** Approximate JSON bytes removed minus summary bytes added. */
  bytesSaved: number;
}

export async function planCompaction(
  db: AscendDB,
  cutoffDay: DayString,
  removePhotos: boolean,
): Promise<CompactionPlan> {
  const cutoff = monthStart(cutoffDay);
  const before = <T extends { day: string }>(rows: T[]) => rows.filter((r) => r.day < cutoff);
  const [days, xpEvents, instances, sessions, bodyLogs, learning] = await Promise.all([
    db.days.toArray(),
    before(await db.xp_events.where('day').below(cutoff).toArray()),
    before(await db.quest_instances.where('day').below(cutoff).toArray()),
    before(await db.focus_sessions.where('day').below(cutoff).toArray()),
    before(await db.body_logs.where('day').below(cutoff).toArray()),
    before(await db.learning_events.where('day').below(cutoff).toArray()),
  ]);
  const old = instances.filter((i) => compactable(i, cutoff));
  const oldIds = new Set(old.map((i) => i.id));
  const entries = (await db.progress_entries.where('day').below(cutoff).toArray()).filter((e) =>
    oldIds.has(e.quest_instance_id),
  );
  const cutoffIso = `${cutoff}T00:00:00.000Z`;
  const plans = (await db.plan_history.toArray()).filter((h) => h.created_at < cutoffIso);
  const proposals = (await db.plan_proposals.toArray()).filter(
    (p) => p.created_at < cutoffIso && p.status !== 'pending',
  );
  const photos = removePhotos ? before(await db.photos.where('day').below(cutoff).toArray()) : [];
  // A learning "week" record and notification plans are numbers; keep the last year anyway.
  const months = buildSummaries({
    cutoff,
    days,
    xpEvents,
    instances: old,
    entries,
    sessions,
    bodyLogs,
    learning,
  });
  const size = (rows: unknown[]) => JSON.stringify(rows).length;
  const removedBytes =
    size(xpEvents) +
    size(old) +
    size(entries) +
    size(sessions) +
    size(bodyLogs) +
    size(plans) +
    size(proposals) +
    size(learning) +
    photos.reduce((s, p) => s + ((p as { blob?: Blob }).blob?.size ?? 0), 0);
  return {
    cutoff,
    months,
    remove: {
      xp_events: xpEvents.map((e) => e.id),
      quest_instances: old.map((i) => i.id),
      progress_entries: entries.map((e) => e.id),
      focus_sessions: sessions.map((s) => s.id),
      body_logs: bodyLogs.map((b) => b.id),
      plan_history: plans.map((h) => h.id),
      plan_proposals: proposals.map((p) => p.id),
      learning_events: learning.map((e) => e.id),
      photos: photos.map((p) => p.id),
    },
    bytesSaved: Math.max(0, removedBytes - size([...months.values()])),
  };
}

/** Writes the summaries (merging into an existing month's), removes the detail, logs it. */
export async function applyCompaction(
  db: AscendDB,
  plan: CompactionPlan,
  at: string,
): Promise<Compaction> {
  for (const [month, data] of plan.months) {
    const id = `summary:month:${month}`;
    const existing = await db.summaries.get(id);
    const merged: MonthSummary = existing
      ? mergeMonth(existing.data as unknown as MonthSummary, data)
      : data;
    const record: Summary = existing
      ? {
          ...existing,
          data: merged as unknown as Record<string, unknown>,
          deleted_at: null,
          ...touch(at),
        }
      : {
          ...newBase(id, at),
          period_type: 'month',
          period: month,
          data: merged as unknown as Record<string, unknown>,
        };
    await db.summaries.put(record);
  }
  const removed: Record<string, number> = {};
  for (const [table, ids] of Object.entries(plan.remove)) {
    if (!ids || ids.length === 0) continue;
    await db.table(table).bulkDelete(ids);
    removed[table] = ids.length;
  }
  const record: Compaction = {
    ...newBase(`compaction:${plan.cutoff}`, at),
    cutoff_day: plan.cutoff,
    removed,
    bytes_saved: plan.bytesSaved,
    photos_removed: (plan.remove.photos?.length ?? 0) > 0,
  };
  await db.compactions.put(record);
  return record;
}

/** A month summarised twice (e.g. records that arrived late) keeps both, without duplicates. */
function mergeMonth(a: MonthSummary, b: MonthSummary): MonthSummary {
  const ids = new Set(a.instances.map((i) => i[0]));
  const sids = new Set(a.sessions.map((s) => s[0]));
  const learning = { ...a.learning };
  for (const [k, v] of Object.entries(b.learning)) learning[k] = (learning[k] ?? 0) + v;
  return {
    version: 1,
    xp: { ...a.xp, ...b.xp },
    instances: [...a.instances, ...b.instances.filter((i) => !ids.has(i[0]))],
    sessions: [...a.sessions, ...b.sessions.filter((s) => !sids.has(s[0]))],
    body: b.body.days > 0 ? b.body : a.body,
    learning,
  };
}
