import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mergeSeen, newMoment, type Seen } from '@/core/engine/moments';
import { clearSubscribers, subscribe, type DomainEvent } from '@/core/pipeline';
import { SEEN_KEY } from '@/core/pipeline/actions/moments';
import { momentsStore } from '@/core/state/moments';
import { createTestDb } from '@/test/testDb';
import { LevelUpMoment } from './LevelUpMoment';

const seen = (level: number, rank: Seen['rank'], STR = 1, INT = 1, WIL = 1): Seen => ({
  level,
  rank,
  stats: { STR, INT, WIL },
});

describe('newMoment / mergeSeen', () => {
  it('reports only what went above everything already seen', () => {
    expect(newMoment(seen(3, 'E'), seen(3, 'E'))).toBeNull();
    expect(newMoment(seen(3, 'E'), seen(4, 'E', 1, 2, 1))).toEqual({
      level: 4,
      rank: null,
      stats: [{ stat: 'INT', level: 2 }],
    });
    expect(newMoment(seen(4, 'E'), seen(5, 'D'))).toMatchObject({ level: 5, rank: 'D' });
    expect(newMoment(seen(5, 'D'), seen(4, 'D'))).toBeNull(); // lower never counts
    expect(mergeSeen(seen(5, 'D', 3), seen(4, 'E', 2, 4))).toEqual(seen(5, 'D', 3, 4));
  });
});

describe('moments.record', () => {
  let t: Awaited<ReturnType<typeof createTestDb>>;
  const events: DomainEvent[] = [];
  beforeEach(async () => {
    t = await createTestDb();
    events.length = 0;
    subscribe('LevelUp', (p) => void events.push({ type: 'LevelUp', payload: p }));
    subscribe('RankUp', (p) => void events.push({ type: 'RankUp', payload: p }));
  });
  afterEach(async () => {
    clearSubscribers();
    await t.cleanup();
  });
  const record = async (s: Seen, silent = false) =>
    (await t.run({ type: 'moments.record', payload: { ...s, silent } })).value;

  it('the first record only remembers; later rises are moments, once', async () => {
    expect(await record(seen(7, 'D', 3, 4, 2))).toBeNull(); // existing player: no replay
    expect((await t.db.meta.get(SEEN_KEY))?.value).toEqual(seen(7, 'D', 3, 4, 2));

    expect(await record(seen(8, 'D', 3, 5, 2))).toEqual({
      level: 8,
      rank: null,
      stats: [{ stat: 'INT', level: 5 }],
    });
    expect(events).toEqual([
      { type: 'LevelUp', payload: { level: 8, stat: null } },
      { type: 'LevelUp', payload: { level: 5, stat: 'INT' } },
    ]);
    expect(await record(seen(8, 'D', 3, 5, 2))).toBeNull(); // reload: nothing new
    expect(await record(seen(7, 'D', 3, 4, 2))).toBeNull(); // an Undo lowered it
    expect(await record(seen(8, 'D', 3, 5, 2))).toBeNull(); // earned again: not twice
  });

  it('a silent record (after an import) remembers without a moment', async () => {
    await record(seen(2, 'E'));
    expect(await record(seen(20, 'C', 9, 9, 9), true)).toBeNull();
    expect(events).toEqual([]);
    expect(await record(seen(20, 'C', 9, 9, 9))).toBeNull();
  });
});

describe('LevelUpMoment', () => {
  afterEach(() => momentsStore.setState({ queue: [] }));

  it('shows a rank-up with the level and stats, and is skippable with Continue or Esc', async () => {
    render(<LevelUpMoment />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() =>
      momentsStore.setState({
        queue: [
          { level: 5, rank: 'D', stats: [{ stat: 'WIL', level: 3 }] },
          { level: 6, rank: null, stats: [] },
        ],
      }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Rank D' });
    expect(dialog).toHaveTextContent('Rank up');
    expect(dialog).toHaveTextContent('Level 5');
    expect(dialog).toHaveTextContent('Willpower reached level 3');
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('dialog', { name: 'Level 6' })).toHaveTextContent('Level up');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
