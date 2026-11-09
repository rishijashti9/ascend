import { useEffectsLevel } from '@/app/effects';

/**
 * The System companion (Phase 12): an original little robot — rounded head, dark visor, two
 * eyes, an antenna. Its colours come from the theme (`--robot-*`), so every theme styles it in
 * its own way. It blinks and bobs gently; with effects off (or "reduce motion") it stays still.
 * Decorative: whatever it accompanies carries the meaning.
 */
export function Robot({
  size = 40,
  mood = 'idle',
  className = '',
}: {
  size?: number;
  /** happy: eyes curve up (celebrations); idle: round eyes. */
  mood?: 'idle' | 'happy';
  className?: string;
}) {
  const fx = useEffectsLevel();
  const alive = fx !== 'off';
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={`shrink-0 ${alive ? 'robot-idle' : ''} ${className}`}
    >
      {/* antenna */}
      <line
        x1="24"
        y1="4"
        x2="24"
        y2="11"
        stroke="var(--robot-head)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle
        cx="24"
        cy="4"
        r="3"
        fill="var(--robot-accent)"
        className={alive ? 'robot-pulse' : ''}
      />
      {/* head */}
      <rect x="6" y="11" width="36" height="31" rx="12" fill="var(--robot-head)" />
      {/* visor */}
      <rect x="11" y="17" width="26" height="15" rx="7.5" fill="var(--robot-visor)" />
      {/* eyes */}
      {mood === 'happy' ? (
        <g fill="none" stroke="var(--robot-eye)" strokeWidth="2.5" strokeLinecap="round">
          <path d="M16 26 q3 -4 6 0" />
          <path d="M26 26 q3 -4 6 0" />
        </g>
      ) : (
        <g fill="var(--robot-eye)" className={alive ? 'robot-blink' : ''}>
          <circle cx="19" cy="24.5" r="2.6" />
          <circle cx="29" cy="24.5" r="2.6" />
        </g>
      )}
      {/* mouth line */}
      <rect x="20" y="36" width="8" height="2" rx="1" fill="var(--robot-visor)" opacity="0.5" />
    </svg>
  );
}
