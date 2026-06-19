import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_PROVIDER = 'xai-oauth';
const DEFAULT_MODEL = 'grok-4.3';
const DEFAULT_TIMEOUT_MS = 90_000;

export function resolveHermesBin(): string {
  const explicit = process.env.HERMES_BIN?.trim();
  if (explicit) return explicit;
  return 'hermes';
}

export function runHermesInference(
  prompt: string,
  options: { provider?: string; model?: string; timeoutMs?: number } = {},
): string | null {
  const provider = options.provider ?? process.env.HERMES_PROVIDER ?? DEFAULT_PROVIDER;
  const model = options.model ?? process.env.HERMES_MODEL ?? DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const tmpFile = join(tmpdir(), `hermes-prompt-${Date.now()}.txt`);
  writeFileSync(tmpFile, prompt);

  try {
    const result = execFileSync(
      resolveHermesBin(),
      ['-z', `@${tmpFile}`, '--provider', provider, '--model', model],
      {
        encoding: 'utf8',
        timeout: timeoutMs,
        maxBuffer: 8 * 1024 * 1024,
      },
    ).trim();
    return result;
  } catch (err: any) {
    console.error(`[Hermes] call failed: ${err.message}`);
    return null;
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}
