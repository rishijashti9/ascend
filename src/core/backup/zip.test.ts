import { strToU8, zipSync } from 'fflate';
import { createTestDb } from '@/test/testDb';
import { buildBackup } from './export';
import { parseBackup } from './format';
import { makeZip, readZip } from './zip';

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeEach(async () => {
  t = await createTestDb();
});
afterEach(() => t.cleanup());

const photo = (id: string, day: string) => ({
  id,
  day,
  mime: 'image/jpeg',
  blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' }),
  created_at: '',
  updated_at: '',
  deleted_at: null,
  schema_version: 1,
  hlc: '0',
});

describe('Export with photos (.zip)', () => {
  it('round-trips the backup and every photo', async () => {
    const backup = await buildBackup(t.db);
    const bytes = await makeZip(backup, [photo('a1', '2026-11-01'), photo('b2', '2026-11-02')]);
    const out = readZip(bytes);
    expect(parseBackup(out.backup).ok).toBe(true);
    expect(out.photos.map((p) => [p.id, p.day, p.mime]).sort()).toEqual([
      ['a1', '2026-11-01', 'image/jpeg'],
      ['b2', '2026-11-02', 'image/jpeg'],
    ]);
    expect(out.photos[0]?.blob.size).toBe(4);
  });

  it('explains files that are not an ASCEND export', () => {
    expect(() => readZip(new Uint8Array([1, 2, 3]))).toThrow(/couldn’t be opened/);
    expect(() => readZip(zipSync({ 'other.txt': strToU8('hi') }))).toThrow(
      /isn’t an ASCEND export/,
    );
  });
});
