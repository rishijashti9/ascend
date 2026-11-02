import type { MainQuest, Milestone } from '@/core/db/types';
import { goalNudges } from './nudges';

const base = (id: string, created = '2026-10-01T06:00:00.000Z') => ({
  id,
  created_at: created,
  updated_at: created,
  deleted_at: null,
  schema_version: 1,
  hlc: '0',
});

const quest = (over: Partial<MainQuest> = {}): MainQuest => ({
  ...base('q'),
  dream_id: 'd',
  title: 'MS in Germany',
  why: '',
  stat: 'INT',
  target_date: '2027-10-01',
  status: 'active',
  order: 0,
  planner_context: {},
  last_checkin_day: '2026-10-20',
  ...over,
});

const milestone = (over: Partial<Milestone> = {}): Milestone => ({
  ...base('m'),
  main_quest_id: 'q',
  title: 'IELTS 7.5',
  size_weight: 1,
  target_type: 'manual',
  target_value: null,
  current_source: null,
  estimated_weekly_quests: 8,
  target_date: '2026-10-29', // 28 days from 1 Oct
  status: 'active',
  done_at: null,
  planner_context: {},
  order: 0,
  ...over,
});

const run = (today: string, quests: MainQuest[], milestones: Milestone[], progress = 0) =>
  goalNudges({
    today,
    mainQuests: quests,
    milestones,
    milestoneProgress: { m: { progress } },
    dayOfIso: (iso) => iso.slice(0, 10),
  });

describe('goalNudges', () => {
  it('flags a milestone clearly behind schedule, with 1–2 weeks of grace', () => {
    expect(run('2026-10-05', [quest()], [milestone()])).toEqual([]); // < 7 days in
    expect(run('2026-10-15', [quest()], [milestone()], 0.4)).toEqual([]); // 50% of time, 40% done
    const risk = run('2026-10-15', [quest()], [milestone()], 0.1);
    expect(risk).toEqual([
      expect.objectContaining({
        kind: 'risk',
        milestoneId: 'm',
        message: expect.stringMatching(/10% done, 50% of its time/),
      }),
    ]);
  });

  it('a passed main-quest deadline is a risk too', () => {
    const r = run('2026-11-02', [quest({ target_date: '2026-10-31' })], []);
    expect(r[0]).toMatchObject({ kind: 'risk', milestoneId: null });
  });

  it('asks every ~30 days whether the goal still matters', () => {
    expect(run('2026-11-18', [quest()], [])).toEqual([]); // 29 days after the last check-in
    expect(run('2026-11-19', [quest()], [])).toEqual([
      expect.objectContaining({
        kind: 'checkin',
        message: 'Is MS in Germany still important to you?',
      }),
    ]);
    // Never checked in: counted from creation.
    expect(run('2026-10-31', [quest({ last_checkin_day: null })], [])[0]?.kind).toBe('checkin');
  });

  it('ignores paused goals', () => {
    expect(
      run('2026-12-31', [quest({ status: 'paused', target_date: '2026-11-01' })], [milestone()]),
    ).toEqual([]);
  });
});
