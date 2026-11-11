import type { Habit, MainQuest, Milestone } from '@/core/db/types';
import { STARTER_HABITS, STARTER_MAIN_QUESTS } from '@/data/starter';
import { meaningfulWords, suggestLinks } from './links';

/** Linking plan L2: suggestions on Rishi's real starter titles, and the edge cases. */
const habit = (title: string, over: Partial<Habit> = {}) =>
  ({
    id: title,
    title,
    stat: 'INT',
    status: 'active',
    deleted_at: null,
    linked_goal_type: null,
    linked_goal_id: null,
    ...over,
  }) as Habit;
const mq = (title: string, over: Partial<MainQuest> = {}) =>
  ({ id: title, title, stat: 'INT', status: 'active', deleted_at: null, ...over }) as MainQuest;

const starters = STARTER_HABITS.filter((h) => h.selected).map((h) =>
  habit(h.title, { stat: h.stat }),
);
const mains = STARTER_MAIN_QUESTS.map((q) => mq(q.title, { stat: q.stat }));
const byTitle = (s: ReturnType<typeof suggestLinks>, t: string) =>
  s.find((x) => x.title.startsWith(t));

describe('suggestLinks on the real starter quests and main quests', () => {
  const s = suggestLinks(starters, mains, []);

  it('AI & Robotics study: the main quest sharing the most words, with the near-ties offered', () => {
    const ai = byTitle(s, 'AI & Robotics study');
    // "ai" + "robotics" are both in "MS in AI/Robotics in Germany" (2 words); the others share 1.
    expect(ai?.mainQuestId).toBe('MS in AI/Robotics in Germany');
    expect(ai?.why).toBe('shares “ai” and “robotics”');
    expect(ai?.alsoFits).toEqual(['Core robotics skills', 'Robotics portfolio']);
  });

  it('Game dev study → Game dev foundations', () => {
    const g = byTitle(s, 'Game dev study');
    expect(g?.mainQuestId).toBe('Game dev foundations');
    expect(g?.why).toBe('shares “game” and “dev”');
    expect(g?.alsoFits).toEqual([]);
  });

  it('body and mind quests get no link — nothing is invented', () => {
    for (const t of ['Wake up on time', 'Workout', 'Walk', 'Sleep', 'Journal', 'Meditate']) {
      const x = byTitle(s, t);
      expect(x, t).toBeDefined();
      expect(x?.mainQuestId, t).toBeNull();
      expect(x?.why, t).toBeNull();
    }
  });
});

describe('suggestLinks edge cases', () => {
  it('already linked, paused, archived or deleted daily quests are left out', () => {
    const s = suggestLinks(
      [
        habit('Robotics reading', { linked_goal_type: 'main_quest', linked_goal_id: 'x' }),
        habit('Robotics paused', { status: 'paused' }),
        habit('Robotics archived', { status: 'archived' }),
        habit('Robotics deleted', { deleted_at: '2026-01-01' }),
      ],
      [mq('Core robotics skills')],
      [],
    );
    expect(s).toEqual([]);
  });

  it('only active main quests are suggested', () => {
    const s = suggestLinks(
      [habit('Robotics practice')],
      [
        mq('Robotics paused', { status: 'paused' }),
        mq('Robotics archived', { status: 'archived' }),
      ],
      [],
    );
    expect(s[0]?.mainQuestId).toBeNull();
  });

  it("a main quest's milestones count too", () => {
    const s = suggestLinks(
      [habit('IELTS practice')],
      [mq('MS in Germany')],
      [
        {
          id: 'm',
          main_quest_id: 'MS in Germany',
          title: 'IELTS band 7',
          status: 'active',
          deleted_at: null,
        } as Milestone,
      ],
    );
    expect(s[0]?.mainQuestId).toBe('MS in Germany');
    expect(s[0]?.why).toBe('shares “ielts”');
  });

  it('ties: same stat first, then title — never storage order', () => {
    const a = suggestLinks(
      [habit('Robotics', { stat: 'STR' })],
      [mq('B robotics', { stat: 'INT' }), mq('A robotics', { stat: 'STR' })],
      [],
    );
    expect(a[0]?.mainQuestId).toBe('A robotics');
    const b = suggestLinks([habit('Robotics')], [mq('Robotics two'), mq('Robotics one')], []);
    const c = suggestLinks([habit('Robotics')], [mq('Robotics one'), mq('Robotics two')], []);
    expect(b[0]?.mainQuestId).toBe('Robotics one');
    expect(c[0]?.mainQuestId).toBe(b[0]?.mainQuestId);
  });

  it('no main quests → no suggestions, but the quest is still listed', () => {
    expect(suggestLinks([habit('Robotics')], [], [])[0]?.mainQuestId).toBeNull();
  });

  it('filler words never match', () => {
    expect([...meaningfulWords('Study (phone-free) for 30 minutes every day')]).toEqual(['30']);
  });
});
