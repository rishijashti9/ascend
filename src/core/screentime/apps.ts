import type { ScreenDay, ScreenRuleValues } from '@/core/db/types';
import { ENTERTAINMENT_APPS, YOUTUBE_PACKAGES } from '@/data/entertainmentApps';

/**
 * Which apps count as entertainment (SPEC 6.8): the built-in list (by package or app name),
 * apps Android marks as games, and apps Rishi added — minus the ones he removed.
 */
const BUILT_IN_PACKAGES = new Set(ENTERTAINMENT_APPS.flatMap((a) => a.packages));
const BUILT_IN_LABELS = new Set(ENTERTAINMENT_APPS.flatMap((a) => a.labels));

export function isBuiltIn(pkg: string, label?: string): boolean {
  return BUILT_IN_PACKAGES.has(pkg) || (!!label && BUILT_IN_LABELS.has(label.trim().toLowerCase()));
}

export interface AppContext {
  labels: Record<string, string>;
  games: ReadonlySet<string>;
}

export function isEntertainment(
  pkg: string,
  rules: Pick<ScreenRuleValues, 'added_apps' | 'removed_apps'>,
  ctx: AppContext,
): boolean {
  if (rules.removed_apps.includes(pkg)) return false;
  if (rules.added_apps.includes(pkg)) return true;
  return isBuiltIn(pkg, ctx.labels[pkg]) || ctx.games.has(pkg);
}

export function isYouTube(pkg: string): boolean {
  return YOUTUBE_PACKAGES.includes(pkg);
}

/** One day's totals from every device, added up per app. */
export interface DayTotals {
  apps: Record<string, number>;
  focus: Record<string, number>;
  labels: Record<string, string>;
  games: Set<string>;
}

export function combineDays(records: readonly ScreenDay[]): DayTotals {
  const out: DayTotals = { apps: {}, focus: {}, labels: {}, games: new Set() };
  for (const r of records) {
    if (r.deleted_at) continue;
    for (const [pkg, s] of Object.entries(r.apps)) out.apps[pkg] = (out.apps[pkg] ?? 0) + s;
    for (const [pkg, s] of Object.entries(r.focus)) out.focus[pkg] = (out.focus[pkg] ?? 0) + s;
    Object.assign(out.labels, r.labels);
    for (const g of r.games) out.games.add(g);
  }
  return out;
}

/** Seconds of an app that count as entertainment that day (YouTube inside focus doesn't). */
export function countedSeconds(pkg: string, t: DayTotals): number {
  const s = t.apps[pkg] ?? 0;
  return isYouTube(pkg) ? Math.max(0, s - (t.focus[pkg] ?? 0)) : s;
}

/** The day's entertainment seconds. */
export function entertainmentSeconds(
  t: DayTotals,
  rules: Pick<ScreenRuleValues, 'added_apps' | 'removed_apps'>,
): number {
  const ctx = { labels: t.labels, games: t.games };
  let sum = 0;
  for (const pkg of Object.keys(t.apps)) {
    if (isEntertainment(pkg, rules, ctx)) sum += countedSeconds(pkg, t);
  }
  return sum;
}

export interface AppUsage {
  pkg: string;
  label: string;
  seconds: number;
  entertainment: boolean;
}

/** Apps by time, most first (for "top apps"). */
export function topApps(
  t: DayTotals,
  rules: Pick<ScreenRuleValues, 'added_apps' | 'removed_apps'>,
  limit = 5,
): AppUsage[] {
  const ctx = { labels: t.labels, games: t.games };
  return Object.keys(t.apps)
    .map((pkg) => {
      const entertainment = isEntertainment(pkg, rules, ctx);
      return {
        pkg,
        label: t.labels[pkg] ?? pkg,
        seconds: entertainment ? countedSeconds(pkg, t) : (t.apps[pkg] ?? 0),
        entertainment,
      };
    })
    .filter((a) => a.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds || a.label.localeCompare(b.label))
    .slice(0, limit);
}
