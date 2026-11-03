import { GAME } from '@/config/game';

/** "45 min", "3 h", "3 h 20 min" — study time on the Skills screen. */
export function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Hours with at most one decimal: 12.5. */
export function hours(minutes: number): number {
  return Math.round(minutes / 6) / 10;
}

/** One calm line about the split; within 5 points of the aim counts as on track. */
export function balanceNote(ai: number, target: number): string {
  if (Math.abs(ai - target) <= 5) return 'Right on your split.';
  return ai > target
    ? 'Games is a little behind your split — a game-dev session would even it out.'
    : 'AI & Robotics is a little behind your split — it’s your main track.';
}

/** "Level 1 at 3 h, … 4 at 120 h with 1 project, 5 at 250 h with 2 projects." from the config. */
export function levelRules(): string {
  const parts = GAME.skills.levelHours.map((h, i) => {
    const p = GAME.skills.levelProjects[i] ?? 0;
    const proof = p > 0 ? ` with ${p} project${p === 1 ? '' : 's'}` : '';
    return `${i === 0 ? 'Level ' : ''}${i + 1} at ${h} h${proof}`;
  });
  return `${parts.join(', ')}.`;
}
