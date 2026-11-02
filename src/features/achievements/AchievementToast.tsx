import { Award, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { subscribe } from '@/core/pipeline';
import { ACHIEVEMENTS } from '@/data/achievements';

const SHOW_MS = 6000;

/**
 * A quiet note when achievements unlock (SPEC 8: gaming hints stay small). Several at once
 * (e.g. the first check after importing history) become one line with a link to Profile.
 */
export function AchievementToast() {
  const [keys, setKeys] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = subscribe('AchievementUnlocked', ({ key }) => {
      setKeys((list) => (list.includes(key) ? list : [...list, key]));
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
      className="pointer-events-none fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex justify-center lg:bottom-6 lg:left-auto lg:right-6"
    >
      {first && (
        <div className="border-border bg-surface shadow-card pointer-events-auto flex max-w-sm items-center gap-3 rounded-lg border px-4 py-3 text-sm">
          <Award aria-hidden size={20} className="text-accent-text shrink-0" />
          <p className="flex-1">
            {defs.length === 1 ? (
              <>
                <span className="font-semibold">Achievement: {first.name}</span>
                <span className="text-muted block">{first.description}</span>
              </>
            ) : (
              <span className="font-semibold">{defs.length} achievements unlocked</span>
            )}
            <Link to="/profile#achievements" className="text-accent-text block">
              See them on your profile
            </Link>
          </p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setKeys([])}
            className="text-muted flex size-11 shrink-0 items-center justify-center"
          >
            <X aria-hidden size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
