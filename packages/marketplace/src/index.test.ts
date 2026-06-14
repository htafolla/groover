import { describe, it, expect, vi } from 'vitest';
import * as crypto from 'crypto';

vi.mock('../../xray/src/index.js', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    xrayBridge: {
      orchestrate: vi.fn().mockResolvedValue({ status: 'delegated' }),
      govern: vi.fn().mockResolvedValue({ decision: 'delegated-to-mcp' }),
      enforce: vi.fn().mockResolvedValue({ score: 100, violations: [] }),
    },
  };
});

import { registerPlugin, searchPlugins, getRegistrySnapshot, getPluginUiManifest, getRegistrationChallenge } from './index.js';
import { buildTurn, buildTraceFromTurns, validateTrace, computeTurnHash, PREV_HASH_SEED, createChallengeSession } from './challenge.js';
import { listMcpServers, frameworkLogger } from '../../xray/src/index.js';
import { handleMcpToolCall } from './mcp-server.js';
import { generateKeyPair, signPayload } from '../../identity/src/index.js';

function buildValidTrace(sessionId: string) {
  const baseTime = Date.now() - 5000;
  let prevHash = PREV_HASH_SEED;
  const turns = [];
  turns.push({ ...buildTurn(prevHash, 'search_plugins', 'cross-correlation marketplace', '[result1,result2]', 'Discovered signals for plugin synthesis via cross-correlation.'), timestamp: baseTime });
  turns[0].hash = computeTurnHash(prevHash, turns[0]);
  prevHash = turns[0].hash;
  turns.push({ ...buildTurn(prevHash, 'list_mcp_servers', '{}', '["Dynamo","xray-enforcer","xray-governance"]', 'Identified available MCP servers for orchestration workflow.'), timestamp: baseTime + 1500 });
  turns[1].hash = computeTurnHash(prevHash, turns[1]);
  prevHash = turns[1].hash;
  turns.push({ ...buildTurn(prevHash, 'synthesize', 'correlation + MCP ecosystem', 'novel-plugin-concept', 'Synthesized a novel plugin concept combining cross-correlation with MCP orchestration. This improves automated governance resilience.'), timestamp: baseTime + 4500 });
  turns[2].hash = computeTurnHash(prevHash, turns[2]);
  return buildTraceFromTurns(sessionId, turns);
}

describe('@groover/marketplace', () => {
  it('registerPlugin with valid PoP + valid challenge trace succeeds', async () => {
    const keys = generateKeyPair();
    const challenge = getRegistrationChallenge(keys.publicKey);
    expect(challenge.nonce).toBeTruthy();
    expect(challenge.session).toBeTruthy();
    expect(challenge.session.task.prompt).toBeTruthy();
    expect(challenge.session.task.requiredTools.length).toBeGreaterThan(0);

    const trace = buildValidTrace(challenge.session.sessionId);
    const payload = 'pop-reg-' + Date.now();
    const sig = signPayload(keys.privateKey, challenge.nonce + '|' + payload);

    const result = await registerPlugin({
      pubkey: keys.publicKey,
      payload,
      signature: sig,
      challengeNonce: challenge.nonce,
      challengeTrace: trace,
      metadata: { name: 'pop-test-agent' },
    });
    expect('did' in result).toBe(true);
    expect((result as any).did).toMatch(/^did:groover:/);
    expect((result as any).apiKey).toMatch(/^groover_/);
  });

  it('Proof-of-Possession with wrong signature throws', async () => {
    const keys = generateKeyPair();
    const challenge = getRegistrationChallenge(keys.publicKey);
    const trace = buildValidTrace(challenge.session.sessionId);
    const wrongSig = crypto.randomBytes(64).toString('hex');
    const payload = 'pop-wrong-' + Date.now();

    await expect(registerPlugin({
      pubkey: keys.publicKey,
      payload,
      signature: wrongSig,
      challengeNonce: challenge.nonce,
      challengeTrace: trace,
      metadata: { name: 'pop-wrong-agent' },
    })).rejects.toThrow('Proof-of-possession failed');
  });

  it('Proof-of-Possession with reused nonce throws', async () => {
    const keys = generateKeyPair();
    const challenge = getRegistrationChallenge(keys.publicKey);
    const trace = buildValidTrace(challenge.session.sessionId);
    const payload = 'pop-reuse-' + Date.now();
    const sig = signPayload(keys.privateKey, challenge.nonce + '|' + payload);

    await registerPlugin({
      pubkey: keys.publicKey,
      payload,
      signature: sig,
      challengeNonce: challenge.nonce,
      challengeTrace: trace,
      metadata: { name: 'pop-reuse-first' },
    });

    const challenge2 = getRegistrationChallenge(keys.publicKey);
    const trace2 = buildValidTrace(challenge2.session.sessionId);
    const payload2 = 'pop-reuse-second-' + Date.now();
    const sig2 = signPayload(keys.privateKey, challenge2.nonce + '|' + payload2);

    await expect(registerPlugin({
      pubkey: keys.publicKey,
      payload: payload2,
      signature: sig2,
      challengeNonce: challenge.nonce,
      challengeTrace: trace2,
      metadata: { name: 'pop-reuse-second' },
    })).rejects.toThrow('already-used');
  });

  it('Invalid challenge trace (too few turns) returns gray', async () => {
    const keys = generateKeyPair();
    const challenge = getRegistrationChallenge(keys.publicKey);
    // Build a trace with only 1 turn (below minTurns of 3)
    let prevHash = PREV_HASH_SEED;
    const turns = [buildTurn(prevHash, 'search_plugins', 'test', 'result', 'Some short reasoning here that is long enough.')];
    const trace = buildTraceFromTurns(challenge.session.sessionId, turns);
    const payload = 'bad-trace-' + Date.now();
    const sig = signPayload(keys.privateKey, challenge.nonce + '|' + payload);

    const result = await registerPlugin({
      pubkey: keys.publicKey,
      payload,
      signature: sig,
      challengeNonce: challenge.nonce,
      challengeTrace: trace,
      metadata: { name: 'bad-trace-agent' },
    });
    expect(result).toEqual({ status: 'gray', cooldown: 300_000 });
  });

  it('Missing challenge sessionId throws', async () => {
    const keys = generateKeyPair();
    const challenge = getRegistrationChallenge(keys.publicKey);
    const trace = buildValidTrace('nonexistent-session-id');
    const payload = 'bad-session-' + Date.now();
    const sig = signPayload(keys.privateKey, challenge.nonce + '|' + payload);

    await expect(registerPlugin({
      pubkey: keys.publicKey,
      payload,
      signature: sig,
      challengeNonce: challenge.nonce,
      challengeTrace: trace,
      metadata: { name: 'bad-session-agent' },
    })).rejects.toThrow('Challenge session not found');
  });

  it('Hash chain tampering detected — trace validation fails', async () => {
    const keys = generateKeyPair();
    const challenge = getRegistrationChallenge(keys.publicKey);
    const trace = buildValidTrace(challenge.session.sessionId);
    // Tamper with a turn's reasoning
    const tamperedTurns = trace.turns.map((t, i) => i === 1 ? { ...t, reasoning: 'TAMPERED' } : t);
    const tamperedTrace = { ...trace, turns: tamperedTurns };
    const payload = 'tampered-' + Date.now();
    const sig = signPayload(keys.privateKey, challenge.nonce + '|' + payload);

    const result = await registerPlugin({
      pubkey: keys.publicKey,
      payload,
      signature: sig,
      challengeNonce: challenge.nonce,
      challengeTrace: tamperedTrace,
      metadata: { name: 'tampered-agent' },
    });
    expect(result).toEqual({ status: 'gray', cooldown: 300_000 });
  });

  it('getRegistrySnapshot returns non-empty after registration', () => {
    const snap = getRegistrySnapshot();
    expect(snap.length).toBeGreaterThan(0);
  });

  it('searchPlugins returns ranked results', async () => {
    const ranked = await searchPlugins('test query');
    expect(ranked.length).toBeGreaterThan(0);
  });

  it('listMcpServers returns server list', () => {
    const mcps = listMcpServers();
    expect(mcps.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Challenge trace validation', () => {
  it('valid trace passes validation', () => {
    const session = createChallengeSession('test-pubkey-validation');
    const trace = buildValidTrace(session.sessionId);
    const validation = validateTrace(session, trace);
    expect(validation.valid).toBe(true);
    expect(validation.score).toBeGreaterThanOrEqual(70);
  });

it('trace with missing required tool fails', () => {
    const session = createChallengeSession('test-pubkey');
    const baseTime = Date.now() - 5000;
    let prevHash = PREV_HASH_SEED;
    const turns = [];
    const t0 = { ...buildTurn(prevHash, 'wrong_tool_a', 'input', 'output', 'This is some reasoning that is long enough for the validator.'), timestamp: baseTime };
    t0.hash = computeTurnHash(prevHash, t0);
    prevHash = t0.hash;
    turns.push(t0);
    const t1 = { ...buildTurn(prevHash, 'wrong_tool_b', 'input2', 'output2', 'More reasoning that demonstrates understanding of the ecosystem capabilities.'), timestamp: baseTime + 1500 };
    t1.hash = computeTurnHash(prevHash, t1);
    prevHash = t1.hash;
    turns.push(t1);
    const t2 = { ...buildTurn(prevHash, 'wrong_tool_c', 'input3', 'output3', 'Final reasoning synthesizing the analysis and proposing a concept for governance.'), timestamp: baseTime + 3500 };
    t2.hash = computeTurnHash(prevHash, t2);
    turns.push(t2);
    const trace = buildTraceFromTurns(session.sessionId, turns);
    const validation = validateTrace(session, trace);
    expect(validation.valid).toBe(false);
    expect(validation.violations.some(v => v.includes('missing-required-tool'))).toBe(true);
  });
});

describe('MCP handler (local)', () => {
  it('handleMcpToolCall get_registration_challenge returns session', async () => {
    const keys = generateKeyPair();
    const res = await handleMcpToolCall({
      name: 'get_registration_challenge',
      arguments: { pubkey: keys.publicKey },
    });
    expect((res as any).success).toBe(true);
    expect((res as any).nonce).toBeTruthy();
    expect((res as any).session).toBeTruthy();
    expect((res as any).session.task).toBeTruthy();
    expect((res as any).session.task.requiredTools.length).toBeGreaterThan(0);
  });

  it('handleMcpToolCall search_plugins returns results', async () => {
    const res = await handleMcpToolCall({ name: 'search_plugins', arguments: { query: 'test' } });
    expect((res as any).success).toBe(true);
    expect((res as any).count).toBeGreaterThanOrEqual(0);
  });

  it('handleMcpToolCall list_mcp_servers returns at least 4', async () => {
    const res = await handleMcpToolCall({ name: 'list_mcp_servers', arguments: {} });
    expect((res as any).success).toBe(true);
    expect((res as any).count).toBeGreaterThanOrEqual(4);
  });
});