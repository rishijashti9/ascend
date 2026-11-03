import { FACT_TABLES, readFacts } from '@/core/achievements/facts';
import { skillProgress } from '@/core/engine/skills';
import { loadProgress } from '@/core/state/progress';
import { readSkillInput } from '@/core/state/skills';
import { addDays } from '@/core/time';
import { generateHistory } from '@/dev/generate';
import { createTestDb, ist } from '@/test/testDb';
import { applyCompaction, COMPACTION_TABLES, monthStart, planCompaction } from './apply';

/**
 * SPEC 6.7 D tests: progress (XP, levels, ranks, streaks, skill levels, days active) is identical
 * before and after compaction, and nothing newer than the chosen period is touched.
 */
let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb(ist(2026, 8, 1, 10));
  await generateHistory({ days: 80, seed: 5, database: t.db });
  // Give one skill to the minutes habits so skill levels are part of the comparison.
  const habits = await t.db.habits.toArray();
  const instances = await t.db.quest_instances.toArray();
  const skill = {
    id: 'sk',
    created_at: '',
    updated_at: '',
    deleted_at: null,
    schema_version: 1,
    hlc: '0',
    branch: 'b',
    track: 'other' as const,
    name: 'S',
    parent_id: null,
    order: 0,
    manual_level_override: null,
    status: 'active' as const,
  };
  await t.db.skills.put(skill);
  const minuteHabits = new Set(habits.filter((h) => h.measure === 'minutes').map((h) => h.id));
  await t.db.quest_instances.bulkPut(
    instances.map((i) =>
      minuteHabits.has(i.source_id) ? { ...i, skill_ids_snapshot: ['sk'] } : i,
    ),
  );
}, 180_000);
afterAll(() => t.cleanup());

async function measure() {
  const progress = await loadProgress(t.db);
  const facts = await t.db.transaction('r', FACT_TABLES, () => readFacts(t.db));
  const skills = skillProgress(await readSkillInput(t.db));
  return {
    progress: { ...progress, today: undefined },
    facts,
    skills: [...skills.values()].map((s) => [s.skillId, Math.round(s.minutes * 1000), s.level]),
    days: (await t.db.days.toArray()).map(({ hlc, updated_at, ...d }) => d), // eslint-disable-line @typescript-eslint/no-unused-vars
  };
}

it('progress, achievements facts, skill levels and days are identical after compaction', async () => {
  const before = await measure();
  const today = Object.keys(before.progress.perDay).sort().at(-1) ?? '';
  const cutoff = monthStart(addDays(today, -30));
  const newer = {
    instances: (await t.db.quest_instances.toArray()).filter((i) => i.day >= cutoff),
    xp: (await t.db.xp_events.toArray()).filter((e) => e.day >= cutoff),
  };

  const record = await t.db.transaction('rw', COMPACTION_TABLES, async () =>
    applyCompaction(t.db, await planCompaction(t.db, cutoff, false), new Date().toISOString()),
  );
  expect(record.cutoff_day).toBe(cutoff);
  expect(record.removed.quest_instances).toBeGreaterThan(50);
  expect(record.bytes_saved).toBeGreaterThan(0);
  expect(await t.db.xp_events.where('day').below(cutoff).count()).toBe(0);

  // The startup consistency check must not "fix" the compacted days.
  await t.run({ type: 'progress.rebuild', payload: {} });
  const after = await measure();
  expect(after.progress).toEqual(before.progress);
  expect(after.facts).toEqual(before.facts);
  expect(after.skills).toEqual(before.skills);
  expect(after.days).toEqual(before.days);

  // Nothing newer than the cutoff was touched.
  expect((await t.db.quest_instances.toArray()).filter((i) => i.day >= cutoff)).toEqual(
    newer.instances,
  );
  expect((await t.db.xp_events.toArray()).filter((e) => e.day >= cutoff)).toEqual(newer.xp);
}, 120_000);
