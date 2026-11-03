import { pack } from '@/core/compass/pack';
import { safetyReply, type SafetyReply } from '@/core/compass/safety';
import { classifyScope, OFF_TOPIC_REPLY } from '@/core/compass/scope';
import type { Helpline } from '@/data/compass/schema';
import type { AIProvider, AskAnswer, AskContext, AskFailure } from './provider';

/**
 * One question through Ask the System (SPEC 6.7 C), in this order:
 * 1. local scope check — off-topic is declined before anything is sent (costs no quota);
 * 2. health safety — crisis / medical / extreme questions get the fixed safe reply locally;
 * 3. switched off, signed out, or today's limit reached → the Growth Compass answers instead;
 * 4. the provider; any failure (quota, offline, no key, error) → a calm Compass fallback.
 * Never an error screen.
 */
export type AskOutcome =
  | { kind: 'answer'; answer: AskAnswer }
  | { kind: 'declined'; text: string }
  | { kind: 'safety'; text: string; helpline: Helpline | null; reply: SafetyReply['kind'] }
  | {
      kind: 'fallback';
      reason: AskFailure | 'off' | 'limit';
      text: string;
      compass: CompassHint[];
    };

export interface CompassHint {
  title: string;
  detail: string;
  url: string;
  /** Where it lives in the app, e.g. "/compass" or "/compass?tab=health". */
  path: string;
}

/** Default questions per day on this device (the server caps at 20). */
export const DEFAULT_DAILY_LIMIT = 10;

const FALLBACK_TEXT: Record<AskFailure | 'off' | 'limit', string> = {
  off: 'Ask the System is switched off in Settings. Here’s what the Growth Compass has on this:',
  limit: 'That’s today’s questions used up — try again tomorrow. Meanwhile, the Growth Compass:',
  quota: 'The free AI quota is used up for now. Try again later — meanwhile, the Growth Compass:',
  offline:
    'You’re offline. Try again later — meanwhile, the Growth Compass works without internet:',
  signed_out: 'Ask the System needs your sync account. Meanwhile, the Growth Compass:',
  no_key: 'Ask the System isn’t set up yet. Meanwhile, the Growth Compass:',
  off_topic: OFF_TOPIC_REPLY,
  error: 'The System couldn’t answer just now. Try again later — meanwhile, the Growth Compass:',
};

const STOP = new Set(
  'how what when where which who why the and for you your with that this from much many need does should can could would about into more less have get make take want'.split(
    ' ',
  ),
);
const words = (s: string) =>
  new Set((s.toLowerCase().match(/[a-z0-9+]{3,}/g) ?? []).filter((w) => !STOP.has(w)));

/** Growth Compass entries that match the question's words (roadmaps, guidelines, careers). */
export function compassHints(question: string, limit = 3): CompassHint[] {
  const q = words(question);
  const score = (text: string) => [...words(text)].filter((w) => q.has(w)).length;
  const p = pack();
  const items: (CompassHint & { score: number })[] = [
    ...p.roadmaps.map((r) => ({
      title: r.title,
      detail: r.summary,
      url: p.sources.find((s) => s.id === r.sources[0])?.url ?? 'https://www.onetonline.org/',
      path: '/compass',
      score: 2 * score(r.title) + score(r.summary),
    })),
    ...p.guidelines.map((g) => ({
      title: g.title,
      detail: g.text,
      url: p.sources.find((s) => s.id === g.sources[0])?.url ?? 'https://www.who.int/',
      path: '/compass?tab=health',
      score: 2 * score(`${g.title} ${g.topic}`) + score(g.text),
    })),
    ...p.careers.map((c) => ({
      title: c.title,
      detail: c.summary,
      url: c.onet
        ? `https://www.onetonline.org/link/summary/${c.onet}`
        : 'https://www.onetonline.org/',
      path: '/compass',
      score: (2 * score(c.title) + score(c.summary)) * 0.8,
    })),
  ];
  return items
    .filter((i) => i.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _score, ...h }) => h); // eslint-disable-line @typescript-eslint/no-unused-vars
}

export interface AskDeps {
  enabled: boolean;
  provider: AIProvider | null;
  context: AskContext;
  country: string | null;
  /** Questions already sent today on this device, and the limit. */
  usedToday: number;
  dailyLimit: number;
  /** Logs one outgoing request (when, where, how much — never the content). */
  logOutbound: (chars: number) => Promise<void>;
}

export async function askTheSystem(question: string, deps: AskDeps): Promise<AskOutcome> {
  const scope = classifyScope(question);
  const safety = safetyReply(scope, deps.country);
  if (safety)
    return { kind: 'safety', text: safety.text, helpline: safety.helpline, reply: safety.kind };
  if (scope.scope === 'off_topic') return { kind: 'declined', text: OFF_TOPIC_REPLY };
  const fallback = (reason: AskFailure | 'off' | 'limit'): AskOutcome =>
    reason === 'off_topic'
      ? { kind: 'declined', text: OFF_TOPIC_REPLY }
      : { kind: 'fallback', reason, text: FALLBACK_TEXT[reason], compass: compassHints(question) };
  if (!deps.enabled) return fallback('off');
  if (!deps.provider) return fallback('signed_out');
  if (deps.usedToday >= deps.dailyLimit) return fallback('limit');
  const hints = compassHints(question).map((h) => ({ title: h.title, url: h.url }));
  await deps.logOutbound(
    question.length + JSON.stringify(deps.context).length + JSON.stringify(hints).length,
  );
  const result = await deps.provider.ask({ question, context: deps.context, hints });
  return result.ok ? { kind: 'answer', answer: result.answer } : fallback(result.reason);
}
