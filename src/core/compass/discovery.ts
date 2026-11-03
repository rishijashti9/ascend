import { INTEREST_ITEMS, RIASEC_NAMES, STRENGTHS, VALUES } from '@/data/compass/discovery';
import { RIASEC, type Career, type Riasec } from '@/data/compass/schema';
import { pack } from './pack';

/**
 * Guided career discovery (SPEC 6.7 B), pure: interests (Holland / RIASEC), strengths and
 * values → careers ranked by fit, each with a plain explanation. Works for any user.
 */
export interface DiscoveryAnswers {
  /** Interest item id → 0 (not for me), 1 (maybe), 2 (yes please). */
  interests: Record<string, 0 | 1 | 2>;
  strengths: string[];
  values: string[];
}

export interface CareerMatch {
  career: Career;
  /** 0–100. */
  score: number;
  why: string;
}

/** Interest profile: each type's share of the points given (0–1). */
export function interestProfile(a: DiscoveryAnswers): Record<Riasec, number> {
  const raw = Object.fromEntries(RIASEC.map((t) => [t, 0])) as Record<Riasec, number>;
  for (const item of INTEREST_ITEMS) raw[item.type] += a.interests[item.id] ?? 0;
  for (const s of STRENGTHS) if (a.strengths.includes(s.id)) raw[s.type] += 1;
  const total = Object.values(raw).reduce((x, y) => x + y, 0);
  return Object.fromEntries(RIASEC.map((t) => [t, total > 0 ? raw[t] / total : 0])) as Record<
    Riasec,
    number
  >;
}

/** The user's top types, strongest first (ties broken by RIASEC order). */
export function topTypes(profile: Record<Riasec, number>, n = 3): Riasec[] {
  return [...RIASEC]
    .sort((a, b) => profile[b] - profile[a])
    .slice(0, n)
    .filter((t) => profile[t] > 0);
}

/** How well a career's Holland code fits the profile (0–1): its first letter counts most. */
function interestFit(code: string, profile: Record<Riasec, number>): number {
  const weights = [3, 2, 1];
  let fit = 0;
  let max = 0;
  const best = Math.max(...Object.values(profile), 0.0001);
  [...code].forEach((t, i) => {
    const w = weights[i] ?? 0;
    fit += w * (profile[t as Riasec] / best);
    max += w;
  });
  return max > 0 ? fit / max : 0;
}

const listText = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;

export function matchCareers(a: DiscoveryAnswers, limit = 8): CareerMatch[] {
  const profile = interestProfile(a);
  const top = topTypes(profile);
  const strengthSkills = new Map<string, string>();
  for (const s of STRENGTHS)
    if (a.strengths.includes(s.id)) for (const k of s.skills) strengthSkills.set(k, s.label);
  const valued = VALUES.filter((v) => a.values.includes(v.id));

  return pack()
    .careers.map((career) => {
      const interest = interestFit(career.riasec, profile);
      const weight = career.skills.reduce((x, s) => x + s.importance, 0);
      const usedStrengths = new Set<string>();
      let strengthHit = 0;
      for (const s of career.skills) {
        const label = strengthSkills.get(s.id);
        if (label) {
          strengthHit += s.importance;
          usedStrengths.add(label);
        }
      }
      const strength = weight > 0 ? Math.min(1, (strengthHit / weight) * 2) : 0;
      const values = valued.filter((v) => v.fields.includes(career.field));
      const valueFit = valued.length > 0 ? values.length / valued.length : 0;
      const score = Math.round(100 * (0.6 * interest + 0.25 * strength + 0.15 * valueFit));

      const shared = [...career.riasec].filter((t) => top.includes(t as Riasec)) as Riasec[];
      const parts: string[] = [];
      if (shared.length)
        parts.push(`fits your interest in ${listText(shared.map((t) => RIASEC_NAMES[t].short))}`);
      if (usedStrengths.size)
        parts.push(
          `uses your strengths in ${listText([...usedStrengths].map((l) => l.toLowerCase()))}`,
        );
      if (values.length)
        parts.push(`matches what you value: ${listText(values.map((v) => v.label.toLowerCase()))}`);
      const why = parts.length
        ? `${parts.join('; ').replace(/^./, (c) => c.toUpperCase())}.`
        : 'A partial match worth a look.';
      return { career, score, why };
    })
    .sort((x, y) => y.score - x.score || x.career.title.localeCompare(y.career.title))
    .slice(0, limit);
}

/** Enough answered to say something useful? (at least half the interest items) */
export function discoveryReady(a: DiscoveryAnswers): boolean {
  return Object.keys(a.interests).length >= INTEREST_ITEMS.length / 2;
}
