import { Compass, Timer } from 'lucide-react';
import { Link } from 'react-router';
import { isEnabled } from '@/config/features';
import type { NextAction } from '@/core/adaptive/today';

/**
 * "What should I do now?" (SPEC 6.7 A): one quest and why, in one quiet line. Changes nothing
 * by itself, so it isn't a suggestion card (Today's one-card rule is for those).
 */
export function WhatNow({ next }: { next: NextAction | null }) {
  if (!next) return null;
  return (
    <section
      aria-label="What to do now"
      className="border-border bg-surface flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-4 py-3 text-sm"
    >
      <Compass aria-hidden size={18} className="text-accent-text shrink-0" />
      <p className="min-w-0 flex-1">
        <span className="text-muted">Now: </span>
        <span className="font-medium">{next.title}</span>
        <span className="text-muted block">{next.why}</span>
      </p>
      {next.focus && isEnabled('focus') && (
        <Link
          to="/focus"
          className="text-accent-text inline-flex min-h-11 items-center gap-1 font-medium"
        >
          <Timer aria-hidden size={16} /> Focus
        </Link>
      )}
    </section>
  );
}
