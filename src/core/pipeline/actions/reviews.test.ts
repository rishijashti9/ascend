import type { Review } from '@/core/db/types';
import { createTestDb } from '@/test/testDb';
import { RuleError } from '..';

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeEach(async () => {
  t = await createTestDb(); // 2026-11-02
});
afterEach(() => t.cleanup());

const save = async (payload: object) =>
  (await t.run<Review>({ type: 'review.save', payload })).value as Review;

describe('review.save', () => {
  it('one daily check-in per day; saving again updates only what was sent', async () => {
    await save({
      type: 'daily',
      period: '2026-11-02',
      energy: 3,
      mood: 4,
      win: 'Finished ROS tutorial',
    });
    const r = await save({ type: 'daily', period: '2026-11-02', lesson: 'Start earlier' });
    expect(r).toMatchObject({
      id: 'review:daily:2026-11-02',
      energy: 3,
      mood: 4,
      win: 'Finished ROS tutorial',
      lesson: 'Start earlier',
    });
    expect(await t.db.reviews.count()).toBe(1);
  });

  it('empty text clears; energy/mood stay within 1–5', async () => {
    await save({ type: 'daily', period: '2026-11-02', win: 'x', energy: 2 });
    expect((await save({ type: 'daily', period: '2026-11-02', win: '  ' })).win).toBeNull();
    await expect(save({ type: 'daily', period: '2026-11-02', energy: 6 })).rejects.toThrow();
  });

  it('periods must be valid and already started', async () => {
    await expect(save({ type: 'daily', period: '2026-11-03', mood: 3 })).rejects.toThrow(RuleError);
    await expect(save({ type: 'monthly', period: '2026-11-02', text: 'x' })).rejects.toThrow(
      /isn’t valid/,
    );
    await expect(
      save({ type: 'monthly', period: '2026-11', text: 'November' }),
    ).resolves.toBeDefined();
    await expect(
      save({ type: 'weekly', period: '2026-11-02', answers: { well: 'Study streak' } }),
    ).resolves.toMatchObject({
      answers: { well: 'Study streak' },
    });
  });
});
