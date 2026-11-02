import { initialDraft, stepProblem, toPayload } from './draft';

const timing = { wake_window_min: 20, wake_late_cutoff: '07:00' };

describe('onboarding draft', () => {
  it('is pre-filled so every step can just be confirmed', () => {
    const d = initialDraft();
    for (let step = 0; step < 5; step++) expect(stepProblem(d, step)).toBeNull();
    const p = toPayload(d, timing);
    expect(p.habits).toHaveLength(8);
    expect(p.habits.filter((h) => h.core)).toHaveLength(3);
    expect(p.main_quests).toHaveLength(4);
  });

  it('the wake-up wording follows the chosen wake time', () => {
    const p = toPayload({ ...initialDraft(), wakeTime: '06:30' }, timing);
    expect(p.habits[0]).toMatchObject({
      auto_source: 'wake_checkin',
      full_version: '"I\'m up" by 6:50 AM',
      min_version: 'Late check-in (by 7:00 AM)',
    });
  });

  it('blocks steps with missing or invalid answers', () => {
    const d = initialDraft();
    expect(stepProblem({ ...d, name: ' ' }, 0)).toBe('Enter your name');
    const none = { ...d, habits: d.habits.map((h) => ({ ...h, selected: false })) };
    expect(stepProblem(none, 2)).toBe('Pick at least one daily quest');
    const broken = {
      ...d,
      habits: d.habits.map((h) => (h.key === 'walk' ? { ...h, min_value: 9000 } : h)),
    };
    expect(stepProblem(broken, 2)).toBe('Fix "Walk" first');
    expect(stepProblem({ ...d, dream: { title: '', why: '' } }, 3)).toBe('Give your Dream a title');
  });

  it('no dream title → no dream and no main quests are saved', () => {
    const p = toPayload(
      { ...initialDraft(), dream: { title: ' ', why: '' }, mainQuests: [] },
      timing,
    );
    expect(p).toMatchObject({ dream: null, main_quests: [] });
  });
});
