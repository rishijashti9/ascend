import { generateHistory } from '@/dev/generate';
import { computeProgress } from '@/core/engine/progressState';
import { skillProgress, type SkillInput } from '@/core/engine/skills';
import { addDays } from '@/core/time';
import { createTestDb, ist } from '@/test/testDb';
import { buildSummaries, compactable, expandSummaries } from './summaries';

/**
 * The compaction promise (SPEC 6.7 D): progress computed from summaries + the remaining detail
 * equals progress computed from the full detail.
 */
let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb(ist(2026, 8, 1, 10));
  await generateHistory({ days: 75, seed: 3, database: t.db });
}, 120_000);
afterAll(() => t.cleanup());

async function snapshot() {
  return {
    days: await t.db.days.toArray(),
    xpEvents: await t.db.xp_events.toArray(),
    instances: await t.db.quest_instances.toArray(),
    entries: await t.db.progress_entries.toArray(),
    sessions: await t.db.focus_sessions.toArray(),
    bodyLogs: await t.db.body_logs.toArray(),
    skills: await t.db.skills.toArray(),
    quests: await t.db.quests.toArray(),
  };
}

describe('compaction summaries', () => {
  it('progress (XP, levels, ranks, streaks, habit streaks, per day) is identical', async () => {
    const all = await snapshot();
    const today =
      all.days
        .map((d) => d.day)
        .sort()
        .at(-1) ?? '';
    const cutoff = addDays(today, -40);
    const before = computeProgress({ ...all, today });

    const months = buildSummaries({ cutoff, ...all, learning: [] });
    const expanded = expandSummaries([...months.values()].map((m) => ({ data: m as never })));
    const after = computeProgress({
      days: all.days, // days are never compacted
      xpEvents: all.xpEvents.filter((e) => e.day >= cutoff),
      instances: [...all.instances.filter((i) => !compactable(i, cutoff)), ...expanded.instances],
      today,
      compactedXp: expanded.dayXp,
    });
    expect(after.level).toEqual(before.level);
    expect(after.stats).toEqual(before.stats);
    expect(after.rank).toBe(before.rank);
    expect(after.streak).toEqual(before.streak);
    expect(after.habitStreaks).toEqual(before.habitStreaks);
    expect(after.perDay).toEqual(before.perDay);
    expect(expanded.instances.length).toBeGreaterThan(50);
  }, 60_000);

  it('skill minutes and levels are identical; summaries are much smaller than the detail', async () => {
    const all = await snapshot();
    const today =
      all.days
        .map((d) => d.day)
        .sort()
        .at(-1) ?? '';
    const cutoff = addDays(today, -40);
    const skills = all.skills.length
      ? all.skills
      : [
          {
            id: 'sk',
            created_at: '',
            updated_at: '',
            deleted_at: null,
            schema_version: 1,
            hlc: '',
            branch: 'b',
            track: 'other' as const,
            name: 'S',
            parent_id: null,
            order: 0,
            manual_level_override: null,
            status: 'active' as const,
          },
        ];
    // Tag every minutes instance with a skill so the comparison is meaningful.
    const tagged = all.instances.map((i) =>
      i.measure_snapshot === 'minutes' ? { ...i, skill_ids_snapshot: [skills[0]?.id ?? 'sk'] } : i,
    );
    const input = (
      instances: SkillInput['instances'],
      entries: SkillInput['entries'],
      sessions: SkillInput['sessions'],
    ): SkillInput => ({
      skills,
      evidence: [],
      sessions,
      instances,
      entries,
      quests: all.quests,
    });
    const before = skillProgress(input(tagged, all.entries, all.sessions));
    const months = buildSummaries({ cutoff, ...all, instances: tagged, learning: [] });
    const ex = expandSummaries([...months.values()].map((m) => ({ data: m as never })));
    const keptIds = new Set(tagged.filter((i) => !compactable(i, cutoff)).map((i) => i.id));
    const after = skillProgress(
      input(
        [...tagged.filter((i) => keptIds.has(i.id)), ...ex.instances],
        [...all.entries.filter((e) => keptIds.has(e.quest_instance_id)), ...ex.entries],
        [...all.sessions.filter((s) => s.day >= cutoff), ...ex.sessions],
      ),
    );
    for (const [id, p] of before) {
      expect(after.get(id)?.minutes).toBeCloseTo(p.minutes, 6);
      expect(after.get(id)?.level).toBe(p.level);
    }
    const detail = JSON.stringify([
      tagged.filter((i) => !keptIds.has(i.id)),
      all.entries.filter((e) => !keptIds.has(e.quest_instance_id)),
      all.xpEvents.filter((e) => e.day < cutoff),
    ]).length;
    expect(JSON.stringify([...months.values()]).length).toBeLessThan(detail * 0.35);
  }, 60_000);
});
