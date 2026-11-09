import { Award, Lock } from 'lucide-react';
import { isAvailable } from '@/config/features';
import { useAppState } from '@/core/state/app';
import { achievementProgress } from '@/core/engine/achievements';
import { useAchievements } from '@/core/state/achievements';
import { ACHIEVEMENTS } from '@/data/achievements';
import { formatDay } from '@/features/goals/format';
import { ProgressBar } from '@/ui/ProgressBar';

/**
 * Achievements on the Profile (SPEC 7.8): unlocked ones with their date, then the rest with
 * how far along they are. Achievements of features not built yet stay hidden.
 */
export function AchievementList() {
  const unlocked = useAchievements((s) => s.unlocked);
  const facts = useAchievements((s) => s.facts);
  const settings = useAppState((s) => s.settings);
  if (!facts) return null;
  const visible = ACHIEVEMENTS.filter((a) => !a.feature || isAvailable(a.feature, settings));
  const done = visible
    .filter((a) => unlocked[a.key])
    .sort((a, b) =>
      (unlocked[b.key]?.unlocked_at ?? '').localeCompare(unlocked[a.key]?.unlocked_at ?? ''),
    );
  const locked = visible
    .filter((a) => !unlocked[a.key])
    .map((a) => ({ def: a, ...achievementProgress(a, facts) }))
    .sort((a, b) => b.progress - a.progress);

  return (
    <section id="achievements" aria-label="Achievements" className="panel flex flex-col gap-4 p-4">
      <div>
        <h2 className="display">Achievements</h2>
        <p className="text-muted text-sm">
          {done.length} of {visible.length} unlocked
        </p>
      </div>
      {done.length > 0 && (
        <ul aria-label="Unlocked" className="grid gap-2 sm:grid-cols-2">
          {done.map((a) => (
            <li key={a.key} className="bg-surface-2 flex items-start gap-3 rounded-md p-3">
              <Award aria-hidden size={20} className="text-accent-text mt-0.5 shrink-0" />
              <div className="min-w-0 text-sm">
                <p className="font-medium">{a.name}</p>
                <p className="text-muted">{a.description}</p>
                <p className="text-muted text-xs">
                  Unlocked {formatDay((unlocked[a.key]?.unlocked_at ?? '').slice(0, 10))}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {locked.length > 0 && (
        <details>
          <summary className="text-accent-text min-h-11 cursor-pointer py-2 text-sm">
            Still to unlock ({locked.length})
          </summary>
          <ul aria-label="Still to unlock" className="mt-2 grid gap-2 sm:grid-cols-2">
            {locked.map(({ def, value }) => (
              <li
                key={def.key}
                className="border-border flex items-start gap-3 rounded-md border p-3"
              >
                <Lock aria-hidden size={18} className="text-muted mt-0.5 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                  <p className="font-medium">{def.name}</p>
                  <p className="text-muted">{def.description}</p>
                  <ProgressBar
                    value={Math.min(1, value / def.goal)}
                    label={`${def.name}: ${Math.min(value, def.goal)} of ${def.goal}`}
                  />
                  <p className="text-muted text-xs tabular-nums">
                    {Math.min(value, def.goal).toLocaleString()} / {def.goal.toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
