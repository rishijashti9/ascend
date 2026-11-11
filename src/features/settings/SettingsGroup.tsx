import { ChevronDown } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';

/**
 * One fold-out group of Settings (UX-6, docs/product/AUDIT-AND-PROPOSAL.md P10: Settings was one
 * flat page about six phone screens long). Closed by default; a link to `/settings#<id>` — the
 * group's own id, or the id of a section inside it (e.g. `#notifications`) — opens it and scrolls
 * there, so every existing link into Settings still lands on the right control.
 */
export function SettingsGroup({
  id,
  title,
  summary,
  contains = [],
  children,
}: {
  id: string;
  title: string;
  /** One line under the title: what's inside. */
  summary: string;
  /** Ids of sections inside this group that links may point at. */
  contains?: string[];
  children: ReactNode;
}) {
  const { hash } = useLocation();
  const target = hash.replace(/^#/, '');
  const targeted = target === id || contains.includes(target);
  const [open, setOpen] = useState(targeted);
  // A new link into this group opens it — adjusted while rendering, not in an effect.
  const [seen, setSeen] = useState(target);
  if (target !== seen) {
    setSeen(target);
    if (targeted) setOpen(true);
  }

  useEffect(() => {
    if (!targeted) return;
    // After the group has opened, bring the linked section into view.
    const t = setTimeout(
      () => document.getElementById(target)?.scrollIntoView({ block: 'start' }),
      0,
    );
    return () => clearTimeout(t);
  }, [targeted, target]);

  return (
    <details
      id={id}
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="panel group"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="display block">{title}</span>
          <span className="text-muted block text-sm">{summary}</span>
        </span>
        <ChevronDown
          aria-hidden
          size={20}
          className="text-muted shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="flex flex-col gap-4 px-2 pb-2">{children}</div>
    </details>
  );
}
