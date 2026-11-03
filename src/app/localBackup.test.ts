import { db } from '@/core/db/db';
import { newBase } from '@/core/pipeline';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import { KEEP_WEEKLY, runWeeklyLocalBackup, writeLocalBackup } from './localBackup';

const native = vi.hoisted(() => ({ on: true }));
vi.mock('./platform', () => ({ isNativeApp: () => native.on }));
const fs = vi.hoisted(() => ({
  files: new Map<string, string>(),
  refuseDocuments: false,
}));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Documents: 'DOCUMENTS', External: 'EXTERNAL' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    writeFile: vi.fn(
      async ({ path, directory, data }: { path: string; directory: string; data: string }) => {
        if (directory === 'DOCUMENTS' && fs.refuseDocuments) throw new Error('denied');
        fs.files.set(`${directory}/${path}`, data);
        return { uri: path };
      },
    ),
    readdir: vi.fn(async ({ path, directory }: { path: string; directory: string }) => ({
      files: [...fs.files.keys()]
        .filter((k) => k.startsWith(`${directory}/${path}/`))
        .map((k) => ({ name: k.split('/').pop() ?? '' })),
    })),
    deleteFile: vi.fn(async ({ path, directory }: { path: string; directory: string }) => {
      fs.files.delete(`${directory}/${path}`);
    }),
  },
}));
vi.mock('./files', () => ({ exportBackup: vi.fn(async () => 'saved') }));

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 10));
  fs.files.clear();
  fs.refuseDocuments = false;
  native.on = true;
  await db.profile.put({
    ...newBase('profile'),
    name: 'R',
    start_day: '2026-11-02',
    onboarded_at: '2026-11-02T00:00:00Z',
    display_title: null,
  });
});
afterEach(() => resetClock());

describe('Android weekly backup file', () => {
  it('writes once a week to Documents/ASCEND and keeps the newest 4', async () => {
    expect(await runWeeklyLocalBackup(db)).toBe('Documents/ASCEND/ascend-weekly-2026-11-02.json');
    const saved = JSON.parse(
      fs.files.get('DOCUMENTS/ASCEND/ascend-weekly-2026-11-02.json') ?? '{}',
    );
    expect(saved.format).toBe('ascend-backup');
    expect((await db.meta.get('local_backup_path'))?.value).toBe(
      'Documents/ASCEND/ascend-weekly-2026-11-02.json',
    );

    setNow(ist(2026, 11, 5, 10)); // 3 days later: not yet
    expect(await runWeeklyLocalBackup(db)).toBeNull();

    for (let week = 1; week <= 5; week++) {
      setNow(ist(2026, 11, 2 + week * 7, 10));
      await runWeeklyLocalBackup(db);
    }
    const kept = [...fs.files.keys()].filter((k) => k.includes('ascend-weekly-')).sort();
    expect(kept).toHaveLength(KEEP_WEEKLY);
    expect(kept.at(-1)).toContain('2026-12-07');
    expect(kept[0]).toContain('2026-11-16');
  });

  it('falls back to the app’s own folder if Documents is refused', async () => {
    fs.refuseDocuments = true;
    expect(await writeLocalBackup('ascend-weekly', db)).toBe(
      'Android/data/app.ascend.rishi/files/ASCEND/ascend-weekly-2026-11-02.json',
    );
  });

  it('nothing on the web or before onboarding', async () => {
    native.on = false;
    expect(await runWeeklyLocalBackup(db)).toBeNull();
    native.on = true;
    await db.profile.put({
      ...newBase('profile'),
      name: '',
      start_day: null,
      onboarded_at: null,
      display_title: null,
    });
    expect(await runWeeklyLocalBackup(db)).toBeNull();
    expect(fs.files.size).toBe(0);
  });
});
