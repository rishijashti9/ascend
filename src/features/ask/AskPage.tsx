import { ExternalLink, Phone, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { askTheSystem, type AskOutcome } from '@/core/ask/ask';
import type { PlanProposal } from '@/core/db/types';
import { useAppState } from '@/core/state/app';
import { useGoals } from '@/core/state/goals';
import { useToday } from '@/core/state/today';
import { weekStartOf } from '@/core/time';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { Robot } from '@/ui/Robot';
import { useAskDeps } from './useAskDeps';

/**
 * Ask the System (SPEC 6.7 C): career and health/growth questions in your own words. Scope-
 * locked, safety rules first, sources always shown; answers can become weekly quests after
 * approval. When it can't answer, the Growth Compass does — never an error screen.
 */
export function AskPanel({
  suggestions = [],
  note,
  autoFocus = false,
}: {
  /** Questions that fit the screen you came from (one tap asks). */
  suggestions?: readonly string[];
  /** An extra line for this screen (e.g. on Body: general health answers only). */
  note?: string;
  autoFocus?: boolean;
}) {
  const enabled = useAppState((s) => s.settings?.ai_enabled ?? false);
  const weekStartsOn = useAppState((s) => s.settings?.week_start ?? 1);
  const today = useToday((s) => s.day);
  const allMainQuests = useGoals((s) => s.mainQuests);
  const mainQuests = allMainQuests.filter((q) => q.status === 'active');
  const [question, setQuestion] = useState('');
  const [outcome, setOutcome] = useState<AskOutcome | null>(null);
  const [asking, setAsking] = useState(false);
  const [goal, setGoal] = useState('');
  const getDeps = useAskDeps();
  const { run, runFor, busy, error } = useAction();
  const navigate = useNavigate();

  const ask = async (q = question) => {
    setAsking(true);
    setOutcome(await askTheSystem(q.trim(), await getDeps()));
    setAsking(false);
  };

  const addQuests = async (titles: string[]) => {
    const goalId = goal || mainQuests[0]?.id;
    if (!goalId || !today) return;
    const proposal = await runFor<PlanProposal>({
      type: 'plan.propose',
      payload: {
        goal_type: 'main_quest',
        goal_id: goalId,
        trigger: 'ask',
        summary: `From Ask the System: ${titles.length} weekly quest${titles.length === 1 ? '' : 's'}.`,
        items: titles.map((title, i) => ({
          id: `a${i + 1}`,
          kind: 'quest.create',
          selected: true,
          reason: `Suggested by Ask the System for “${question.trim().slice(0, 80)}”.`,
          data: {
            type: 'weekly',
            title,
            stat: 'INT',
            difficulty: 'normal',
            week_start: weekStartOf(today, weekStartsOn),
            linked_goal_type: 'main_quest',
            linked_goal_id: goalId,
            carried_over_from: null,
          },
        })),
      },
    });
    if (proposal) navigate(`/growth/goals/${goalId}`);
  };

  return (
    <div className="flex flex-col gap-4">
      {note && <p className="text-muted text-sm">{note}</p>}
      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-muted text-xs font-semibold tracking-wide uppercase">
            Suggested
          </span>
          <div className="flex flex-col gap-2">
            {suggestions.map((q) => (
              <button
                key={q}
                type="button"
                disabled={asking}
                onClick={() => {
                  setQuestion(q);
                  void ask(q);
                }}
                className="inset min-h-11 px-4 py-2 text-left text-sm font-medium disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {!enabled && (
        <section aria-label="Switched off" className="panel flex flex-col gap-2 p-4 text-sm">
          <p>
            Ask the System is off. Until you switch it on, the Growth Compass answers from trusted
            sources on this device.
          </p>
          <Button
            variant="secondary"
            className="self-start"
            disabled={busy}
            onClick={() => void run({ type: 'settings.update', payload: { ai_enabled: true } })}
          >
            Switch it on
          </Button>
        </section>
      )}

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim().length >= 3) void ask();
        }}
      >
        <label htmlFor="ask-q" className="text-sm font-medium">
          Your question
        </label>
        <textarea
          id="ask-q"
          maxLength={500}
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          autoFocus={autoFocus}
          placeholder="e.g. What should I learn after ROS 2 basics to work on humanoid robots?"
          className="control px-3 py-2 text-base"
        />
        <Button
          type="submit"
          className="self-start"
          disabled={asking || question.trim().length < 3}
        >
          {asking ? 'Thinking…' : 'Ask'}
        </Button>
        <p className="text-muted text-xs">
          Questions go to a free AI model through OpenRouter; free models’ providers may use them to
          improve their services. Only your question and progress numbers are sent — never health
          data, journal text, mood or photos. Your question is sent as you type it, so leave out
          names and personal health details. The model can’t browse the web, so check deadlines,
          fees and requirements on the official sites.
        </p>
      </form>

      {outcome?.kind === 'answer' && (
        <section aria-label="Answer" className="panel flex flex-col gap-3 p-4">
          <p className="whitespace-pre-line">{outcome.answer.text}</p>
          {outcome.answer.sources.length > 0 && (
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-muted">Sources</span>
              {outcome.answer.sources.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-text inline-flex min-h-11 items-center gap-1"
                >
                  {s.title} <ExternalLink aria-hidden size={14} />
                </a>
              ))}
            </div>
          )}
          {outcome.answer.quests.length > 0 && (
            <div className="flex flex-col gap-2 text-sm">
              <span className="text-muted">Suggested weekly quests</span>
              <ul className="list-disc pl-5">
                {outcome.answer.quests.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
              {mainQuests.length > 0 ? (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-muted">For the goal</span>
                    <select
                      className="control min-h-11 px-3"
                      value={goal || mainQuests[0]?.id}
                      onChange={(e) => setGoal(e.target.value)}
                    >
                      {mainQuests.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void addQuests(outcome.answer.quests)}
                  >
                    <Sparkles aria-hidden size={16} /> Add as weekly quests
                  </Button>
                </div>
              ) : (
                <p className="text-muted">Create a goal first to turn these into quests.</p>
              )}
              <p className="text-muted text-xs">
                You’ll review them first — nothing is added until you approve, and it can be undone.
              </p>
            </div>
          )}
          <p className="text-muted text-xs">
            {outcome.answer.cached ? 'Answered earlier — from the cache. ' : ''}AI answers can be
            wrong; check important facts with the sources.
          </p>
        </section>
      )}

      {outcome?.kind === 'declined' && (
        <p role="status" className="panel p-4 text-sm">
          {outcome.text}
        </p>
      )}

      {outcome?.kind === 'safety' && (
        <section aria-label="Please read" className="panel flex flex-col gap-2 p-4 text-sm">
          <p className="text-warning-text font-semibold">Please read</p>
          <p>{outcome.text}</p>
          {outcome.helpline?.phones.map((p) => (
            <a
              key={p}
              href={`tel:${p.replace(/[^0-9+]/g, '')}`}
              className="text-accent-text inline-flex min-h-11 items-center gap-2 font-medium"
            >
              <Phone aria-hidden size={16} /> Call {outcome.helpline?.name}: {p}
            </a>
          ))}
        </section>
      )}

      {outcome?.kind === 'fallback' && (
        <section aria-label="Growth Compass" className="panel flex flex-col gap-2 p-4 text-sm">
          <p>{outcome.text}</p>
          {outcome.compass.length === 0 ? (
            <Link
              to="/growth/compass"
              className="text-accent-text inline-flex min-h-11 items-center"
            >
              Open the Growth Compass →
            </Link>
          ) : (
            <ul className="flex flex-col gap-2">
              {outcome.compass.map((c) => (
                <li key={c.title}>
                  <Link to={c.path} className="text-accent-text font-medium">
                    {c.title}
                  </Link>
                  <p className="text-muted">{c.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

/** Ask the System as a page (the full view; the floating button opens the same panel in a sheet). */
export function AskPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="display flex items-center gap-3 text-2xl">
          <Robot size={40} /> Ask the System
        </h1>
        <p className="text-muted text-sm">
          Career and health questions only — skills, studying, career paths, training, sleep,
          recovery, food basics and wellbeing.
        </p>
      </header>
      <AskPanel />
    </div>
  );
}
