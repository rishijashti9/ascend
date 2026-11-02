/** Thin progress bar. `value` is 0–1; `fill` is a token background class. */
export function ProgressBar({
  value,
  fill = 'bg-accent',
  label,
  className = 'h-2',
}: {
  value: number;
  fill?: string;
  label: string;
  className?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={`bg-surface-2 w-full overflow-hidden rounded-full ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-(--dur-slow) ${fill}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
