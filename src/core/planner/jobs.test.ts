import type { Dream, JobApplication, JobStage, MainQuest, PlanProposal } from '@/core/db/types';
import { jobStats, type JobStats } from '@/core/engine/jobs';
import { newBase } from '@/core/pipeline';
import { setNow } from '@/core/time';
import { createTestDb, ist } from '@/test/testDb';
import { loadPlannerState, planMainQuest, planWeek, runWeeklyPlan, type ProposalItem } from '.';
import { applicationCount, jobSuggestion } from './jobs';

function stats(over: Partial<JobStats>): JobStats {
  return {
    ...jobStats([], '2026-11-02', 1),
    ...over,
  };
}

describe('jobSuggestion', () => {
  it('many endings at the interview → a mock interview', () => {
    const s = jobSuggestion(
      stats({ drops: { applied: 1, assessment: 0, interview: 3 }, mostDrop: 'interview' }),
    );
    expect(s).toMatchObject({ kind: 'interview', title: 'One mock interview' });
    expect(s?.reason).toMatch(/^3 applications ended at the interview/);
  });

  it('assessments, then a low response rate after enough applications', () => {
    expect(
      jobSuggestion(
        stats({ drops: { applied: 0, assessment: 4, interview: 0 }, mostDrop: 'assessment' }),
      )?.kind,
    ).toBe('assessment');
    expect(jobSuggestion(stats({ applied: 12, responded: 1, responseRate: 1 / 12 }))).toMatchObject(
      {
        kind: 'response',
        reason: '1 of 12 applications got an answer — a sharper CV can change that.',
      },
    );
    expect(jobSuggestion(stats({ applied: 6, responded: 0, responseRate: 0 }))).toBeNull();
    expect(
      jobSuggestion(
        stats({ drops: { applied: 0, assessment: 0, interview: 2 }, mostDrop: 'interview' }),
      ),
    ).toBeNull();
    expect(jobSuggestion(null)).toBeNull();
  });
});

describe('applicationCount', () => {
  it('turns "Send N … applications" into a count quest', () => {
    expect(applicationCount('Send 5 tailored applications')).toEqual({
      measure: 'count',
      target_value: 5,
    });
    expect(applicationCount('Follow up on applications older than a week')).toBeNull();
  });
});

describe('the weekly plan reads the job stats', () => {
  let t: Awaited<ReturnType<typeof createTestDb>>;
  let goal: MainQuest;

  beforeEach(async () => {
    t = await createTestDb(); // Monday 2026-11-02
    await t.db.profile.put({
      ...newBase('profile'),
      name: 'Rishi',
      start_day: '2026-10-01',
      onboarded_at: '2026-10-01T00:00:00.000Z',
      display_title: null,
    });
    await t.run({ type: 'settings.update', payload: { jobs_enabled: true } });
    const d = (await t.run<Dream>({ type: 'dream.create', payload: { title: 'Robotics' } }))
      .value as Dream;
    goal = (
      await t.run<MainQuest>({
        type: 'mainQuest.create',
        payload: { dream_id: d.id, title: 'Land a robotics internship', stat: 'INT' },
      })
    ).value as MainQuest;
  });
  afterEach(() => t.cleanup());

  async function applyPlan(items: ProposalItem[]) {
    const p = (
      await t.run<PlanProposal>({
        type: 'plan.propose',
        payload: {
          goal_type: 'main_quest',
          goal_id: goal.id,
          trigger: 'replan',
          summary: 's',
          answers: { applications_per_week: 4 },
          items,
        },
      })
    ).value as PlanProposal;
    await t.run({ type: 'plan.apply', payload: { id: p.id, selected: items.map((i) => i.id) } });
  }

  async function addJob(stages: JobStage[]) {
    const job = (
      await t.run<JobApplication>({ type: 'job.create', payload: { company: 'X', role: 'R' } })
    ).value as JobApplication;
    for (const s of stages)
      await t.run({ type: 'job.setStage', payload: { id: job.id, stage: s } });
  }

  it('the job-search plan counts applications, and interview endings add a mock interview', async () => {
    const plan = planMainQuest(await loadPlannerState(t.db), goal, { applications_per_week: 4 });
    expect(plan.templateId).toBe('jobs');
    await applyPlan(plan.items);
    for (let i = 0; i < 3; i++) await addJob(['interview', 'rejected']);

    // Finish the first milestone so the applications milestone is active next week.
    const [first] = (await t.db.milestones.toArray()).sort((a, b) => a.order - b.order);
    if (!first) throw new Error('no milestone');
    await t.run({ type: 'milestone.setStatus', payload: { id: first.id, status: 'done' } });
    const second = (await t.db.milestones.toArray()).find((m) => m.order === 1);
    if (second?.status !== 'active') {
      await t.run({ type: 'milestone.setStatus', payload: { id: second?.id, status: 'active' } });
    }

    setNow(ist(2026, 11, 9, 10));
    await t.run({ type: 'day.rollover', payload: {} });
    const items = planWeek(await loadPlannerState(t.db));
    const mock = items.find(
      (i) => i.kind === 'quest.create' && i.data.title === 'One mock interview',
    );
    expect(mock?.reason).toMatch(/3 applications ended at the interview/);
    const send = items.find(
      (i) => i.kind === 'quest.create' && i.data.title === 'Send 4 tailored applications',
    );
    expect(send?.kind === 'quest.create' && send.data).toMatchObject({
      measure: 'count',
      target_value: 4,
    });

    await runWeeklyPlan(t.db);
    const created = (await t.db.quests.toArray()).find(
      (q) => q.title === 'Send 4 tailored applications',
    );
    expect(created).toMatchObject({ measure: 'count', target_value: 4 });
    // A logged application now ticks the counted quest instead of making a side quest.
    await t.run({ type: 'job.create', payload: { company: 'Y', role: 'R' } });
    const entry = (await t.db.progress_entries.toArray()).find((e) => e.source === 'job_log');
    expect(entry?.quest_instance_id).toBe(`${created?.id}:2026-11-09`);
  });

  it('with the tracker switched off the planner ignores jobs', async () => {
    await t.run({ type: 'settings.update', payload: { jobs_enabled: false } });
    expect((await loadPlannerState(t.db)).jobStats).toBeNull();
  });
});
