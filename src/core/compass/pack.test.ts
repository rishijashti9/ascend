import { ONET_ATTRIBUTION } from '@/data/compass';
import { pack, packProblems } from './pack';

describe('Growth Compass knowledge pack (SPEC 6.7 B)', () => {
  it('validates against the schema and has no integrity problems', () => {
    expect(() => pack()).not.toThrow();
    expect(packProblems()).toEqual([]);
  });

  it('every source is an https link; O*NET is credited under CC BY 4.0', () => {
    for (const s of pack().sources) expect(s.url.startsWith('https://')).toBe(true);
    expect(pack().sources.find((s) => s.id === 'onet')?.license).toBe('CC BY 4.0');
    expect(ONET_ATTRIBUTION).toMatch(/CC BY 4\.0/);
  });

  it('finds prerequisite cycles and unknown references', () => {
    const p = pack();
    const broken = {
      ...p,
      skills: [
        { id: 'a', name: 'A', prereqs: ['b'], hours: 10, matches: [], learn: [], sources: [] },
        {
          id: 'b',
          name: 'B',
          prereqs: ['a'],
          hours: 10,
          matches: [],
          learn: [],
          sources: ['nope'],
        },
      ],
    };
    const problems = packProblems(broken);
    expect(problems.some((x) => x.startsWith('prerequisite cycle'))).toBe(true);
    expect(problems).toContain('skill b: unknown source nope');
  });
});

describe('roadmaps (SPEC 6.7 B)', () => {
  it('has the required roadmaps and guides', () => {
    const ids = pack().roadmaps.map((r) => r.id);
    for (const id of [
      'ai-ml',
      'ros2',
      'cpp',
      'robotics-math',
      'robot-simulation',
      'unreal-engine',
      'ielts',
      'gre',
      'germany-masters',
      'spaced-repetition',
      'deep-work',
      'restart-after-break',
    ])
      expect(ids).toContain(id);
  });

  it('changeable facts point to the official site', () => {
    const germany = pack().roadmaps.find((r) => r.id === 'germany-masters');
    const aps = germany?.steps.find((s) => s.title.startsWith('APS'));
    expect(aps?.checkOfficial).toBe('https://www.aps-india.de/');
    for (const step of germany?.steps ?? [])
      if (/deadline|fee|amount|processing|waiting/i.test(step.detail))
        expect(step.checkOfficial, step.title).toBeDefined();
  });
});
