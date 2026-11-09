import { Award, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { subscribe } from '@/core/pipeline';
import { useEffectsLevel } from '@/app/effects';
import { ACHIEVEMENTS } from '@/data/achievements';
import { Burst } from '@/ui/vfx/Burst';

const SHOW_MS = 6000;

/**
 * A quiet note when achievements unlock (SPEC 8: gaming hints stay small). Several at once
 * (e.g. the first check after importing history) become one line with a link to Profile.
 */
export function AchievementToast() {
  const [keys, setKeys] = useState<string[]>([]);
  const [fireKey, setFireKey] = useState<number | null>(null);
  const moving = useEffectsLevel() !== 'off';
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = subscribe('AchievementUnlocked', ({ key }) => {
      setKeys((list) => (list.includes(key) ? list : [...list, key]));
      setFireKey(Date.now());
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setKeys([]), SHOW_MS);
    });
    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const defs = keys.flatMap((k) => ACHIEVEMENTS.filter((a) => a.key === k));
  const first = defs[0];
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+9.5rem)] z-40 flex justify-center lg:bottom-6 lg:left-auto lg:right-6"
    >
      {first && (
        <div
          key={fireKey ?? 0}
          className={`tile tile-white shadow-float pointer-events-auto relative flex max-w-sm items-center gap-3 py-3 pr-2 pl-3 text-sm ${moving ? 'vfx-pop' : ''}`}
        >
          <Burst fireKey={fireKey} tone="celebrate" className="top-1/2 left-8 size-0" />
          <span className="bg-bg text-accent-text grid size-11 shrink-0 place-items-center rounded-full">
            <Award aria-hidden size={22} />
          </span>
          <p className="flex-1">
            {defs.length === 1 ? (
              <>
                <span className="text-on-tile-muted block text-xs font-semibold tracking-wide uppercase">
                  Achievement
                </span>
                <span className="display block text-base">{first.name}</span>
                <span className="text-on-tile-muted block">{first.description}</span>
              </>
            ) : (
              <span className="display block text-base">{defs.length} achievements unlocked</span>
            )}
            <Link
              to="/me/stats#achievements"
              className="block min-h-6 font-semibold underline underline-offset-2"
            >
              See them on your profile
            </Link>
          </p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setKeys([])}
            className="grid size-11 shrink-0 place-items-center rounded-full hover:opacity-70"
          >
            <X aria-hidden size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
