import { describe, expect, it } from 'vitest';
import {
  buildRepertoireConsultDescription,
  shouldForceGovernanceWithRepertoire,
  type RepertoireConsultResult,
} from './repertoire-confidence.js';

function makeResult(overrides: Partial<RepertoireConsultResult> = {}): RepertoireConsultResult {
  return {
    consulted: true,
    providerAvailable: true,
    highConfidenceTrapPresent: false,
    ontologicalTrapDetected: false,
    recommendedAgent: null,
    matchedSignals: [],
    avgConfidence: 0,
    maxConfidence: 0,
    complexityBoost: 0,
    promptBlock: '',
    ...overrides,
  };
}

describe('buildRepertoireConsultDescription', () => {
  it('labels post and comment for signal matching', () => {
    const description = buildRepertoireConsultDescription({
      postTitle: 'Attestation maps',
      commentContent: 'consumer-boundary revalidation',
    });
    expect(description).toContain('Post title: Attestation maps');
    expect(description).toContain('Comment: consumer-boundary revalidation');
  });
});

describe('shouldForceGovernanceWithRepertoire', () => {
  it('forces when Repertoire reports high-confidence trap', () => {
    const repertoire = makeResult({ highConfidenceTrapPresent: true });
    expect(shouldForceGovernanceWithRepertoire('TYPE: theoretical', repertoire)).toBe(true);
  });

  it('forces for ontological-trap inference text', () => {
    const repertoire = makeResult();
    expect(
      shouldForceGovernanceWithRepertoire('TYPE: ontological-trap\nclosure primitive', repertoire),
    ).toBe(true);
  });

  it('does not force for low-signal theoretical inference', () => {
    const repertoire = makeResult();
    expect(shouldForceGovernanceWithRepertoire('TYPE: theoretical', repertoire)).toBe(false);
  });
});