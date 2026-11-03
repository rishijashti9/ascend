import { skillProgress } from '@/core/engine/skills';
import { habitFieldsOf, STARTER_HABITS } from '@/data/starter';
import { SKILL_SEED, seedSkillId } from '@/data/skills';
import { createTestDb } from '@/test/testDb';
import { ensureInstancesForDay, RuleError } from '..';
import { SEED_HLC } from './skills';

let t: Awaited<ReturnType<typeof createTestDb>>;
const DAY = '2026-11-02';
const ROS = seedSkillId('Robotics', 'ROS 2');
const CPP = seedSkillId('Robotics', 'C++');

beforeEach(async () => {
  t = await createTestDb();
});
afterEach(() => t.cleanup());

const v = async <R>(action: Parameters<typeof t.run>[0]) => (await t.run<R>(action)).value as R;

const seed = () => v<number>({ type: 'skills.seed', source: 'system', payload: {} });
const total = SKILL_SEED.reduce((n, b) => n + b.skills.length, 0);

describe('skills.seed', () => {
  it('adds the roadmap once, with ids every device shares and the lowest clock', async () => {
    expect(await seed()).toBe(total);
    expect(await seed()).toBe(0);
    const ros = await t.db.skills.get(ROS);
    expect(ros).toMatchObject({ branch: 'Robotics', track: 'ai_robotics', hlc: SEED_HLC });
    expect(CPP).toBe('skill:robotics:cpp');
    expect(seedSkillId('Game development', 'C++ for games')).toBe(
      'skill:game-development:cpp-for-games',
    );
  });

  it('never brings back a deleted skill, but fills in missing ones', async () => {
    await seed();
    await t.run({ type: 'skill.archive', payload: { id: ROS, archived: true } });
    await t.run({ type: 'skill.delete', payload: { id: ROS } });
    await t.db.skills.delete(CPP); // e.g. restored from a backup made before skills existed
    expect(await seed()).toBe(1);
    expect((await t.db.skills.get(ROS))?.deleted_at).not.toBeNull();
    expect(await t.db.skills.get(CPP)).toBeDefined();
  });
});

describe('editing the tree', () => {
  beforeEach(seed);

  it('a new skill in an existing branch takes the branch’s track; duplicates are refused', async () => {
    const s = await v<{ track: string; id: string }>({
      type: 'skill.create',
      payload: { branch: 'robotics', name: 'Motion planning', track: 'games' },
    });
    expect(s).toMatchObject({ track: 'ai_robotics', branch: 'Robotics' });
    await expect(
      t.run({ type: 'skill.create', payload: { branch: 'Robotics', name: 'ros 2' } }),
    ).rejects.toThrow(RuleError);
    const german = await v<{ track: string }>({
      type: 'skill.create',
      payload: { branch: 'Languages', name: 'German' },
    });
    expect(german.track).toBe('other');
  });

  it('a parent must be in the same branch and can never loop', async () => {
    const child = await v<{ id: string }>({
      type: 'skill.create',
      payload: { branch: 'Robotics', name: 'Nav2', parent_id: ROS },
    });
    await expect(
      t.run({ type: 'skill.update', payload: { id: ROS, changes: { parent_id: child.id } } }),
    ).rejects.toThrow('under itself');
    await expect(
      t.run({
        type: 'skill.update',
        payload: { id: child.id, changes: { parent_id: seedSkillId('AI & ML', 'Python') } },
      }),
    ).rejects.toThrow('same branch');
    // Deleting the parent moves the child up a level.
    await t.run({ type: 'skill.archive', payload: { id: ROS, archived: true } });
    await t.run({ type: 'skill.delete', payload: { id: ROS } });
    expect((await t.db.skills.get(child.id))?.parent_id).toBeNull();
  });

  it('only an archived skill can be deleted', async () => {
    await expect(t.run({ type: 'skill.delete', payload: { id: ROS } })).rejects.toThrow(RuleError);
  });

  it('renaming a branch or changing its track updates all its skills', async () => {
    await t.run({
      type: 'skill.updateBranch',
      payload: { branch: 'Engineering', name: 'Software', track: 'ai_robotics' },
    });
    const sw = (await t.db.skills.toArray()).filter((s) => s.branch === 'Software');
    expect(sw).toHaveLength(3);
    expect(sw.every((s) => s.track === 'ai_robotics' && s.hlc !== SEED_HLC)).toBe(true);
    await expect(
      t.run({ type: 'skill.updateBranch', payload: { branch: 'Software', name: 'robotics' } }),
    ).rejects.toThrow('already a branch');
  });

  it('moves a skill among its siblings', async () => {
    await t.run({ type: 'skill.move', payload: { id: ROS, direction: 'up' } });
    const robotics = (await t.db.skills.toArray())
      .filter((s) => s.branch === 'Robotics')
      .sort((a, b) => a.order - b.order)
      .map((s) => s.name);
    expect(robotics.slice(0, 2)).toEqual(['ROS 2', 'C++']);
  });

  it('projects need a real link, are never in the future, and can be removed', async () => {
    await expect(
      t.run({ type: 'skill.addProject', payload: { skill_id: ROS, title: 'X', link: 'nope' } }),
    ).rejects.toThrow('http');
    await expect(
      t.run({
        type: 'skill.addProject',
        payload: { skill_id: ROS, title: 'X', day: '2026-12-01' },
      }),
    ).rejects.toThrow(RuleError);
    const p = await v<{ id: string; note: string }>({
      type: 'skill.addProject',
      payload: {
        skill_id: ROS,
        title: 'TurtleBot nav',
        note: 'SLAM in sim',
        link: 'https://github.com/x/y',
      },
    });
    expect(p.note).toBe('TurtleBot nav\nSLAM in sim');
    await t.run({ type: 'skill.deleteProject', payload: { id: p.id } });
    expect((await t.db.skill_evidence.get(p.id))?.deleted_at).not.toBeNull();
  });
});

describe('levels from real data', () => {
  it('a habit linked to a skill snapshots it on each day, so relinking never moves history', async () => {
    await seed();
    const study = STARTER_HABITS.find((h) => h.key === 'ai-study');
    if (!study) throw new Error('starter missing');
    const habit = await v<{ id: string }>({
      type: 'habit.create',
      payload: { ...habitFieldsOf(study), skill_ids: [ROS] },
    });
    await ensureInstancesForDay(t.db, DAY);
    const id = `${habit.id}:${DAY}`;
    expect((await t.db.quest_instances.get(id))?.skill_ids_snapshot).toEqual([ROS]);
    await t.run({ type: 'quest.logProgress', payload: { instanceId: id, amount: 40 } });
    // Done for today (min reached) → the link change applies from tomorrow.
    await t.run({ type: 'habit.update', payload: { id: habit.id, changes: { skill_ids: [CPP] } } });
    expect((await t.db.quest_instances.get(id))?.skill_ids_snapshot).toEqual([ROS]);

    const p = skillProgress({
      skills: await t.db.skills.toArray(),
      evidence: [],
      sessions: [],
      instances: await t.db.quest_instances.toArray(),
      entries: await t.db.progress_entries.toArray(),
      quests: [],
    });
    expect(p.get(ROS)?.minutes).toBe(40);
    expect(p.get(CPP)?.minutes).toBe(0);
  });

  it('a pending quest takes a new link straight away', async () => {
    const study = STARTER_HABITS.find((h) => h.key === 'ai-study');
    if (!study) throw new Error('starter missing');
    const habit = await v<{ id: string }>({
      type: 'habit.create',
      payload: habitFieldsOf(study),
    });
    await ensureInstancesForDay(t.db, DAY);
    await t.run({ type: 'habit.update', payload: { id: habit.id, changes: { skill_ids: [CPP] } } });
    expect((await t.db.quest_instances.get(`${habit.id}:${DAY}`))?.skill_ids_snapshot).toEqual([
      CPP,
    ]);
  });

  it('weekly and side quests can carry skills', async () => {
    const q = await v<{ skill_ids: string[] }>({
      type: 'quest.create',
      payload: { type: 'side', title: 'Write a ROS 2 node', stat: 'INT', skill_ids: [ROS] },
    });
    expect(q.skill_ids).toEqual([ROS]);
  });
});
