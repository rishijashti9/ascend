import { useEffect, useRef } from 'react';
import { dismissMoment, useMoments } from '@/core/state/moments';
import { STAT_META } from '@/ui/statMeta';

/**
 * The level-up / rank-up moment (SPEC 8): a short full-screen card, skippable with one tap,
 * the button or Esc. With reduced motion it simply appears, with no movement.
 */
export function LevelUpMoment() {
  const moment = useMoments((s) => s.queue[0]);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!moment) return;
    button.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissMoment();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moment]);

  if (!moment) return null;
  const heading = moment.rank
    ? `Rank ${moment.rank}`
    : moment.level
      ? `Level ${moment.level}`
      : 'Stat up';
  const kicker = moment.rank ? 'Rank up' : moment.level ? 'Level up' : 'Growing';

  return (
    <div
      className="bg-bg/90 fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm"
      onClick={dismissMoment}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="moment-heading"
        className="panel animate-moment-in flex w-full max-w-sm flex-col items-center gap-4 p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-accent-text text-xs font-semibold tracking-[0.2em] uppercase">
          {kicker}
        </p>
        <h2 id="moment-heading" className="display display text-4xl tabular-nums">
          {heading}
        </h2>
        <ul className="text-muted flex flex-col gap-1 text-sm">
          {moment.rank && moment.level && <li>Level {moment.level}</li>}
          {moment.stats.map(({ stat, level }) => {
            const Icon = STAT_META[stat].icon;
            return (
              <li key={stat} className="flex items-center justify-center gap-1">
                <Icon aria-hidden size={16} className={STAT_META[stat].text} />
                {STAT_META[stat].label} reached level {level}
              </li>
            );
          })}
        </ul>
        <button
          ref={button}
          type="button"
          onClick={dismissMoment}
          className="bg-accent-fill text-on-accent min-h-11 w-full rounded-md px-4 font-medium"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
