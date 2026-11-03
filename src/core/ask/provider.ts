import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Ask the System (SPEC 6.7 C) through a provider-agnostic interface, so another model (e.g.
 * Claude) can be added later without touching the screen. Today: free models through OpenRouter
 * (since 2026-11-04; Google Gemini before) via
 * the Supabase Edge Function `ask`, which holds the key.
 */
export interface AskContext {
  /** Allow-listed numbers only — see context.ts. Never health data, journal, mood or photos. */
  [key: string]: number | string | (number | string)[] | Record<string, number | string>;
}

export interface AskRequest {
  question: string;
  context: AskContext;
  /** Growth Compass guidance the answer may build on (titles + official links). */
  hints: { title: string; url: string }[];
}

export interface AskAnswer {
  text: string;
  /** Up to 3 suggested weekly quests (only added after approval). */
  quests: string[];
  sources: { title: string; url: string }[];
  cached: boolean;
  model: string;
}

export type AskFailure = 'quota' | 'offline' | 'signed_out' | 'no_key' | 'off_topic' | 'error';

export type AskResult = { ok: true; answer: AskAnswer } | { ok: false; reason: AskFailure };

export interface AIProvider {
  readonly name: string;
  ask(request: AskRequest): Promise<AskResult>;
}

const REASONS = new Set<AskFailure>(['quota', 'signed_out', 'no_key', 'off_topic']);

/** The model behind the `ask` Edge Function, chosen there (see supabase/functions/ask). */
export const ASK_SERVICE = { id: 'openrouter', label: 'OpenRouter (free AI models)' } as const;

/** Ask through the `ask` Edge Function. Never throws — failures become calm reasons. */
export function askFunctionProvider(
  client: SupabaseClient,
  name: string = ASK_SERVICE.label,
): AIProvider {
  return {
    name,
    async ask(request) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false)
        return { ok: false, reason: 'offline' };
      try {
        const { data, error } = await client.functions.invoke('ask', { body: request });
        if (error) {
          // FunctionsHttpError carries the response; read our { error } code from it.
          const ctx = (error as { context?: Response }).context;
          const body =
            ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
          const code = (body as { error?: string } | null)?.error as AskFailure | undefined;
          if (code && REASONS.has(code)) return { ok: false, reason: code };
          if (/fetch|network/i.test(String((error as Error).message)))
            return { ok: false, reason: 'offline' };
          return { ok: false, reason: 'error' };
        }
        const d = data as Partial<AskAnswer> & { error?: string };
        if (d.error)
          return {
            ok: false,
            reason: REASONS.has(d.error as AskFailure) ? (d.error as AskFailure) : 'error',
          };
        if (typeof d.text !== 'string' || d.text.length === 0)
          return { ok: false, reason: 'error' };
        return {
          ok: true,
          answer: {
            text: d.text,
            quests: Array.isArray(d.quests)
              ? d.quests.filter((q) => typeof q === 'string').slice(0, 3)
              : [],
            sources: Array.isArray(d.sources)
              ? d.sources.filter(
                  (s) => s && typeof s.url === 'string' && s.url.startsWith('https://'),
                )
              : [],
            cached: d.cached === true,
            model: typeof d.model === 'string' ? d.model : 'unknown',
          },
        };
      } catch {
        return { ok: false, reason: 'offline' };
      }
    },
  };
}

/** Kept for reference: the same Edge Function when it ran Google Gemini (unused since 2026-11-04). */
export const geminiProvider = (client: SupabaseClient): AIProvider =>
  askFunctionProvider(client, 'Google Gemini (free tier)');
