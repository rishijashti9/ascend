import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

/**
 * Theme building blocks (Phase 12). They use the theme utilities (panel / tile / pill / display)
 * so every screen follows the active theme's surface style without hard-coding a colour.
 */

/** A page title in the theme's display type. */
export function PageTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h1 id={id} className="display text-2xl">
      {children}
    </h1>
  );
}

/** A section heading in the display type (smaller). */
export function SectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="display text-lg">
      {children}
    </h2>
  );
}

/** A labelled panel: a section of content on the page ground. */
export function Panel({
  title,
  label,
  children,
  className = '',
  gap = 'gap-3',
}: {
  title?: ReactNode;
  /** Accessible name when there is no visible title (or a different one). */
  label?: string;
  children: ReactNode;
  className?: string;
  gap?: string;
}) {
  return (
    <section
      aria-label={label ?? (typeof title === 'string' ? title : undefined)}
      className={`panel flex flex-col ${gap} ${className}`}
    >
      {title && <h2 className="display text-base">{title}</h2>}
      {children}
    </section>
  );
}

export type TileTone = 'lime' | 'white' | 'yellow' | 'grey' | 'violet';

const TONE: Record<TileTone, string> = {
  lime: 'tile-lime',
  white: 'tile-white',
  yellow: 'tile-yellow',
  grey: 'tile-grey',
  violet: 'tile-violet',
};

/** The round ↗ button on a tile (decorative inside a link tile). */
export function ArrowCircle({ dark = true }: { dark?: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid size-10 shrink-0 place-items-center rounded-full ${
        dark ? 'bg-bg text-text' : 'bg-tile-white text-on-tile-white'
      }`}
    >
      <ArrowUpRight size={20} strokeWidth={2.5} />
    </span>
  );
}

/**
 * A bento tile. With `to` the whole tile is a link (one tap to its screen) with a ↗ circle.
 * `label` names it for screen readers when the visible text isn't enough.
 */
export function Tile({
  tone,
  to,
  label,
  children,
  className = '',
}: {
  tone: TileTone;
  to?: string;
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  const cls = `tile ${TONE[tone]} relative flex flex-col gap-2 overflow-hidden ${className}`;
  if (!to)
    return (
      <section aria-label={label} className={cls}>
        {children}
      </section>
    );
  return (
    <Link
      to={to}
      aria-label={label}
      className={`${cls} transition-transform duration-(--dur) ease-(--ease-out) active:scale-[0.97]`}
    >
      <span className="absolute top-3 right-3">
        <ArrowCircle dark={tone !== 'grey'} />
      </span>
      {children}
    </Link>
  );
}

/** A filter chip (pill): white when active. */
export function Chip({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={`pill min-h-11 shrink-0 px-4 text-sm font-semibold transition-colors duration-(--dur-fast) ${
        active ? 'bg-tile-white text-on-tile-white' : 'bg-surface-2 text-text'
      }`}
    >
      {children}
    </button>
  );
}

export interface TabDef<T extends string> {
  id: T;
  label: string;
}

/**
 * A pill tab bar (role tablist). Panels use `tabPanelProps(id)` so ids and aria wiring match.
 */
export function Tabs<T extends string>({
  label,
  tabs,
  active,
  onChange,
  idPrefix = 'tab',
}: {
  label: string;
  tabs: readonly TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
  idPrefix?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="pill bg-surface flex gap-1 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={`${idPrefix}-${t.id}`}
          aria-selected={active === t.id}
          aria-controls={`${idPrefix}-panel-${t.id}`}
          onClick={() => onChange(t.id)}
          className={`pill min-h-11 flex-1 px-3 text-sm font-semibold transition-colors duration-(--dur-fast) ${
            active === t.id ? 'bg-tile-white text-on-tile-white' : 'text-muted'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
