import { Check } from 'lucide-react';
import { builtThemes, type ThemeDef, type ThemeId } from '@/config/themes';

/**
 * The theme picker (Phase 12): one card per BUILT theme with a live mini-preview drawn from the
 * theme's own palette — a tiny Today with a header, two tiles and a bar. Unbuilt themes never
 * appear. Used in Settings → Appearance and in onboarding.
 */
export function ThemePicker({
  value,
  onChange,
  disabled,
}: {
  value: ThemeId;
  onChange: (id: ThemeId) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {builtThemes().map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(t.id)}
            className={`bg-surface-2 flex min-h-11 flex-col gap-3 rounded-lg border-2 p-3 text-left transition-colors duration-(--dur-fast) disabled:opacity-50 ${
              selected ? 'border-accent' : 'border-transparent'
            }`}
          >
            <MiniPreview theme={t} />
            <span className="flex items-start justify-between gap-2">
              <span>
                <span className="display block text-base">{t.name}</span>
                <span className="text-muted block text-sm">{t.tagline}</span>
              </span>
              {selected && (
                <span className="bg-accent-fill text-on-accent grid size-7 shrink-0 place-items-center rounded-full">
                  <Check aria-hidden size={16} />
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A tiny picture of the theme in its own colours (decorative — the name says which theme). */
function MiniPreview({ theme }: { theme: ThemeDef }) {
  const p = theme.palette;
  return (
    <span
      aria-hidden
      className="flex h-28 w-full flex-col gap-1.5 overflow-hidden rounded-md p-2.5"
      style={{ background: p.bg }}
    >
      <span className="flex items-center justify-between">
        <span className="h-2.5 w-16 rounded-full" style={{ background: p.text }} />
        <span className="size-4 rounded-full" style={{ background: p.accent }} />
      </span>
      <span className="h-1.5 w-full rounded-full" style={{ background: p.surface }}>
        <span className="block h-full w-2/3 rounded-full" style={{ background: p.accent }} />
      </span>
      <span className="grid flex-1 grid-cols-3 gap-1.5">
        <span className="col-span-2 rounded-md" style={{ background: p.tiles[0] }} />
        <span className="rounded-md" style={{ background: p.tiles[1] }} />
        <span className="rounded-md" style={{ background: p.tiles[2] }} />
        <span className="col-span-2 rounded-md" style={{ background: p.tiles[3] }} />
      </span>
    </span>
  );
}
