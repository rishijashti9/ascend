import { DEFAULT_SETTINGS } from '@/config/defaults';
import { ist } from '@/test/testDb';
import { pastDays, testInput, testInstance } from '@/test/adaptiveInput';
import { reminderSuggestion } from './timing';

const TODAY = '2026-11-02';
const at = (day: string, h: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(ist(y ?? 0, m ?? 0, d ?? 0, h)).toISOString();
};
const core = (h: number, wake = false) =>
  pastDays(TODAY, 20).map((d) =>
    testInstance(wake ? 'wake' : 'study', d, 'done_full', {
      core: true,
      wake,
      completedAt: at(d, h),
    }),
  );

describe('learned reminder time', () => {
  it('core quests finished around 20:00 → move the 18:00 reminder to 19:30', () => {
    const s = reminderSuggestion(testInput({ instances: core(20) }), DEFAULT_SETTINGS);
    expect(s).toMatchObject({ from: '18:00', to: '19:30' });
    expect(s?.why).toBe('You usually finish your core quests between 20:00 and 22:00.');
  });

  it('finishing earlier, or close to the reminder, suggests nothing', () => {
    expect(reminderSuggestion(testInput({ instances: core(10) }), DEFAULT_SETTINGS)).toBeNull();
    expect(reminderSuggestion(testInput({ instances: core(18) }), DEFAULT_SETTINGS)).toBeNull();
  });

  it('never suggests a time inside quiet hours, and ignores wake-up check-in times', () => {
    expect(
      reminderSuggestion(testInput({ instances: core(23) }), DEFAULT_SETTINGS), // 22:30 is quiet
    ).toBeNull();
    expect(
      reminderSuggestion(testInput({ instances: core(5, true) }), DEFAULT_SETTINGS),
    ).toBeNull();
  });

  it('nothing when the reminder is switched off', () => {
    const off = {
      ...DEFAULT_SETTINGS,
      notifications: { ...DEFAULT_SETTINGS.notifications, quest_reminders: false },
    };
    expect(reminderSuggestion(testInput({ instances: core(20) }), off)).toBeNull();
  });
});
