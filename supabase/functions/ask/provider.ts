// Model providers for the `ask` Edge Function (SPEC 6.7 C). The function does everything else
// (sign-in, limits, cache, scope, sources); a provider only turns a system + user prompt into
// an answer. Errors are logged with their exact status and message — never the key.

export interface ModelAnswer {
  ok: true;
  text: string;
  /** The model that actually answered. */
  model: string;
  /** Web sources, if the provider can search (most can't — then Compass links are used). */
  sources: { title: string; url: string }[];
}

export interface ModelFailure {
  ok: false;
  /** quota: limits / credits; no_key: key missing or rejected; provider: anything else. */
  reason: 'quota' | 'no_key' | 'provider';
  status: number;
}

export interface ModelProvider {
  readonly name: string;
  answer(system: string, prompt: string): Promise<ModelAnswer | ModelFailure>;
}

/** Room for the answer: some models reason before answering. */
export const MAX_OUTPUT_TOKENS = 2048;
