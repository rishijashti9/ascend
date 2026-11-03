/** An on/off switch labelled by a visible element's id: a 56×32 track inside a 56×44 tap area. */
export function Switch({
  on,
  labelledBy,
  disabled,
  onChange,
}: {
  on: boolean;
  labelledBy: string;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="flex h-11 w-14 shrink-0 items-center rounded-full disabled:opacity-50"
    >
      <span
        aria-hidden
        className={`relative h-8 w-14 rounded-full transition-colors ${on ? 'bg-accent-fill' : 'bg-surface-2 border-border border'}`}
      >
        <span
          className={`bg-surface absolute top-1 size-6 rounded-full shadow transition-[left] ${on ? 'left-7' : 'left-1'}`}
        />
      </span>
    </button>
  );
}
