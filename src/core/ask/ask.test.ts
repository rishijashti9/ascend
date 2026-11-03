import { askTheSystem, compassHints, type AskDeps } from './ask';
import { ALLOWED_KEYS, buildAskContext, type ContextSources } from './context';
import type { AIProvider, AskRequest } from './provider';

const answerProvider = (seen: AskRequest[] = []): AIProvider => ({
  name: 'test',
  ask: async (r) => {
    seen.push(r);
    return {
      ok: true,
      answer: {
        text: 'Do the ROS 2 tutorials.',
        quests: ['ROS 2 tutorials'],
        sources: [],
        cached: false,
        model: 'm',
      },
    };
  },
});
const failing = (reason: 'quota' | 'offline' | 'no_key' | 'error' | 'off_topic'): AIProvider => ({
  name: 'test',
  ask: async () => ({ ok: false, reason }),
});
const deps = (over: Partial<AskDeps> = {}): AskDeps => ({
  enabled: true,
  provider: answerProvider(),
  context: { level: 12 },
  country: 'IN',
  usedToday: 0,
  dailyLimit: 10,
  logOutbound: async () => undefined,
  ...over,
});

describe('Ask the System (SPEC 6.7 C)', () => {
  it('answers career and health questions through the provider, logging what was sent', async () => {
    const log: number[] = [];
    const r = await askTheSystem(
      'How should I start learning ROS 2?',
      deps({ logOutbound: async (n) => void log.push(n) }),
    );
    expect(r).toMatchObject({ kind: 'answer', answer: { quests: ['ROS 2 tutorials'] } });
    expect(log).toHaveLength(1);
  });

  it('declines off-topic questions locally — nothing is sent', async () => {
    const seen: AskRequest[] = [];
    const log: number[] = [];
    const r = await askTheSystem(
      'Who won the cricket match?',
      deps({ provider: answerProvider(seen), logOutbound: async (n) => void log.push(n) }),
    );
    expect(r.kind).toBe('declined');
    expect(seen).toHaveLength(0);
    expect(log).toHaveLength(0);
  });

  it('crisis and medical questions get the safe local reply, never the AI', async () => {
    const seen: AskRequest[] = [];
    expect(
      (await askTheSystem('I want to end my life', deps({ provider: answerProvider(seen) }))).kind,
    ).toBe('safety');
    expect(
      (
        await askTheSystem(
          'Which medicine helps me sleep?',
          deps({ provider: answerProvider(seen) }),
        )
      ).kind,
    ).toBe('safety');
    expect(seen).toHaveLength(0);
  });

  it.each(['quota', 'offline', 'no_key', 'error'] as const)(
    'falls back calmly to the Compass on %s',
    async (reason) => {
      const r = await askTheSystem(
        'How do I prepare for IELTS?',
        deps({ provider: failing(reason) }),
      );
      expect(r).toMatchObject({ kind: 'fallback', reason });
      if (r.kind === 'fallback') {
        expect(r.text.length).toBeGreaterThan(10);
        expect(r.compass.map((c) => c.title)).toContain('IELTS Academic');
      }
    },
  );

  it('switched off, signed out or over today’s limit → Compass, nothing sent', async () => {
    const seen: AskRequest[] = [];
    const p = answerProvider(seen);
    expect(
      await askTheSystem('How do I learn C++?', deps({ provider: p, enabled: false })),
    ).toMatchObject({ reason: 'off' });
    expect(await askTheSystem('How do I learn C++?', deps({ provider: null }))).toMatchObject({
      reason: 'signed_out',
    });
    expect(
      await askTheSystem('How do I learn C++?', deps({ provider: p, usedToday: 10 })),
    ).toMatchObject({ reason: 'limit' });
    expect(seen).toHaveLength(0);
  });

  it('a model answering off-topic is shown as declined', async () => {
    expect(
      (await askTheSystem('Tips for my career?', deps({ provider: failing('off_topic') }))).kind,
    ).toBe('declined');
  });

  it('compass hints match the question', () => {
    expect(compassHints('how much sleep do adults need')[0]?.title).toBe('Sleep duration');
  });
});

describe('what may be sent', () => {
  const sources: ContextSources = {
    level: 12,
    rank: 'C',
    streak: 9,
    completion: 0.81,
    mainQuests: [
      { id: 'q', title: 'Core robotics skills', status: 'active', target_date: '2027-06-01' },
    ],
    milestones: [
      { main_quest_id: 'q', title: 'ROS 2 basics', status: 'active', target_date: null },
    ],
    mainQuestProgress: { q: 0.25 },
    skills: [{ id: 's', name: 'ROS 2', status: 'active' }],
    skillLevel: () => 2,
    targetCareer: 'Robotics engineer',
  };

  it('only allow-listed progress numbers — never health, journal, mood, energy or photos', () => {
    const ctx = buildAskContext(sources);
    for (const k of Object.keys(ctx)) expect(ALLOWED_KEYS).toContain(k);
    const text = JSON.stringify(ctx).toLowerCase();
    for (const banned of [
      'sleep',
      'weight',
      'waist',
      'steps',
      'mood',
      'energy',
      'journal',
      'photo',
      'win',
      'lesson',
    ])
      expect(text).not.toContain(banned);
    expect(ctx).toMatchObject({
      level: 12,
      daily_completion_pct: 81,
      skill_levels: { 'ROS 2': 2 },
    });
  });
});
