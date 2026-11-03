import type { JobApplication } from '@/core/db/types';
import { setNow } from '@/core/time';
import { createTestDb, ist } from '@/test/testDb';
import { RuleError } from '..';
import { applicationQuestId, interviewQuestId, isApplyQuest } from './jobs';

let t: Awaited<ReturnType<typeof createTestDb>>;
const DAY = '2026-11-02';

beforeEach(async () => {
  t = await createTestDb();
});
afterEach(() => t.cleanup());

const v = async <R>(action: Parameters<typeof t.run>[0]) => (await t.run<R>(action)).value as R;
const create = (payload: object) => v<JobApplication>({ type: 'job.create', payload });
const stage = (id: string, s: string) =>
  v<JobApplication>({ type: 'job.setStage', payload: { id, stage: s } });

async function xpFor(ref: string) {
  return (await t.db.xp_events.where('ref_id').equals(ref).toArray()).reduce(
    (sum, e) => sum + e.base_amount,
    0,
  );
}

describe('job.create', () => {
  it('logging an application completes an automatic Easy "Applied" side quest (INT XP)', async () => {
    const job = await create({ company: 'Agile Robots', role: 'Robotics intern' });
    expect(job).toMatchObject({
      stage: 'applied',
      applied_at: DAY,
      follow_up_at: '2026-11-09',
      linked_quest_instance_id: applicationQuestId(job.id),
    });
    const quest = await t.db.quests.get(applicationQuestId(job.id));
    expect(quest).toMatchObject({
      type: 'side',
      title: 'Applied: Agile Robots',
      difficulty: 'easy',
    });
    const inst = await t.db.quest_instances.get(applicationQuestId(job.id));
    expect(inst).toMatchObject({ status: 'done_full', completed_via: 'job_log' });
    expect(await xpFor(applicationQuestId(job.id))).toBe(10);
    const [event] = await t.db.xp_events.toArray();
    expect(event?.stat).toBe('INT');
  });

  it('a saved job gives nothing until it is applied for', async () => {
    const job = await create({ company: 'NEURA', role: 'ML engineer', stage: 'saved' });
    expect(job).toMatchObject({ applied_at: null, follow_up_at: null });
    expect(await t.db.xp_events.count()).toBe(0);
    const applied = await stage(job.id, 'applied');
    expect(applied).toMatchObject({ applied_at: DAY, follow_up_at: '2026-11-09' });
    expect(await xpFor(applicationQuestId(job.id))).toBe(10);
  });

  it('counts toward an open "apply" count quest instead, if there is one', async () => {
    await t.run({
      type: 'quest.create',
      payload: {
        type: 'weekly',
        title: 'Send 3 applications',
        stat: 'INT',
        measure: 'count',
        target_value: 3,
      },
    });
    const weekly = (await t.db.quest_instances.toArray())[0];
    if (!weekly) throw new Error('no weekly quest');
    const a = await create({ company: 'A', role: 'R' });
    await create({ company: 'B', role: 'R' });
    expect(a.linked_quest_instance_id).toBe(weekly.id);
    expect(await t.db.quests.get(applicationQuestId(a.id))).toBeUndefined();
    const entries = await t.db.progress_entries.toArray();
    expect(entries.map((e) => [e.amount, e.source])).toEqual([
      [1, 'job_log'],
      [1, 'job_log'],
    ]);
    await create({ company: 'C', role: 'R' });
    expect((await t.db.quest_instances.get(weekly.id))?.status).toBe('done_full');
    // Full: the next application gets its own side quest.
    const d = await create({ company: 'D', role: 'R' });
    expect(d.linked_quest_instance_id).toBe(applicationQuestId(d.id));
  });

  it('refuses a broken link or a future application day', async () => {
    await expect(create({ company: 'X', role: 'R', link: 'not a link' })).rejects.toThrow('http');
    await expect(create({ company: 'X', role: 'R', applied_at: '2026-11-05' })).rejects.toThrow(
      RuleError,
    );
  });
});

describe('job.setStage', () => {
  it('an interview gets its own Normal side quest; each stage counts once', async () => {
    const job = await create({ company: 'Franka', role: 'Intern' });
    await stage(job.id, 'assessment');
    await stage(job.id, 'interview');
    expect(await t.db.quests.get(interviewQuestId(job.id))).toMatchObject({
      title: 'Interview: Franka',
      difficulty: 'normal',
    });
    expect(await xpFor(interviewQuestId(job.id))).toBe(25);
    const history = (await t.db.job_applications.get(job.id))?.stage_history.map((h) => h.stage);
    expect(history).toEqual(['applied', 'assessment', 'interview']);
    // Same tap twice → still one award.
    await stage(job.id, 'interview');
    expect(await t.db.xp_events.count()).toBe(2);
  });

  it('jumping from saved straight to interview counts the application too', async () => {
    const job = await create({ company: 'X', role: 'R', stage: 'saved' });
    await stage(job.id, 'interview');
    expect(await xpFor(applicationQuestId(job.id))).toBe(10);
    expect(await xpFor(interviewQuestId(job.id))).toBe(25);
  });

  it('moving back the same day takes the XP back; moving forward again gives it once', async () => {
    const job = await create({ company: 'X', role: 'R' });
    await stage(job.id, 'interview');
    await stage(job.id, 'applied');
    expect(await xpFor(interviewQuestId(job.id))).toBe(0);
    expect((await t.db.quests.get(interviewQuestId(job.id)))?.status).toBe('archived');
    await stage(job.id, 'saved');
    expect(await xpFor(applicationQuestId(job.id))).toBe(0);
    expect((await t.db.job_applications.get(job.id))?.follow_up_at).toBeNull();
    await stage(job.id, 'interview');
    expect(await xpFor(applicationQuestId(job.id))).toBe(10);
    expect(await xpFor(interviewQuestId(job.id))).toBe(25);
  });

  it('a later day keeps the XP — it really happened', async () => {
    const job = await create({ company: 'X', role: 'R' });
    setNow(ist(2026, 11, 3, 10));
    await stage(job.id, 'saved');
    expect(await xpFor(applicationQuestId(job.id))).toBe(10);
  });

  it('closed stages clear the follow-up; rejection gives no XP', async () => {
    const job = await create({ company: 'X', role: 'R' });
    const rejected = await stage(job.id, 'rejected');
    expect(rejected.follow_up_at).toBeNull();
    expect(await t.db.xp_events.count()).toBe(1);
  });
});

describe('job.update / job.delete', () => {
  it('edits fields; empty text clears them', async () => {
    const job = await create({ company: 'X', role: 'R', notes: 'Referral' });
    const next = await v<JobApplication>({
      type: 'job.update',
      payload: { id: job.id, changes: { notes: '', salary_range: '€45–55k', follow_up_at: null } },
    });
    expect(next).toMatchObject({ notes: null, salary_range: '€45–55k', follow_up_at: null });
  });

  it('deleting the same day takes back the automatic quest', async () => {
    const job = await create({ company: 'X', role: 'R' });
    await t.run({ type: 'job.delete', payload: { id: job.id } });
    expect((await t.db.job_applications.get(job.id))?.deleted_at).not.toBeNull();
    expect(await xpFor(applicationQuestId(job.id))).toBe(0);
    await expect(stage(job.id, 'interview')).rejects.toThrow(RuleError);
  });
});

describe('isApplyQuest', () => {
  it('needs a count quest about applying', () => {
    const q = (title: string, measure: 'count' | 'check' = 'count') => ({
      title_snapshot: title,
      measure_snapshot: measure,
    });
    expect(isApplyQuest(q('Send 5 tailored applications'))).toBe(true);
    expect(isApplyQuest(q('Apply to 3 labs'))).toBe(true);
    expect(isApplyQuest(q('Send 5 tailored applications', 'check'))).toBe(false);
    expect(isApplyQuest(q('Applied maths revision'))).toBe(false);
  });
});
