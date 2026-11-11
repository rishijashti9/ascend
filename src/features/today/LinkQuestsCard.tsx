import { useState } from 'react';
import type { LinkSuggestion } from '@/core/planner/links';
import { useGoals } from '@/core/state/goals';
import { Button } from '@/ui/Button';
import { Select } from '@/ui/Field';
import { useAction } from '@/ui/hooks/useAction';
import { loadLinkSnooze, useLinkCard } from './linkCard';

/**
 * "Link your daily quests" (linking plan L2, docs/product/LINKING-PLAN.md): one System suggestion
 * that links unlinked daily quests to the main quests they serve, so each shows "For: …" and the
 * next-action pick can use the goal's deadline. Every link is shown with its reason and can be
 * changed before accepting; applying goes through the plan path (Plan history + Undo).
 */

export function LinkQuestsCard() {
  const { suggestions, applied } = useLinkCard();
  const mainQuests = useGoals((s) => s.mainQuests).filter(
    (q) => q.status === 'active' && !q.deleted_at,
  );
  const { run, busy, error } = useAction();
  const rows = suggestions.filter((s) => s.mainQuestId !== null);
  const others = suggestions.length - rows.length;
  const [choice, setChoice] = useState<Record<string, string>>({});
  const chosen = (s: LinkSuggestion) => choice[s.habitId] ?? s.mainQuestId ?? '';
  const title = (id: string) => mainQuests.find((q) => q.id === id)?.title ?? '';

  if (applied) {
    return (
      <section
        aria-label="Suggestion"
        className="panel flex flex-wrap items-center gap-2 px-4 py-3 text-sm"
      >
        <span className="flex-1">{applied.summary}</span>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => void run({ type: 'plan.undo', payload: { id: applied.id } })}
        >
          Undo
        </Button>
        {error && (
          <p role="alert" className="text-warning-text w-full">
            {error}
          </p>
        )}
      </section>
    );
  }

  const picked = rows
    .map((s) => ({ habitId: s.habitId, title: s.title, mainQuestId: chosen(s) }))
    .filter((l) => l.mainQuestId !== '');
  const hideFor = async (forever: boolean) => {
    if (await run({ type: 'links.snooze', payload: { forever } })) await loadLinkSnooze();
  };

  return (
    <section aria-label="Link your daily quests" className="panel flex flex-col gap-3 p-4 text-sm">
      <p>
        Link your daily quests to the main quests they serve — then each one shows what it’s for,
        and the System can weigh its deadline when it picks your next action.
      </p>
      <ul className="flex flex-col gap-3">
        {rows.map((s) => (
          <li key={s.habitId} className="flex flex-col gap-1">
            <Select
              label={s.title}
              value={chosen(s)}
              options={[
                { value: '', label: 'No link' },
                ...mainQuests.map((q) => ({ value: q.id, label: q.title })),
              ]}
              onChange={(e) => setChoice({ ...choice, [s.habitId]: e.target.value })}
            />
            <span className="text-muted text-xs">
              Suggested because it {s.why}
              {s.alsoFits.length > 0 &&
                ` · also fits: ${s.alsoFits.map(title).filter(Boolean).join(', ')}`}
            </span>
          </li>
        ))}
      </ul>
      {others > 0 && (
        <p className="text-muted text-xs">
          {others} other daily quest{others === 1 ? '' : 's'} match no main quest — they still count
          for their stat. You can link any quest yourself in Quests.
        </p>
      )}
      {error && (
        <p role="alert" className="text-warning-text">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || picked.length === 0}
          onClick={() =>
            void run({ type: 'links.apply', payload: { links: picked } }).then(
              // Applying also hides the card for a week (so a link you set to "No link" doesn't
              // come straight back); refresh this device's view of that.
              async (ok) => {
                if (ok) await loadLinkSnooze();
              },
            )
          }
        >
          Link {picked.length === 1 ? 'this' : 'these'}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => void hideFor(false)}>
          Not now
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => void hideFor(true)}>
          Don’t ask again
        </Button>
      </div>
    </section>
  );
}
