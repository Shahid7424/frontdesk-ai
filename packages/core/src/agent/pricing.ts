/**
 * USD per million tokens, Claude API list prices (checked 2026-10-24).
 * Haiku 5.5 rates are for prompts up to 100K tokens; ours are ~3K.
 * Cache reads cost 0.1x input, 5-minute cache writes 1.25x input.
 */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
};

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

export const emptyUsage = (): Usage => ({
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
});

export function addUsage(total: Usage, u: Partial<Record<keyof Usage, number | null>>): Usage {
  return {
    input_tokens: total.input_tokens + (u.input_tokens ?? 0),
    output_tokens: total.output_tokens + (u.output_tokens ?? 0),
    cache_creation_input_tokens: total.cache_creation_input_tokens + (u.cache_creation_input_tokens ?? 0),
    cache_read_input_tokens: total.cache_read_input_tokens + (u.cache_read_input_tokens ?? 0),
  };
}

export function costUsd(model: string, u: Usage): number {
  const p = PRICES[model];
  if (!p) return 0;
  const usd =
    (u.input_tokens * p.input +
      u.cache_creation_input_tokens * p.input * 1.25 +
      u.cache_read_input_tokens * p.input * 0.1 +
      u.output_tokens * p.output) /
    1_000_000;
  return Math.round(usd * 1e6) / 1e6;
}
