import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  isOntologicalTrap,
  matchPrimitivesFromInference,
  matchedPrimitiveNames,
  resetGovernanceHelperState,
  setCuratedSignalsForTesting,
  shouldForceGovernance,
  formatDynamoLog,
  buildInferenceLogEntry,
} from './governance-helper.js';

const TEST_SIGNALS = [
  {
    name: 'attestation-as-map',
    tags: ['ontological-trap', 'attestation', 'consumer-boundary'],
    evaluation_criteria: 'Attestation is directional rather than final.',
  },
  {
    name: 'parse-mutation-detector',
    tags: ['ontological-trap', 'parser'],
    evaluation_criteria: 'Detects parse transformations.',
  },
  {
    name: 'low-signal-tag',
    tags: ['tdf'],
    evaluation_criteria: 'Short tag should not match loosely.',
  },
];

afterEach(() => {
  resetGovernanceHelperState();
});

describe('isOntologicalTrap', () => {
  it('detects ontological-trap classification', () => {
    expect(isOntologicalTrap('TYPE: ontological-trap')).toBe(true);
    expect(isOntologicalTrap('TYPE:ONTOLOGICAL-TRAP')).toBe(true);
  });

  it('returns false for other inference types', () => {
    expect(isOntologicalTrap('TYPE: theoretical')).toBe(false);
    expect(isOntologicalTrap('no type marker here')).toBe(false);
  });
});

describe('shouldForceGovernance', () => {
  it('forces governance for ontological-trap inferences', () => {
    expect(shouldForceGovernance('TYPE: ontological-trap')).toBe(true);
    expect(shouldForceGovernance('TYPE: practical-workflow')).toBe(false);
  });
});

describe('matchPrimitivesFromInference', () => {
  beforeEach(() => {
    setCuratedSignalsForTesting(TEST_SIGNALS);
  });

  it('matches signal names with word boundaries', () => {
    const matches = matchPrimitivesFromInference(
      'INFERENCE: attestation-as-map requires consumer-side checks.',
    );
    expect(matches.map((m) => m.name)).toContain('attestation-as-map');
    expect(matches.find((m) => m.name === 'attestation-as-map')?.confidence).toBeGreaterThan(0.8);
  });

  it('does not match short tags without strong token boundaries', () => {
    const names = matchedPrimitiveNames(
      'INFERENCE: this mentions tdf drift in passing only.',
    );
    expect(names).not.toContain('low-signal-tag');
  });

  it('auto-includes ontological-trap signals when TYPE is ontological-trap', () => {
    const names = matchedPrimitiveNames('TYPE: ontological-trap\nNo explicit primitive names.');
    expect(names).toContain('attestation-as-map');
    expect(names).toContain('parse-mutation-detector');
  });

  it('sorts matches by confidence descending', () => {
    const matches = matchPrimitivesFromInference(
      'TYPE: ontological-trap\nparse-mutation-detector and attestation-as-map both appear.',
    );
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].confidence).toBeGreaterThanOrEqual(matches[i].confidence);
    }
  });
});

describe('formatDynamoLog', () => {
  it('formats successful Dynamo responses', () => {
    expect(
      formatDynamoLog({ result: { recommendation: 'PASS', resonanceScore: 0.812 } }),
    ).toBe('rec=PASS resonance=0.812');
  });

  it('formats governance call errors', () => {
    expect(
      formatDynamoLog({
        ok: false,
        error: true,
        status: 503,
        message: 'service unavailable',
        matchedPrimitives: [],
      }),
    ).toContain('error=service unavailable');
    expect(
      formatDynamoLog({
        ok: false,
        error: true,
        status: 503,
        message: 'service unavailable',
        matchedPrimitives: [],
      }),
    ).toContain('status=503');
  });
});

describe('buildInferenceLogEntry', () => {
  beforeEach(() => {
    setCuratedSignalsForTesting(TEST_SIGNALS);
  });

  it('embeds matched primitives and confidence in the log entry', () => {
    const entry = buildInferenceLogEntry({
      source: 'groover',
      postId: 'post-1',
      inference: 'TYPE: ontological-trap\nattestation-as-map closure primitive.',
      publicReply: 'Reply text',
      govOutcome: {
        ok: true,
        data: { result: { recommendation: 'PASS', resonanceScore: 0.9 } },
        matchedPrimitives: ['attestation-as-map'],
      },
    });

    expect(entry.matched_primitives).toContain('attestation-as-map');
    expect(entry.match_confidence['attestation-as-map']).toBeGreaterThan(0);
    expect(entry.repertoire_signals).toEqual(entry.matched_primitives);
    expect(entry.governance_forced).toBe(true);
    expect(entry.inference_type).toBe('ontological-trap');
  });

  it('uses pre-inference repertoire signals when provided', () => {
    const entry = buildInferenceLogEntry({
      source: 'groover',
      postId: 'post-2',
      inference: 'TYPE: theoretical\nplain reply.',
      publicReply: 'Reply text',
      govOutcome: null,
      repertoireSignals: ['attestation-as-map', 'consumption-boundary-revalidation-gate'],
      governanceForced: true,
    });

    expect(entry.repertoire_signals).toEqual([
      'attestation-as-map',
      'consumption-boundary-revalidation-gate',
    ]);
    expect(entry.governance_forced).toBe(true);
    expect(entry.matched_primitives).not.toContain('attestation-as-map');
  });
});