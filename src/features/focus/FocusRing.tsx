import { useEffectsLevel } from '@/app/effects';

/**
 * The Focus ring (Phase 12, ELEVATE): a thick accent arc on a dark track with the time in big
 * display type, and a small dot slowly orbiting (Full effects only). `ratio` = share left (1 =
 * full). Decorative around the time, which carries the meaning.
 */
export function FocusRing({
  ratio,
  children,
  size = 260,
}: {
  ratio: number;
  children: React.ReactNode;
  size?: number;
}) {
  const fx = useEffectsLevel();
  const r = 108;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, ratio));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg aria-hidden viewBox="0 0 240 240" className="absolute inset-0 size-full -rotate-90">
        <circle cx="120" cy="120" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="14" />
        <circle
          cx="120"
          cy="120"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
      </svg>
      {fx === 'full' && (
        <svg aria-hidden viewBox="0 0 240 240" className="focus-orbit absolute inset-0 size-full">
          <circle cx="120" cy="6" r="5" fill="var(--text)" />
        </svg>
      )}
      <div className="relative flex flex-col items-center gap-1">{children}</div>
    </div>
  );
}
