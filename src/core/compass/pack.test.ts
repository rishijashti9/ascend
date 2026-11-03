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
