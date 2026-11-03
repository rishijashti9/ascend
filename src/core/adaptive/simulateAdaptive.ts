import type { InstanceStatus } from '@/core/db/types';
import { difficultySuggestion } from '@/core/engine/difficulty';
import { addDays, type DayString } from '@/core/time';
import { DEFAULT_SETTINGS } from '@/config/defaults';
import type { AdaptiveInput, InstanceObs } from './input';

/**
 * Simulated users for the Adaptive System (SPEC 6.7 phase tests; `npm run simulate`). Each user
 * has one minutes quest and a real sustainable amount per day (their capacity). A target above
 * capacity is reached less often — and, as in real life, keeps being missed discourages them
 * from doing even the minimum. With adaptive difficulty on, the real engine suggests changes
 * and the user accepts most of them; with it off, the target never changes.
 */
export interface SimUser {
  capacity: number;
  start: number;
  min: number;
}

export interface SimResult {
  /** Share of days the quest was done at least at its minimum, over the last 90 days. */
  adherence: number;
  /** Share of days done in full, over the last 90 days. */
  fullRate: number;
  finalTarget: number;
  changes: number;
  /** Times the direction flipped (ease after raise or raise after ease). */
  reversals: number;
  /** A raise within 28 days of an ease — real back-and-forth (an ease soon after a raise is
   * just a raise that didn't work being taken back). */
  quickReversals: number;
}

const DAYS = 365;
const START: DayString = '2026-01-05';

function rng(seed: number): () => number {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Chance of reaching the full target given capacity (1 = target at capacity). */
function fullChance(target: number, capacity: number): number {
  const ratio = target / capacity;
  return ratio <= 1 ? 0.92 : 0.92 * Math.exp(-(ratio - 1) * 2.5);
}

export function simulateUser(user: SimUser, adaptive: boolean, seed: number): SimResult {
  const random = rng(seed);
  let target = user.start;
  const instances: InstanceObs[] = [];
  let snoozedUntil: DayString = '';
  let changes = 0;
  let reversals = 0;
  let quickReversals = 0;
  let lastDir = 0;
  let lastChange = -999;
  for (let k = 0; k < DAYS; k++) {
    const day = addDays(START, k);
    if (adaptive) {
      const input: AdaptiveInput = {
        today: day,
        tz: 'Asia/Kolkata',
        settings: {
          id: 'settings',
          created_at: '',
          updated_at: '',
          deleted_at: null,
          schema_version: 1,
          hlc: '',
          ...DEFAULT_SETTINGS,
        },
        startDay: START,
        habits: [
          {
            id: 'h',
            created_at: '',
            updated_at: '',
            deleted_at: null,
            schema_version: 1,
            hlc: '',
            title: 'Study',
            stat: 'INT',
            difficulty: 'hard',
            schedule: [0, 1, 2, 3, 4, 5, 6],
            full_version: '',
            min_version: '',
            measure: 'minutes',
            target_value: target,
            min_value: user.min,
            core: true,
            auto_source: 'none',
            skill_ids: [],
            status: 'active',
            planned_by: 'me',
            order: 0,
            linked_goal_type: null,
            linked_goal_id: null,
          },
        ],
        instances: instances.slice(-120),
        focus: [],
        sleep: [],
        weight: [],
        energy: [],
        mood: [],
        lowEnergyDays: [],
        events: [],
      };
      const s = difficultySuggestion({
        input,
        snoozedUntil: { ease: snoozedUntil, raise: snoozedUntil },
      });
      const change = s?.changes[0];
      if (s && change && (s.kind === 'ease' || s.kind === 'raise')) {
        // Most suggestions are accepted; "Not now" hides that kind for a week.
        if (random() < 0.8) {
          target = change.to;
          changes++;
          const dir = s.kind === 'raise' ? 1 : -1;
          if (lastDir !== 0 && dir !== lastDir) {
            reversals++;
            if (dir === 1 && k - lastChange < 28) quickReversals++;
          }
          lastDir = dir;
          lastChange = k;
        } else {
          snoozedUntil = addDays(day, 7);
        }
      }
    }
    const pFull = fullChance(target, user.capacity);
    // Missing the full target again and again discourages: the minimum gets skipped more.
    const pDone = Math.min(0.97, 0.55 + 0.42 * (pFull / 0.92));
    const r = random();
    const status: InstanceStatus = r < pFull ? 'done_full' : r < pDone ? 'done_min' : 'missed';
    instances.push({
      id: `h:${day}`,
      habitId: 'h',
      day,
      status,
      measure: 'minutes',
      target,
      min: user.min,
      value: status === 'done_full' ? target : status === 'done_min' ? user.min : 0,
      completedAt: null,
      core: true,
      lowEnergy: false,
      stat: 'INT',
      wake: false,
    });
  }
  const last = instances.slice(-90);
  return {
    adherence: last.filter((i) => i.status !== 'missed').length / last.length,
    fullRate: last.filter((i) => i.status === 'done_full').length / last.length,
    finalTarget: target,
    changes,
    reversals,
    quickReversals,
  };
}

/** A spread of users: most start above what they can sustain, some below. */
export function simUsers(n: number, seed: number): SimUser[] {
  const random = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const capacity = 40 + Math.round(random() * 100); // 40–140 min a day
    const over = i % 4 !== 3; // 3 in 4 start too ambitious
    const start = over
      ? Math.round((capacity * (1.3 + random() * 0.7)) / 5) * 5
      : Math.round((capacity * (0.5 + random() * 0.3)) / 5) * 5;
    return { capacity, start: Math.max(20, start), min: 15 };
  });
}

export interface SimSummary {
  users: number;
  fixed: { adherence: number; fullRate: number };
  adaptive: { adherence: number; fullRate: number };
  avgChanges: number;
  maxReversals: number;
  quickReversals: number;
  /** Users whose final target is within 25 % of their capacity. */
  nearCapacity: number;
}

export function simulateAdaptive(n = 30, seed = 1): SimSummary {
  const users = simUsers(n, seed);
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const fixed = users.map((u, i) => simulateUser(u, false, seed * 1000 + i));
  const adaptive = users.map((u, i) => simulateUser(u, true, seed * 1000 + i));
  return {
    users: n,
    fixed: {
      adherence: mean(fixed.map((r) => r.adherence)),
      fullRate: mean(fixed.map((r) => r.fullRate)),
    },
    adaptive: {
      adherence: mean(adaptive.map((r) => r.adherence)),
      fullRate: mean(adaptive.map((r) => r.fullRate)),
    },
    avgChanges: mean(adaptive.map((r) => r.changes)),
    maxReversals: Math.max(...adaptive.map((r) => r.reversals)),
    quickReversals: adaptive.reduce((n, r) => n + r.quickReversals, 0),
    nearCapacity: adaptive.filter(
      (r, i) => Math.abs(r.finalTarget / (users[i]?.capacity ?? 1) - 1) <= 0.25,
    ).length,
  };
}
