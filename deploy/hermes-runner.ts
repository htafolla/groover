import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HERMES_MAX_RETRIES, HERMES_TIMEOUT_MS } from './engage-config.js';

const DEFAULT_PROVIDER = 'xai-oauth';
const DEFAULT_MODEL = 'grok-4.3';

export type HermesFinalStatus = 'ok' | 'timeout' | 'error';

export interface HermesInferenceResult {
  output: string | null;
  attempts: number;
  finalStatus: HermesFinalStatus;
  durationMs: number;
  errorClass?: string;
}

export function resolveHermesBin(): string {
  const explicit = process.env.HERMES_BIN?.trim();
  if (explicit) return explicit;
  return 'hermes';
}

function classifyHermesError(err: unknown): { status: HermesFinalStatus; errorClass: string } {
  const message = err instanceof Error ? err.message : String(err);
  const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
  if (
    code === 'ETIMEDOUT' ||
    message.includes('ETIMEDOUT') ||
    message.includes('timed out') ||
    message.includes('SIGTERM')
  ) {
    return { status: 'timeout', errorClass: 'timeout' };
  }
  if (message.includes('124')) {
    return { status: 'timeout', errorClass: 'exit-124' };
  }
  return { status: 'error', errorClass: code || 'exec-failed' };
}

function isRetriable(status: HermesFinalStatus, errorClass: string): boolean {
  if (status !== 'timeout') return false;
  return errorClass === 'timeout' || errorClass === 'exit-124';
}

function invokeOnce(
  prompt: string,
  options: { provider?: string; model?: string; timeoutMs?: number },
): { output: string | null; status: HermesFinalStatus; errorClass?: string; durationMs: number } {
  const provider = options.provider ?? process.env.HERMES_PROVIDER ?? DEFAULT_PROVIDER;
  const model = options.model ?? process.env.HERMES_MODEL ?? DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? HERMES_TIMEOUT_MS;

  const tmpFile = join(tmpdir(), `hermes-prompt-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  writeFileSync(tmpFile, prompt);
  const started = Date.now();

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
    return { output: result, status: 'ok', durationMs: Date.now() - started };
  } catch (err: unknown) {
    const { status, errorClass } = classifyHermesError(err);
    return { output: null, status, errorClass, durationMs: Date.now() - started };
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
  }
}

export function runHermesInferenceDetailed(
  prompt: string,
  options: { provider?: string; model?: string; timeoutMs?: number; maxRetries?: number } = {},
): HermesInferenceResult {
  const maxRetries = options.maxRetries ?? HERMES_MAX_RETRIES;
  const started = Date.now();
  let attempts = 0;
  let last: ReturnType<typeof invokeOnce> | null = null;

  while (attempts <= maxRetries) {
    attempts += 1;
    last = invokeOnce(prompt, options);
    if (last.status === 'ok' && last.output) {
      const result: HermesInferenceResult = {
        output: last.output,
        attempts,
        finalStatus: 'ok',
        durationMs: Date.now() - started,
      };
      logHermesResult(result);
      return result;
    }
    if (attempts > maxRetries || !isRetriable(last.status, last.errorClass ?? '')) {
      break;
    }
  }

  const result: HermesInferenceResult = {
    output: null,
    attempts,
    finalStatus: last?.status ?? 'error',
    durationMs: Date.now() - started,
    errorClass: last?.errorClass,
  };
  logHermesResult(result);
  return result;
}

function logHermesResult(result: HermesInferenceResult): void {
  process.stderr.write(
    `[Hermes] ${JSON.stringify({
      final_status: result.finalStatus,
      attempts: result.attempts,
      duration_ms: result.durationMs,
      error_class: result.errorClass ?? null,
      ok: result.output !== null,
    })}\n`,
  );
}

export function runHermesInference(
  prompt: string,
  options: { provider?: string; model?: string; timeoutMs?: number } = {},
): string | null {
  return runHermesInferenceDetailed(prompt, options).output;
}