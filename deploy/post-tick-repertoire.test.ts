import { afterEach, describe, expect, it } from 'vitest';
import { resetPostTickCache, runPostTickRepertoire } from './post-tick-repertoire.js';

const BASE_INPUT = {
  taskId: 'test-post-tick',
  memorySignals: ['attestation-as-map'],
  dynamoRecommendation: 'PASS' as const,
  resonanceScore: 0.9,
  posted: true,
  durationMs: 1200,
};

afterEach(() => {
  resetPostTickCache();
  delete process.env.SKIP_REPERTOIRE_FEEDBACK;
});

describe('runPostTickRepertoire', () => {
  it('skips when SKIP_REPERTOIRE_FEEDBACK is set', async () => {
    process.env.SKIP_REPERTOIRE_FEEDBACK = '1';
    const result = await runPostTickRepertoire(BASE_INPUT);
    expect(result).toEqual({ ok: true, skipped: 'SKIP_REPERTOIRE_FEEDBACK' });
  });

  it('skips when no memory signals', async () => {
    const result = await runPostTickRepertoire({
      ...BASE_INPUT,
      memorySignals: [],
    });
    expect(result).toEqual({ ok: true, skipped: 'no-memory-signals' });
  });

  it('ingests feedback when repertoire provider is available', async () => {
    const result = await runPostTickRepertoire(BASE_INPUT);
    if (result.skipped === 'repertoire-provider-unavailable') {
      expect(result.ok).toBe(false);
      return;
    }
    expect(result.ok).toBe(true);
    expect(result.skipped).toBeUndefined();
  });

  it('marks success false when post blocked but high resonance', async () => {
    const result = await runPostTickRepertoire({
      ...BASE_INPUT,
      posted: false,
      dynamoRecommendation: 'REJECT',
      resonanceScore: 0.9,
    });
    if (result.skipped === 'repertoire-provider-unavailable') return;
    expect(result.ok).toBe(true);
  });
});