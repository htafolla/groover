import { describe, expect, it } from 'vitest';
import {
  HERMES_TIMEOUT_MS,
  MAX_HERMES_CALLS_PER_RUN,
  REPERTOIRE_SKIP_CONFIDENCE_THRESHOLD,
} from './engage-config.js';

describe('engage-config defaults', () => {
  it('uses cron-safe hermes budget defaults', () => {
    expect(MAX_HERMES_CALLS_PER_RUN).toBeGreaterThan(0);
    expect(HERMES_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
    expect(REPERTOIRE_SKIP_CONFIDENCE_THRESHOLD).toBeGreaterThan(0);
    expect(REPERTOIRE_SKIP_CONFIDENCE_THRESHOLD).toBeLessThan(1);
  });
});