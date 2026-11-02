import { createTestDb } from '@/test/testDb';

let t: Awaited<ReturnType<typeof createTestDb>>;
const DAY = '2026-11-02';
const jpeg = (n = 3) => new Blob([new Uint8Array(n).fill(7)], { type: 'image/jpeg' });

beforeEach(async () => {
  t = await createTestDb();
});
afterEach(() => t.cleanup());

const add = async (payload: object) =>
  (await t.run<string>({ type: 'photo.add', payload })).value as string;

describe('body photos', () => {
  it('one photo per day, linked from the body log; a new one replaces the old', async () => {
    const first = await add({ blob: jpeg() });
    expect((await t.db.body_logs.get(`body:${DAY}`))?.photo_id).toBe(first);
    const second = await add({ blob: jpeg(5) });
    expect(await t.db.photos.get(first)).toBeUndefined();
    expect((await t.db.body_logs.get(`body:${DAY}`))?.photo_id).toBe(second);
    // (fake-indexeddb in tests doesn't keep Blob contents; real browsers do.)
    expect(await t.db.photos.get(second)).toMatchObject({ day: DAY, mime: 'image/jpeg' });
  });

  it('delete really removes the photo and unlinks it', async () => {
    const id = await add({ blob: jpeg() });
    await t.run({ type: 'photo.delete', payload: { id } });
    expect(await t.db.photos.count()).toBe(0);
    expect((await t.db.body_logs.get(`body:${DAY}`))?.photo_id).toBeNull();
  });

  it('restore adds photos that are missing and skips ones already here', async () => {
    const id = await add({ blob: jpeg() });
    const r = await t.run<number>({
      type: 'photo.restore',
      payload: {
        photos: [
          { id, day: DAY, mime: 'image/jpeg', blob: jpeg() },
          { id: 'p2', day: '2026-10-30', mime: 'image/jpeg', blob: jpeg() },
        ],
      },
    });
    expect(r.value).toBe(1);
    expect((await t.db.body_logs.get('body:2026-10-30'))?.photo_id).toBe('p2');
  });

  it('photos are never part of the JSON backup', async () => {
    await add({ blob: jpeg() });
    const { buildBackup } = await import('@/core/backup/export');
    expect(Object.keys((await buildBackup(t.db)).tables)).not.toContain('photos');
  });
});
