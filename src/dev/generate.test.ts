import Dexie from 'dexie';
import { AscendDB } from '@/core/db/db';
import { loadProgress } from '@/core/state/progress';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import { generateHistory } from './generate';

let database: AscendDB;

beforeEach(async () => {
  database = new AscendDB(`gen-${crypto.randomUUID()}`);
  await database.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 12));
});
afterEach(async () => {
  resetClock();
  database.close();
  await Dexie.delete(database.name);
});

describe('generateHistory', () => {
  it('lives N days of realistic history through the real actions, ending today', async () => {
    const progress: number[] = [];
    await generateHistory({ days: 40, seed: 3, database, onProgress: (d) => progress.push(d) });

    expect((await database.profile.get('profile'))?.start_day).toBe('2026-09-23');
    const days = await database.days.toArray();
    expect(days.at(-1)?.day).toBe('2026-11-02');
    expect(days.filter((d) => d.closed_at === null).map((d) => d.day)).toEqual(['2026-11-02']);
    expect(days.filter((d) => d.active).length).toBeGreaterThan(10);
    expect(await database.xp_events.count()).toBeGreaterThan(100);
    // Today is left for the person to play.
    expect(await database.xp_events.where('day').equals('2026-11-02').count()).toBe(0);
    expect(progress.at(-1)).toBe(40);

    const p = await loadProgress(database);
    expect(p.level.level).toBeGreaterThan(3);
    expect(p.streak.daysActive).toBe(days.filter((d) => d.active).length);
  }, 60_000);

  it('the same seed gives the same history', async () => {
    await generateHistory({ days: 15, seed: 7, database });
    const a = (await loadProgress(database)).level.totalXp;
    setNow(ist(2026, 11, 2, 12));
    await generateHistory({ days: 15, seed: 7, database });
    expect((await loadProgress(database)).level.totalXp).toBe(a);
  }, 60_000);
});
