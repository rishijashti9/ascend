import { useState } from 'react';
import { useLocation } from 'react-router';
import { useEffectsLevel } from '@/app/effects';
import { isEnabled } from '@/config/features';
import { Robot } from '@/ui/Robot';
import { Sheet } from '@/ui/Sheet';
import { AskPanel } from './AskPage';
import { askScreenFor } from './askContext';

/**
 * Ask the System from the main screens (Phase 12): a round robot button in the screen's title
 * row. It used to float bottom-right over the content; since UX-1 (docs/product/AUDIT-AND-
 * PROPOSAL.md, P6) it sits in the header so it never covers text or controls. It pulses a few
 * times when a screen opens, then rests. It opens a bottom sheet that knows which screen you came
 * from and suggests fitting questions; with Ask off the Growth Compass answers instead.
 */
export function AskEntry() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const fx = useEffectsLevel();
  if (!isEnabled('ask')) return null;
  const screen = askScreenFor(pathname);

  return (
    <>
      <button
        type="button"
        // A new key per screen restarts the short pulse when you arrive somewhere new.
        key={pathname}
        aria-label="Ask the System"
        onClick={() => setOpen(true)}
        className={`bg-tile-lime grid size-12 shrink-0 place-items-center rounded-full ${
          fx === 'off' ? '' : 'animate-ask-pulse'
        }`}
      >
        <Robot size={30} />
      </button>
      {open && (
        <Sheet variant="bottom" titleId="ask-title" onClose={() => setOpen(false)}>
          <div className="flex items-center gap-3">
            <Robot size={36} />
            <div>
              <h2 id="ask-title" className="display text-lg">
                Ask the System
              </h2>
              <p className="text-muted text-sm">
                Career and health only · you’re on <span className="text-text">{screen.name}</span>
              </p>
            </div>
          </div>
          <AskPanel suggestions={screen.suggestions} note={screen.note} />
        </Sheet>
      )}
    </>
  );
}
