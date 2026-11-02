import { systemMessage, type MessageInput } from './messages';

const base: MessageInput = {
  dayN: 12,
  hour: 10,
  streak: 5,
  streakAtStart: 5,
  coreTotal: 3,
  coreDone: 0,
  dailyTotal: 8,
  dailyDone: 0,
  dailyClear: false,
  lowEnergy: false,
  welcome: null,
  recovery: null,
};
const msg = (over: Partial<MessageInput>) => systemMessage({ ...base, ...over });

describe('systemMessage', () => {
  it('default: day number, quests left and streak', () => {
    expect(msg({})).toBe('Day 12. 8 quests waiting. Streak: 5 days.');
    expect(msg({ streak: 0, dailyDone: 7 })).toBe('Day 12. 1 quest waiting.');
  });

  it('before the first day', () => {
    expect(msg({ dayN: null })).toMatch(/first day begins tomorrow/);
  });

  it('welcome back comes first, mentioning shields when they were used', () => {
    expect(msg({ welcome: { daysAway: 4, shieldsUsed: 0 } })).toBe(
      'Welcome back after 4 days. No XP was lost. Start with one small quest.',
    );
    expect(msg({ welcome: { daysAway: 3, shieldsUsed: 1 } })).toMatch(/1 shield covered/);
  });

  it('Recovery quest: repair offer, fresh start, then restored', () => {
    expect(msg({ recovery: { done: false, restores: 9 } })).toMatch(/restore your 9-day streak/);
    expect(msg({ recovery: { done: false, restores: null } })).toMatch(/A fresh start/);
    expect(msg({ recovery: { done: true, restores: 9 }, streakAtStart: 9 })).toBe(
      'Streak restored at 9 days. Back on the path.',
    );
  });

  it('Daily Clear, then core done', () => {
    expect(msg({ dailyClear: true })).toBe('Daily Clear. Every quest done — Day 12 is complete.');
    expect(msg({ coreDone: 3, dailyDone: 5 })).toBe(
      'Core quests done — today counts. 3 quests left for Daily Clear.',
    );
    expect(msg({ coreDone: 3, lowEnergy: true, dailyClear: true })).toMatch(
      /^Minimums met — Daily Clear on a low-energy day/,
    );
  });

  it('Day 1, low energy, streak milestones and evening reminder', () => {
    expect(msg({ dayN: 1, coreTotal: 0 })).toMatch(/^Day 1\. The System is awake/);
    expect(msg({ lowEnergy: true })).toMatch(/^Low-energy day/);
    expect(msg({ streakAtStart: 14 })).toBe('Day 12. 14-day streak. Keep it alive.');
    expect(msg({ hour: 20, coreDone: 1 })).toBe('Evening. 2 core quests left to keep the streak.');
  });
});
