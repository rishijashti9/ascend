import { STARTER_TEMPLATES } from '@/data/starterTemplates';
import { applyTemplate, coreCount, initialDraft, stepProblem, toPayload } from './draft';

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

describe('starter templates by goal type (SPEC 6.7)', () => {
  it('every template is valid onboarding input: quests pass the editor, ≤ 3 core, a dream', () => {
    for (const t of STARTER_TEMPLATES) {
      const d = applyTemplate(initialDraft(), t.id);
      expect(d.template).toBe(t.id);
      expect(stepProblem(d, 2), t.id).toBeNull();
      expect(coreCount(d), t.id).toBeLessThanOrEqual(3);
      expect(coreCount(d), t.id).toBeGreaterThan(0);
      expect(d.dream.title.length, t.id).toBeGreaterThan(5);
      expect(new Set(d.habits.map((h) => h.key)).size, t.id).toBe(d.habits.length);
    }
  });

  it('the default is Rishi’s own set; the wake-up wording follows the chosen wake time', () => {
    expect(initialDraft().template).toBe('ai-robotics');
    const d = applyTemplate({ ...initialDraft(), wakeTime: '06:30' }, 'fitness');
    expect(d.habits.find((h) => h.key === 'wake')?.full_version).toMatch(/6:50 AM/);
    expect(d.mainQuests.map((m) => m.title)).toContain('A steady training habit');
  });

  it('covers fitness, study/exams, career/skills and discipline', () => {
    expect(STARTER_TEMPLATES.map((t) => t.id)).toEqual(
      expect.arrayContaining(['fitness', 'study', 'career', 'discipline', 'ai-robotics']),
    );
  });
});
