import { buildBackup } from '@/core/backup/export';
import { readFacts } from '@/core/achievements/facts';
import { loadPlanInput } from '@/core/notifications/scheduler';
import { loadPlannerState } from '@/core/planner/state';
import { ensureInstancesForDay } from '@/core/pipeline';
import { loadProgress } from '@/core/state/progress';
import { loadSkills } from '@/core/state/skills';
import { loadToday } from '@/core/state/today';
import { localChanges } from '@/core/sync/engine';
import { createTestDb, ist } from '@/test/testDb';
import { generateTenYears, time } from './tenYears';

/**
 * 10-year performance test (SPEC 11 "fast with 10+ years of data", task 10.6). Run with
 * `npm run perf`. Times are printed as a table; budgets are about 3× the measured times in the test database
 * (fake-indexeddb in Node, itself several times slower than Chrome / the Android WebView), so a
 * real slowdown fails the test.
 */
const TODAY = '2026-11-02';

it('stays fast with 10 years of data', async () => {
  const t = await createTestDb(ist(2026, 11, 2, 9));
  const gen = await generateTenYears(t.db, TODAY);
  await ensureInstancesForDay(t.db, TODAY);

  const rows: [string, number, number][] = [];
  const measure = async (label: string, budget: number, fn: () => Promise<unknown>) => {
    rows.push([label, await time(fn), budget]);
  };

  // First check fills every day's derived fields (only happens once, e.g. after an import).
  await measure('consistency check — first run (fills 3,650 days)', 5_000, () =>
    t.run({ type: 'progress.rebuild', payload: {} }),
  );
  await measure('consistency check — every startup', 2_000, () =>
    t.run({ type: 'progress.rebuild', payload: {} }),
  );
  await measure('day rollover — closing 3,650 never-closed days (worst case)', 15_000, () =>
    t.run({ type: 'day.rollover', payload: {} }),
  );
  await measure('day rollover — every startup', 1_000, () =>
    t.run({ type: 'day.rollover', payload: {} }),
  );
  await measure('progress (level, rank, streaks) — after every change', 2_000, () =>
    loadProgress(t.db),
  );
  await measure('Today screen data', 500, () => loadToday(t.db));
  const walk = (await t.db.quest_instances.where('day').equals(TODAY).toArray()).find(
    (i) => i.measure_snapshot === 'check' && i.auto_source_snapshot === 'none',
  );
  await measure('one quest tap (pipeline + day + streaks)', 1_000, () =>
    t.run({ type: 'quest.complete', payload: { instanceId: walk?.id, version: 'full' } }),
  );
  await measure('skills screen data', 3_000, () => loadSkills(t.db));
  await measure('achievement facts', 3_000, () => readFacts(t.db));
  await measure('notification plan input', 500, () => loadPlanInput(t.db));
  await measure('planner state', 500, () => loadPlannerState(t.db));
  await measure('export (backup JSON)', 3_000, () => buildBackup(t.db));
  await measure('first sync upload — collect all records', 6_000, () => localChanges(t.db));

  const backup = JSON.stringify(await buildBackup(t.db));
  // The timing table is the point of this test.
  // eslint-disable-next-line no-console
  console.log(
    `\n10 years: ${Object.entries(gen.counts)
      .map(([k, v]) => `${k} ${v.toLocaleString('en')}`)
      .join(', ')}; backup ${(backup.length / 1_048_576).toFixed(1)} MB\n` +
      rows
        .map(([l, ms, b]) => `  ${l.padEnd(56)} ${String(ms).padStart(6)} ms  (budget ${b})`)
        .join('\n'),
  );
  for (const [label, ms, budget] of rows) expect(ms, label).toBeLessThan(budget);
  await t.cleanup();
}, 900_000);
