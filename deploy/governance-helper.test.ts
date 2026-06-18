import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  isOntologicalTrap,
  matchPrimitivesFromInference,
  matchedPrimitiveNames,
  resetGovernanceHelperState,
  setCuratedSignalsForTesting,
  shouldForceGovernance,
  formatDynamoLog,
  buildGovernanceProposal,
  buildInferenceLogEntry,
  parseDynamoHammerEnvelope,
  unwrapDynamoConnectedToolResponse,
  shouldBlockDynamoAction,
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

describe('shouldBlockDynamoAction', () => {
  const passOutcome = {
    ok: true as const,
    data: { result: { recommendation: 'PASS', resonanceScore: 0.5 } },
    matchedPrimitives: [],
  };

  it('does not block when governance call failed', () => {
    expect(
      shouldBlockDynamoAction({
        ok: false,
        error: true,
        message: 'unavailable',
        matchedPrimitives: [],
      }),
    ).toBe(false);
  });

  it('does not block PASS regardless of resonance', () => {
    expect(shouldBlockDynamoAction(passOutcome, 0.75)).toBe(false);
  });

  it('blocks non-PASS when resonance is below threshold', () => {
    expect(
      shouldBlockDynamoAction(
        {
          ok: true,
          data: { result: { recommendation: 'REJECT', resonanceScore: 0.6 } },
          matchedPrimitives: [],
        },
        0.75,
      ),
    ).toBe(true);
  });

  it('does not block non-PASS when resonance meets threshold', () => {
    expect(
      shouldBlockDynamoAction(
        {
          ok: true,
          data: { result: { recommendation: 'REJECT', resonanceScore: 0.8 } },
          matchedPrimitives: [],
        },
        0.75,
      ),
    ).toBe(false);
  });

  it('treats missing resonance as zero (blocks non-PASS)', () => {
    expect(
      shouldBlockDynamoAction(
        {
          ok: true,
          data: { result: { recommendation: 'REVISION' } },
          matchedPrimitives: [],
        },
        0.75,
      ),
    ).toBe(true);
  });
});

describe('buildGovernanceProposal', () => {
  it('builds Dynamo-compliant structuredProposal with agent source', () => {
    const payload = buildGovernanceProposal('Trap post', 'Public reply text', {
      agentDid: 'did:groover:test',
      inferenceType: 'ontological-trap',
      matchedPrimitives: ['attestation-as-map'],
      force: true,
      deliberationSummary: 'code-review: approve (85%)',
    });

    expect(payload.structuredProposal.source).toBe('agent');
    expect(payload.structuredProposal.summary).toContain('Trap post');
    expect(payload.structuredProposal.summary).toContain('Public reply text');
    expect(payload.structuredProposal.summary).toContain('attestation-as-map');
    expect(payload.structuredProposal.summary).toContain('code-review: approve');
    expect(payload.structuredProposal.tags).toEqual(['attestation-as-map']);
    expect(payload.structuredProposal.summary).not.toContain('[object Object]');
  });
});

describe('parseDynamoHammerEnvelope', () => {
  it('unwraps call_connected_tool responses and maps hammer fields', () => {
    const raw = {
      success: true,
      tool: 'govern_with_solar',
      result: {
        recommendation: 'NEEDS_REVISION',
        structuralResonance: 0.74,
        proximity: 0.81,
        phaseAlignment: 0.68,
        synchronization: 0.65,
        signalTiming: 'trailing',
        signalPurity: 0.82,
        hammerReason: 'Moderate resonance',
      },
    };
    const envelope = parseDynamoHammerEnvelope(unwrapDynamoConnectedToolResponse(raw));
    expect(envelope?.recommendation).toBe('NEEDS_REVISION');
    expect(envelope?.resonanceScore).toBe(0.74);
    expect(envelope?.phaseAlignment).toBe(0.68);
    expect(envelope?.signalTiming).toBe('trailing');
    expect(envelope?.signalPurity).toBe(0.82);
  });
});

describe('formatDynamoLog', () => {
  it('formats successful Dynamo responses with extended hammer fields', () => {
    expect(
      formatDynamoLog({
        result: {
          recommendation: 'PASS',
          resonanceScore: 0.812,
          phaseAlignment: 0.68,
          synchronization: 0.65,
          signalTiming: 'synced',
          signalPurity: 0.9,
        },
      }),
    ).toBe('rec=PASS resonance=0.812 phase=0.680 sync=0.650 timing=synced purity=0.900');
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

  it('embeds deliberation rounds and full hammer envelope when provided', () => {
    const entry = buildInferenceLogEntry({
      source: 'groover',
      postId: 'post-3',
      inference: 'TYPE: ontological-trap\nattestation-as-map closure primitive.',
      publicReply: 'Reply text',
      govOutcome: {
        ok: true,
        data: {
          result: {
            recommendation: 'NEEDS_REVISION',
            resonanceScore: 0.74,
            phaseAlignment: 0.68,
            synchronization: 0.65,
            signalTiming: 'trailing',
            hammerReason: 'Moderate resonance',
          },
        },
        matchedPrimitives: ['attestation-as-map'],
      },
      deliberationRounds: [
        { server: 'code-review', decision: 'approve', confidence: 0.85 },
        { server: 'security-audit', decision: 'needs_revision', confidence: 0.78 },
        { server: 'researcher', decision: 'approve', confidence: 0.91 },
      ],
    });

    expect(entry.deliberation_rounds).toHaveLength(3);
    expect(entry.dynamo_result.result?.phaseAlignment).toBe(0.68);
    expect(entry.dynamo_result.result?.hammerReason).toBe('Moderate resonance');
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