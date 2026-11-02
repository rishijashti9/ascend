/**
 * Balance simulation (SPEC 4.8). Models a realistic user for 5 years using the real
 * game config and level curve, and prints level, stat levels and rank per year.
 *
 *   npm run simulate              (20 users, seed 1)
 *   npm run simulate -- 50 7      (50 users, seed 7)
 *
 * Targets: ~level 25–30 after year 1, ~55–60 after year 5, rank S not before year 4–5.
 */
import { GAME, type Rank } from '@/config/game';
import { STATS, type Difficulty, type Stat } from '@/core/db/types';
import { levelFromXp, rankFor } from '@/core/engine/levels';
import { computeDayXp } from '@/core/engine/xp';

// ---- The user's real starter quests (DECISIONS.md) ----
const HABITS: { name: string; stat: Stat; difficulty: Difficulty; core: boolean }[] = [
  { name: 'Wake up on time', stat: 'WIL', difficulty: 'normal', core: true },
  { name: 'AI & Robotics study', stat: 'INT', difficulty: 'hard', core: true },
  { name: 'Workout', stat: 'STR', difficulty: 'normal', core: true },
  { name: 'Game dev study', stat: 'INT', difficulty: 'normal', core: false },
  { name: 'Walk', stat: 'STR', difficulty: 'easy', core: false },
  { name: 'Sleep', stat: 'STR', difficulty: 'normal', core: false },
  { name: 'Journal', stat: 'WIL', difficulty: 'easy', core: false },
  { name: 'Meditate', stat: 'WIL', difficulty: 'easy', core: false },
];

// ---- Behaviour model ("realistic user") ----
const MODEL = {
  coreDoneChance: 0.9, // each core habit, on a normal day
  otherDoneChance: 0.72, // each non-core habit
  fullShare: 0.75, // of done quests, share done at full (rest at minimum)
  lowEnergyChance: 0.1, // low-energy days: only core minimums
  breaksPerYear: 2, // stretches of missed days (illness, travel, burnout)
  breakLength: [4, 13] as const,
  recoveryDoneChance: 0.7, // completes the Recovery quest after a missed day
};

const YEARS = 5;
const runs = Number(process.argv[2] ?? 20);
const seed0 = Number(process.argv[3] ?? 1);

/** Small deterministic RNG so results are repeatable. */
function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** The day's XP through the real engine (SPEC 4.8 order of operations). */
function dayXp(
  baseAwards: { stat: Stat; base: number }[],
  streakAtStart: number,
  dailyClear: boolean,
) {
  const events = baseAwards.map(({ stat, base }, i) => ({
    occurred_at: `2026-01-01T${String(i).padStart(2, '0')}:00:00.000Z`,
    stat,
    base_amount: base,
    reason: 'quest_full' as const,
    ref_id: `q${i}`,
    idempotency_key: `q${i}:quest_full:0`,
  }));
  return computeDayXp(events, streakAtStart, dailyClear);
}

interface YearRow {
  year: number;
  level: number;
  STR: number;
  INT: number;
  WIL: number;
  activeDays: number;
  longestStreak: number;
  rank: Rank;
}

function simulateUser(seed: number): { rows: YearRow[]; sDay: number | null } {
  const r = rng(seed);
  const statXp: Record<Stat, number> = { STR: 0, INT: 0, WIL: 0 };
  let total = 0;
  let streak = 0;
  let longest = 0;
  let activeDays = 0;
  let shields = 0;
  let activeRun = 0; // consecutive active days toward the next shield
  let breakLeft = 0;
  let lastRepairDay = -Infinity;
  let pendingRepair: number | null = null; // day index of an unprotected miss
  let sDay: number | null = null;
  const rows: YearRow[] = [];

  for (let d = 1; d <= 365 * YEARS; d++) {
    if (breakLeft > 0) breakLeft--;
    else if (r() < MODEL.breaksPerYear / 365) {
      const [lo, hi] = MODEL.breakLength;
      breakLeft = lo + Math.floor(r() * (hi - lo + 1)) - 1;
    }
    const away = breakLeft > 0;
    const lowEnergy = !away && r() < MODEL.lowEnergyChance;

    const awards: { stat: Stat; base: number }[] = [];
    let coreOk = !away;
    let allDone = !away;
    if (!away) {
      for (const h of HABITS) {
        if (lowEnergy && !h.core) continue;
        const done = r() < (h.core ? MODEL.coreDoneChance : MODEL.otherDoneChance);
        if (!done) {
          allDone = false;
          if (h.core) coreOk = false;
          continue;
        }
        const full = !lowEnergy && r() < MODEL.fullShare;
        const base = GAME.xpByDifficulty[h.difficulty] * (full ? 1 : GAME.minFraction);
        awards.push({ stat: h.stat, base });
      }
      // Recovery quest after an unprotected miss (DECISIONS 3).
      if (pendingRepair === d - 1 && r() < MODEL.recoveryDoneChance) {
        awards.push({ stat: 'WIL', base: GAME.xpByDifficulty[GAME.recoveryDifficulty] });
        if (d - lastRepairDay >= GAME.repairWindowDays && streak > 0) {
          lastRepairDay = d; // the missed day is repaired: streak kept (not increased)
          pendingRepair = null;
        }
      }
    }
    if (pendingRepair !== null && pendingRepair < d) {
      // Not repaired in time: the streak breaks now.
      streak = 0;
      activeRun = 0;
      pendingRepair = null;
    }

    const day = dayXp(awards, streak, allDone && awards.length > 0);
    for (const stat of STATS) statXp[stat] += day.byStat[stat];
    total += day.total;

    if (coreOk) {
      activeDays++;
      streak++;
      activeRun++;
      if (activeRun % GAME.shields.earnEvery === 0)
        shields = Math.min(GAME.shields.max, shields + 1);
    } else if (shields > 0) {
      shields--; // streak kept, not increased; shield count pauses (DECISIONS 2)
    } else if (streak > 0) {
      pendingRepair = d; // a Recovery quest tomorrow may repair it
    }
    longest = Math.max(longest, streak);

    const level = levelFromXp(total).level;
    if (sDay === null && rankFor(level, activeDays) === 'S') sDay = d;
    if (d % 365 === 0) {
      rows.push({
        year: d / 365,
        level,
        STR: levelFromXp(statXp.STR).level,
        INT: levelFromXp(statXp.INT).level,
        WIL: levelFromXp(statXp.WIL).level,
        activeDays,
        longestStreak: longest,
        rank: rankFor(level, activeDays),
      });
    }
  }
  return { rows, sDay };
}

// ---- Run and report ----
const results = Array.from({ length: runs }, (_, i) => simulateUser(seed0 + i * 7919));
const avg = (year: number, key: Exclude<keyof YearRow, 'rank'>) =>
  Math.round(results.reduce((sum, res) => sum + (res.rows[year]?.[key] ?? 0), 0) / runs);
const mostCommonRank = (year: number): Rank => {
  const counts = new Map<Rank, number>();
  for (const res of results) {
    const rank = res.rows[year]?.rank ?? 'E';
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'E';
};

console.log(
  `ASCEND balance simulation — ${runs} users, seed ${seed0}, curve ${GAME.levelCurve.base}·n^${GAME.levelCurve.exponent}\n`,
);
console.log('| Year | Level | STR | INT | WIL | Active days | Longest streak | Rank |');
console.log('|---|---|---|---|---|---|---|---|');
for (let y = 0; y < YEARS; y++) {
  console.log(
    `| ${y + 1} | ${avg(y, 'level')} | ${avg(y, 'STR')} | ${avg(y, 'INT')} | ${avg(y, 'WIL')} | ${avg(y, 'activeDays')} | ${avg(y, 'longestStreak')} | ${mostCommonRank(y)} |`,
  );
}

const sDays = results.map((r) => r.sDay).filter((d): d is number => d !== null);
const earliestS = sDays.length ? Math.min(...sDays) : null;
const y1 = avg(0, 'level');
const y5 = avg(YEARS - 1, 'level');
const checks = [
  [`Year 1 level ${y1} within 25–30`, y1 >= 25 && y1 <= 30],
  [`Year 5 level ${y5} within 55–60`, y5 >= 55 && y5 <= 60],
  [
    `Earliest rank S: ${earliestS ? `year ${(earliestS / 365).toFixed(1)}` : 'never'} (not before year 4)`,
    earliestS === null || earliestS >= 365 * 3.5,
  ],
  [`Users reaching S within 5 years: ${sDays.length}/${runs}`, sDays.length > 0],
] as const;
console.log('');
for (const [label, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${label}`);
