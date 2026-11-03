import type { Skill } from '@/core/db/types';
import {
  levelFor,
  projectNote,
  projectTitle,
  skillContributions,
  skillProgress,
  trackBalance,
  type SkillInput,
} from './skills';

const base = {
  created_at: '',
  updated_at: '',
  deleted_at: null,
  schema_version: 1,
  hlc: 'x',
};

function skill(
  id: string,
  track: Skill['track'] = 'ai_robotics',
  extra: Partial<Skill> = {},
): Skill {
  return {
    ...base,
    id,
    branch: track === 'games' ? 'Game development' : 'Robotics',
    track,
    name: id,
    parent_id: null,
    order: 0,
    manual_level_override: null,
    status: 'active',
    ...extra,
  };
}

const empty: SkillInput = {
  skills: [skill('ros'), skill('cpp'), skill('unreal', 'games')],
  evidence: [],
  sessions: [],
  instances: [],
  entries: [],
  quests: [],
};

type Session = SkillInput['sessions'][number];
type Instance = SkillInput['instances'][number];

const session = (extra: Partial<Session>): Session => ({
  id: 's1',
  quest_instance_id: null,
  skill_ids: [],
  actual_min: 50,
  ended_at: '2026-11-02T06:00:00.000Z',
  day: '2026-11-02',
  deleted_at: null,
  ...extra,
});

const instance = (extra: Partial<Instance>): Instance => ({
  id: 'h1:2026-11-02',
  source_type: 'habit',
  source_id: 'h1',
  day: '2026-11-02',
  status: 'pending',
  measure_snapshot: 'minutes',
  skill_ids_snapshot: ['ros'],
  deleted_at: null,
  ...extra,
});

const entry = (amount: number, source: 'manual' | 'focus' = 'manual') => ({
  quest_instance_id: 'h1:2026-11-02',
  source,
  amount,
  occurred_at: '2026-11-02T05:00:00.000Z',
  deleted_at: null,
});

describe('levelFor', () => {
  it('follows the hour thresholds, and the top levels need projects', () => {
    expect(levelFor(0, 0)).toBe(0);
    expect(levelFor(3 * 60, 0)).toBe(1);
    expect(levelFor(15 * 60, 0)).toBe(2);
    expect(levelFor(50 * 60, 0)).toBe(3);
    expect(levelFor(500 * 60, 0)).toBe(3); // no project yet
    expect(levelFor(120 * 60, 1)).toBe(4);
    expect(levelFor(250 * 60, 1)).toBe(4);
    expect(levelFor(250 * 60, 2)).toBe(5);
    expect(levelFor(10, 9)).toBe(0); // projects alone don't level up
  });
});

describe('skill contributions', () => {
  it('a tagged session counts for its skills, split evenly', () => {
    const c = skillContributions({
      ...empty,
      sessions: [session({ skill_ids: ['ros', 'cpp'] })],
    });
    expect(c.map((x) => [x.skillId, x.minutes])).toEqual([
      ['ros', 25],
      ['cpp', 25],
    ]);
  });

  it('a minutes quest counts manual and untagged focus minutes once', () => {
    const p = skillProgress({
      ...empty,
      instances: [instance({})],
      entries: [entry(30), entry(50, 'focus')],
      sessions: [session({ quest_instance_id: 'h1:2026-11-02' })], // no own tags
    });
    expect(p.get('ros')?.minutes).toBe(80);
  });

  it('a linked session with its own tags moves its minutes to those skills', () => {
    const p = skillProgress({
      ...empty,
      instances: [instance({})],
      entries: [entry(30), entry(50, 'focus')],
      sessions: [session({ quest_instance_id: 'h1:2026-11-02', skill_ids: ['cpp'] })],
    });
    expect(p.get('ros')?.minutes).toBe(30);
    expect(p.get('cpp')?.minutes).toBe(50);
  });

  it('an un-ticked quest gives its minutes back; finished non-minute quests count 30 min', () => {
    const p = skillProgress({
      ...empty,
      instances: [
        instance({}),
        instance({
          id: 'q1',
          source_type: 'quest',
          source_id: 'q1',
          measure_snapshot: 'check',
          status: 'done_full',
        }),
        instance({ id: 'q2', source_type: 'quest', source_id: 'q2', measure_snapshot: 'check' }),
      ],
      entries: [entry(40), entry(-40)],
      quests: [
        { id: 'q1', skill_ids: ['unreal'], deleted_at: null },
        { id: 'q2', skill_ids: ['unreal'], deleted_at: null }, // not done
      ],
    });
    expect(p.get('ros')?.minutes).toBe(0);
    expect(p.get('unreal')).toMatchObject({ minutes: 30, questsDone: 1 });
  });

  it('instances from before skills existed count for nothing', () => {
    const p = skillProgress({
      ...empty,
      instances: [instance({ skill_ids_snapshot: undefined })],
      entries: [entry(60)],
    });
    expect(p.get('ros')?.minutes).toBe(0);
  });

  it('projects count as proof (and their minutes); unknown or deleted skills are ignored', () => {
    const p = skillProgress({
      ...empty,
      skills: [...empty.skills, skill('gone', 'other', { deleted_at: 'x' })],
      sessions: [session({ skill_ids: ['gone', 'ros', 'nope'] })],
      evidence: [
        {
          ...base,
          id: 'e1',
          skill_id: 'ros',
          type: 'project',
          ref_id: null,
          minutes: 600,
          note: 'Line follower\nROS 2 + Gazebo',
          link: null,
          day: '2026-11-01',
        },
      ],
    });
    expect(p.has('gone')).toBe(false);
    expect(p.get('ros')).toMatchObject({ minutes: 650, projects: 1, computedLevel: 1 });
  });

  it('a manual level wins but the computed one is kept', () => {
    const p = skillProgress({
      ...empty,
      skills: [skill('ros', 'ai_robotics', { manual_level_override: 3 })],
    });
    expect(p.get('ros')).toMatchObject({ level: 3, computedLevel: 0, overridden: true });
    expect(p.get('ros')?.next).toEqual({ level: 1, hours: 3, projects: 0 });
  });
});

describe('70/30 balance', () => {
  it('splits a week by track, leaving other branches out of the share', () => {
    const input: SkillInput = {
      ...empty,
      skills: [...empty.skills, skill('git', 'other')],
      sessions: [
        session({ id: 'a', skill_ids: ['ros'], actual_min: 140 }),
        session({ id: 'b', skill_ids: ['unreal'], actual_min: 60 }),
        session({ id: 'c', skill_ids: ['git'], actual_min: 30 }),
        session({ id: 'd', skill_ids: ['ros'], actual_min: 999, day: '2026-10-25' }),
      ],
    };
    const b = trackBalance(skillContributions(input), input.skills, '2026-11-02', '2026-11-08');
    expect(b.minutes).toEqual({ ai_robotics: 140, games: 60, other: 30 });
    expect(b.aiShare).toBeCloseTo(0.7);
    expect(trackBalance([], input.skills, '2026-11-02', '2026-11-08').aiShare).toBeNull();
  });
});

describe('project text', () => {
  it('title is the first line, the rest is the note', () => {
    expect(projectTitle({ note: 'Arm IK\nWorks in sim' })).toBe('Arm IK');
    expect(projectNote({ note: 'Arm IK\nWorks in sim' })).toBe('Works in sim');
    expect(projectNote({ note: 'Arm IK' })).toBeNull();
  });
});
