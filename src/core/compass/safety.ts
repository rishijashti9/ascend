import { addDays, diffDays, type DayString } from '@/core/time';
import type { Helpline } from '@/data/compass/schema';
import { pack } from './pack';
import type { ScopeResult } from './scope';

/**
 * Health safety (SPEC 6.7 B — non-negotiable), pure:
 * - no diagnosis, medication or treatment advice: pain, injury or illness → see a doctor;
 * - no extreme diets or training, never less sleep;
 * - safe weight change only (≤ 1 % of body weight and ≤ 1 kg a week), warn when it drops faster;
 * - mood check-ins very low for a sustained time → gently suggest talking to someone and show
 *   the helpline for the user's country.
 * Health data stays on the device / own account — these rules run locally.
 */

/** Helpline for a country code (IN, DE …), or null. */
export function helplineFor(country: string | null): Helpline | null {
  return pack().helplines.find((h) => h.country === country) ?? null;
}

/** The user's country from the device timezone (good enough for which helpline to show). */
export function countryFromTimeZone(tz: string): string | null {
  if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') return 'IN';
  if (tz === 'Europe/Berlin') return 'DE';
  return null;
}

export function helplineText(h: Helpline | null): string {
  if (!h)
    return 'If you’re in danger or thinking of harming yourself, contact your local emergency number now.';
  return `${h.name}: ${h.phones.join(' or ')} (${h.hours}). Numbers can change — the official site: ${h.url}`;
}

export interface SafetyReply {
  kind: 'crisis' | 'medical' | 'extreme';
  text: string;
  helpline: Helpline | null;
}

/** A fixed, safe reply when a question needs one — before any advice is given. */
export function safetyReply(scope: ScopeResult, country: string | null): SafetyReply | null {
  if (scope.crisis) {
    const h = helplineFor(country);
    return {
      kind: 'crisis',
      helpline: h,
      text: `I’m really glad you said something. You don’t have to handle this alone — please talk to someone right now. ${helplineText(h)} If you’re in immediate danger, call your local emergency number.`,
    };
  }
  if (scope.medical) {
    return {
      kind: 'medical',
      helpline: null,
      text: 'That sounds like something a doctor should look at — I can’t diagnose, suggest medicines or treatment. Please see a doctor, and stop any activity that causes pain until you have. I can help with general sleep, activity and food habits once you’re cleared.',
    };
  }
  if (scope.extreme) {
    return {
      kind: 'extreme',
      helpline: null,
      text: 'I won’t help with that — crash diets, drugs, extreme training or cutting sleep do more harm than good. Safe change is slow: about 0.5–1 kg a week at most, 7+ hours of sleep, and training that increases gradually. I can help plan that instead.',
    };
  }
  return null;
}

// ---- Weight change ----

/** Fastest safe loss per week: 1 % of body weight, and never more than 1 kg. */
export function maxSafeLossPerWeek(weightKg: number): number {
  return Math.min(1, weightKg * 0.01);
}

/** Earliest safe day to reach a lower target weight (a later chosen date is always fine). */
export function earliestSafeDate(currentKg: number, targetKg: number, today: DayString): DayString {
  if (targetKg >= currentKg) return today;
  const weeks = Math.ceil((currentKg - targetKg) / maxSafeLossPerWeek(currentKg));
  return addDays(today, weeks * 7);
}

/**
 * Weight falling faster than is safe: average of the last 14 days vs the 14 before, as kg per
 * week (needs 3+ weigh-ins in each half). Returns a gentle warning or null.
 */
export function weightDropWarning(
  weights: readonly { day: DayString; value: number }[],
  today: DayString,
): string | null {
  const recent = weights.filter((w) => diffDays(w.day, today) >= 0 && diffDays(w.day, today) < 14);
  const before = weights.filter((w) => diffDays(w.day, today) >= 14 && diffDays(w.day, today) < 28);
  if (recent.length < 3 || before.length < 3) return null;
  const avg = (xs: readonly { value: number }[]) => xs.reduce((s, x) => s + x.value, 0) / xs.length;
  const perWeek = (avg(before) - avg(recent)) / 2;
  if (perWeek <= maxSafeLossPerWeek(avg(recent)) + 0.05) return null;
  return `Your weight has been falling about ${perWeek.toFixed(1)} kg a week — faster than is safe (up to ${maxSafeLossPerWeek(avg(recent)).toFixed(1)} kg). Please eat enough and ease off; if you’re not trying to lose weight or feel unwell, see a doctor.`;
}

// ---- Mood ----

/** Sustained very low mood: 7+ check-ins in the last 14 days averaging 2 or less (of 5). */
export function lowMoodSupport(
  mood: readonly { day: DayString; value: number }[],
  today: DayString,
  country: string | null,
): { text: string; helpline: Helpline | null } | null {
  const recent = mood.filter((m) => diffDays(m.day, today) >= 0 && diffDays(m.day, today) < 14);
  if (recent.length < 7) return null;
  const avg = recent.reduce((s, m) => s + m.value, 0) / recent.length;
  if (avg > 2) return null;
  const h = helplineFor(country);
  return {
    helpline: h,
    text: `Your mood has been low for a couple of weeks now. That’s hard, and it’s worth not carrying alone — talking to someone you trust, or to a professional, really can help. ${helplineText(h)}`,
  };
}

/** Plan rule: a sleep target may go up, never down (SPEC 6.7: never suggest less sleep). */
export function sleepChangeAllowed(fromHours: number, toHours: number): boolean {
  return toHours >= fromHours;
}
