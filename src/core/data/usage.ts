import type { AscendDB, TableName } from '@/core/db/db';

/**
 * What is stored on this device (SPEC 6.7 D "My data"): records and approximate size per kind.
 * Size = JSON characters of the records (photos: their image bytes) — an honest estimate of
 * what an export holds; the browser's own estimate of total space is shown alongside.
 */
export const DATA_GROUPS: { label: string; tables: TableName[] }[] = [
  {
    label: 'Daily quests and progress',
    tables: ['quest_instances', 'progress_entries', 'habits', 'quests'],
  },
  { label: 'XP and days', tables: ['xp_events', 'days', 'achievements_unlocked'] },
  {
    label: 'Goals and plans',
    tables: ['dreams', 'main_quests', 'milestones', 'plan_history', 'plan_proposals'],
  },
  { label: 'Focus sessions', tables: ['focus_sessions'] },
  { label: 'Body logs', tables: ['body_logs'] },
  { label: 'Body photos (this device only)', tables: ['photos'] },
  { label: 'Reviews and check-ins', tables: ['reviews'] },
  { label: 'Skills and jobs', tables: ['skills', 'skill_evidence', 'job_applications'] },
  { label: 'Learning (Adaptive System)', tables: ['learning_events'] },
  { label: 'Summaries (compacted history)', tables: ['summaries', 'compactions'] },
  { label: 'Profile and settings', tables: ['profile', 'settings', 'meta', 'pending_actions'] },
];

export interface GroupUsage {
  label: string;
  records: number;
  bytes: number;
}

export async function localUsage(db: AscendDB): Promise<GroupUsage[]> {
  const out: GroupUsage[] = [];
  for (const g of DATA_GROUPS) {
    let records = 0;
    let bytes = 0;
    for (const t of g.tables) {
      await db.table(t).each((row: Record<string, unknown>) => {
        records++;
        const blob = row.blob;
        bytes += blob instanceof Blob ? blob.size : JSON.stringify(row).length;
      });
    }
    out.push({ label: g.label, records, bytes });
  }
  return out;
}

/** The browser/OS estimate of space used by the whole app (null when not available). */
export async function deviceEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e?.usage !== undefined && e.quota !== undefined
      ? { usage: e.usage, quota: e.quota }
      : null;
  } catch {
    return null;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
