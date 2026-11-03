import type { SupabaseClient } from '@supabase/supabase-js';
import { askFunctionProvider as geminiProvider, ASK_SERVICE } from './provider';

const client = (result: { data?: unknown; error?: unknown }) =>
  ({ functions: { invoke: vi.fn().mockResolvedValue(result) } }) as unknown as SupabaseClient;
const req = { question: 'How do I learn ROS 2?', context: {}, hints: [] };

describe('Ask the System provider (the ask Edge Function)', () => {
  it('is OpenRouter now', () => {
    expect(ASK_SERVICE.id).toBe('openrouter');
  });

  it('returns the answer, keeping only https sources and at most 3 quests', async () => {
    const r = await geminiProvider(
      client({
        data: {
          text: 'Start with the tutorials.',
          quests: ['a', 'b', 'c', 'd'],
          sources: [
            { title: 'ROS', url: 'https://docs.ros.org' },
            { title: 'x', url: 'http://bad' },
          ],
          cached: false,
          model: 'google/gemma-4-31b-it:free',
        },
      }),
    ).ask(req);
    expect(r).toMatchObject({
      ok: true,
      answer: { quests: ['a', 'b', 'c'], sources: [{ title: 'ROS' }] },
    });
  });

  it('turns every failure into a calm reason, never an exception', async () => {
    const httpError = (code: string) => ({
      error: Object.assign(new Error('x'), { context: { json: async () => ({ error: code }) } }),
    });
    for (const code of ['quota', 'no_key', 'signed_out', 'off_topic'] as const) {
      expect(await geminiProvider(client(httpError(code))).ask(req)).toEqual({
        ok: false,
        reason: code,
      });
    }
    expect(await geminiProvider(client({ data: { error: 'off_topic' } })).ask(req)).toEqual({
      ok: false,
      reason: 'off_topic',
    });
    const throwing = {
      functions: { invoke: vi.fn().mockRejectedValue(new Error('Failed to fetch')) },
    } as unknown as SupabaseClient;
    expect(await geminiProvider(throwing).ask(req)).toEqual({ ok: false, reason: 'offline' });
    expect(await geminiProvider(client({ data: { text: '' } })).ask(req)).toEqual({
      ok: false,
      reason: 'error',
    });
  });
});
