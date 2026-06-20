import { describe, expect, it, vi, beforeEach } from 'vitest';

const execFileSync = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  execFileSync,
}));

describe('runHermesInferenceDetailed', () => {
  beforeEach(() => {
    execFileSync.mockReset();
  });

  it('returns ok on first successful attempt', async () => {
    execFileSync.mockReturnValue('INFERENCE: ok\nPUBLIC REPLY: hi');
    const { runHermesInferenceDetailed } = await import('./hermes-runner.js');
    const result = runHermesInferenceDetailed('prompt', { maxRetries: 1, timeoutMs: 1000 });
    expect(result.finalStatus).toBe('ok');
    expect(result.output).toContain('INFERENCE');
    expect(result.attempts).toBe(1);
  });

  it('returns null after timeout with structured status', async () => {
    const err = new Error('ETIMEDOUT') as NodeJS.ErrnoException;
    err.code = 'ETIMEDOUT';
    execFileSync.mockImplementation(() => {
      throw err;
    });
    const { runHermesInferenceDetailed } = await import('./hermes-runner.js');
    const result = runHermesInferenceDetailed('prompt', { maxRetries: 0, timeoutMs: 1000 });
    expect(result.output).toBeNull();
    expect(result.finalStatus).toBe('timeout');
    expect(result.attempts).toBe(1);
  });
});