import { useState } from 'react';
import { useLocation } from 'react-router';
import { useEffectsLevel } from '@/app/effects';
import { Robot } from '@/ui/Robot';
import { Sheet } from '@/ui/Sheet';
import { AskPanel } from './AskPage';
import { askScreenFor, showsAskButton } from './askContext';

/**
 * Ask the System from anywhere (Phase 12): a round robot button bottom-right, above the bottom
 * bar, on every main screen. It pulses a few times when a screen opens, then rests (no endless
 * animation). It opens a bottom sheet that knows which screen you came from and suggests fitting
 * questions; with Ask off the Growth Compass answers instead.
 */
export function AskButton() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const fx = useEffectsLevel();
  if (!showsAskButton(pathname)) return null;
  const screen = askScreenFor(pathname);

  return (
    <>
      <button
        type="button"
        // A new key per screen restarts the short pulse when you arrive somewhere new.
        key={pathname}
        aria-label="Ask the System"
        onClick={() => setOpen(true)}
        className={`bg-tile-lime shadow-float fixed right-4 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.5rem)] z-30 grid size-14 place-items-center rounded-full lg:right-8 lg:bottom-8 ${
          fx === 'off' ? '' : 'animate-ask-pulse'
        }`}
      >
        <Robot size={34} />
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
