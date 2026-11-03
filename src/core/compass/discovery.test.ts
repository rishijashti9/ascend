import { INTEREST_ITEMS } from '@/data/compass/discovery';
import { interestProfile, matchCareers, topTypes, type DiscoveryAnswers } from './discovery';

/** Says "yes please" to the given types, "not for me" to the rest. */
const answers = (
  likes: string,
  strengths: string[] = [],
  values: string[] = [],
): DiscoveryAnswers => ({
  interests: Object.fromEntries(INTEREST_ITEMS.map((i) => [i.id, likes.includes(i.type) ? 2 : 0])),
  strengths,
  values,
});

describe('career discovery (SPEC 6.7 B)', () => {
  it('builds a Holland interest profile', () => {
    const p = interestProfile(answers('IR'));
    expect(topTypes(p, 2)).toEqual(['R', 'I']);
    expect(p.S).toBe(0);
  });

  it('a hands-on problem-solver who codes gets engineering and robotics careers, with reasons', () => {
    const m = matchCareers(answers('RI', ['maths', 'coding'], ['creating', 'discovery']));
    const ids = m.map((x) => x.career.id);
    expect(ids).toContain('robotics-engineer');
    expect(m[0]?.career.field).toMatch(/engineering|tech|trades|science/);
    expect(m.find((x) => x.career.id === 'robotics-engineer')?.why).toMatch(
      /Fits your interest in .*; uses your strengths in (maths and coding|coding and maths); matches what you value/,
    );
  });

  it('works for anyone: a people-person who values helping gets health and education', () => {
    const m = matchCareers(answers('S', ['caring', 'explaining'], ['helping']), 5);
    for (const x of m) expect(['health', 'education', 'public']).toContain(x.career.field);
  });

  it('a creative profile ranks creative careers first', () => {
    const m = matchCareers(answers('A', ['design'], ['creating']), 3);
    expect(m.every((x) => /A/.test(x.career.riasec[0] ?? ''))).toBe(true);
  });
});
