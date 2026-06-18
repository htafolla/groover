import { execFileSync } from 'node:child_process';

const DEFAULT_PROVIDER = 'xai-oauth';
const DEFAULT_MODEL = 'grok-4.3';
const DEFAULT_TIMEOUT_MS = 120_000;

/** Run Hermes one-shot inference without shell interpolation (safe for multiline prompts). */
export function runHermesInference(
  prompt: string,
  options: { provider?: string; model?: string; timeoutMs?: number } = {},
): string {
  const provider = options.provider ?? process.env.HERMES_PROVIDER ?? DEFAULT_PROVIDER;
  const model = options.model ?? process.env.HERMES_MODEL ?? DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return execFileSync(
    'hermes',
    ['-z', prompt, '--provider', provider, '--model', model],
    { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 },
  ).trim();
}