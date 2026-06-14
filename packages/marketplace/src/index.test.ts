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
import { buildTurn, buildTraceFromTurns, validateTrace, computeTurnHash, PREV_HASH_SEED, createChallengeSession, getSession } from './challenge.js';
import { listMcpServers, frameworkLogger } from '../../xray/src/index.js';
import { handleMcpToolCall, handleMCPMessage, mcpResult, mcpError } from './mcp-server.js';
import { generateKeyPair, signPayload } from '../../identity/src/index.js';

function buildValidTrace(sessionId: string) {
  const baseTime = Date.now() - 5000;
  let prevHash = PREV_HASH_SEED;
  const turns = [];
  turns.push({ ...buildTurn(prevHash, 'search_plugins', 'cross-correlation marketplace', '[result1,result2]', 'Discovered Groover registry cross-correlation signals for plugin synthesis and governance alignment. Execution trace submitted for verification of automated workflow.'), timestamp: baseTime });
  turns[0].hash = computeTurnHash(prevHash, turns[0]);
  prevHash = turns[0].hash;
  turns.push({ ...buildTurn(prevHash, 'list_mcp_servers', '{}', '["Dynamo","xray-enforcer","xray-governance"]', 'Identified available MCP servers for orchestration workflow and security audit ecosystem. Explore resilience patterns and improved automated governance landscape.'), timestamp: baseTime + 1500 });
  turns[1].hash = computeTurnHash(prevHash, turns[1]);
  prevHash = turns[1].hash;
  turns.push({ ...buildTurn(prevHash, 'synthesize', 'correlation + MCP ecosystem', 'novel-plugin-concept', 'Synthesized a novel plugin concept combining registry search with MCP tools. Self-critique against current architecture validates execution completeness, marketplace registration flow, and security audit alignment.'), timestamp: baseTime + 4500 });
  turns[2].hash = computeTurnHash(prevHash, turns[2]);
  return buildTraceFromTurns(sessionId, turns);
}

describe('@groover/marketplace', () => {
  it('registerPlugin with valid PoP + valid challenge trace + uiManifest roundtrips', async () => {
    const keys = generateKeyPair();
    const challenge = getRegistrationChallenge(keys.publicKey);
    challenge.session.followUpCompleted = true;
    const trace = buildValidTrace(challenge.session.sessionId);
    const payload = 'pop-ui-' + Date.now();
    const sig = signPayload(keys.privateKey, challenge.nonce + '|' + payload);
    const uiManifest = {
      version: '1' as const,
      displayMode: 'form' as const,
      primaryTool: 'search_plugins',
      fields: [
        { id: 'q', label: 'Query', fieldType: 'text' as const },
      ],
      exampleQueries: ['governance resonance'],
    };

    const result = await registerPlugin({
      pubkey: keys.publicKey,
      payload,
      signature: sig,
      challengeNonce: challenge.nonce,
      challengeTrace: trace,
      metadata: { name: 'ui-manifest-test' },
      uiManifest,
    });
    expect('did' in result).toBe(true);
    const did = (result as any).did;
    expect(did).toMatch(/^did:groover:/);

    const stored = getPluginUiManifest(did as string);
    expect(stored).toEqual(uiManifest);
  });

  it('registerPlugin with valid PoP + valid challenge trace succeeds', async () => {
    const keys = generateKeyPair();
    const challenge = getRegistrationChallenge(keys.publicKey);
    expect(challenge.nonce).toBeTruthy();
    expect(challenge.session).toBeTruthy();
    expect(challenge.session.task.prompt).toBeTruthy();
    expect(challenge.session.task.requiredTools.length).toBeGreaterThan(0);

    // Mark the adaptive flow as completed (in production this happens via submit_challenge_turn)
    challenge.session.followUpCompleted = true;

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

  it('resonance boundary: 0.79 does NOT relax, 0.80 DOES relax', () => {
    const session = createChallengeSession('test-pubkey-boundary');
    const baseTime = Date.now() - 5000;
    let prevHash = PREV_HASH_SEED;
    const turns = [];
    const t0 = { ...buildTurn(prevHash, 'search_plugins', 'governance query', '[result]', 'Discovered registration signals for temporal governance alignment. Autonomous execution trace for verification workflow ecosystem.'), timestamp: baseTime };
    t0.hash = computeTurnHash(prevHash, t0);
    prevHash = t0.hash;
    turns.push(t0);
    const t1 = { ...buildTurn(prevHash, 'list_mcp_servers', '{}', '["Dynamo","xray-governance"]', 'Identified MCP servers for orchestration workflow and security audit. Self-critique for resilience patterns in governance landscape.'), timestamp: baseTime + 5000 };
    t1.hash = computeTurnHash(prevHash, t1);
    turns.push(t1);
    const trace = buildTraceFromTurns(session.sessionId, turns);

    const belowThreshold = validateTrace(session, trace, { dynamoMetrics: { resonance: 0.79 } });
    expect(belowThreshold.valid).toBe(false);
    expect(belowThreshold.violations.some(v => v.includes('too-few-turns'))).toBe(true);

    const atThreshold = validateTrace(session, trace, { dynamoMetrics: { resonance: 0.80 } });
    expect(atThreshold.valid).toBe(true);
    expect(atThreshold.score).toBeGreaterThanOrEqual(70);
    expect(atThreshold.violations.some(v => v.includes('too-few-turns'))).toBe(false);
  });

  it('privileged resonance >= 0.8 relaxes minTurns and coverage threshold', () => {
    const session = createChallengeSession('test-pubkey-privileged');
    const baseTime = Date.now() - 5000;
    let prevHash = PREV_HASH_SEED;
    const turns = [];
    const t0 = { ...buildTurn(prevHash, 'search_plugins', 'governance query', '[result]', 'Discovered registry signals for temporal governance and reversible capital alignment. Execution trace for autonomous verification.'), timestamp: baseTime };
    t0.hash = computeTurnHash(prevHash, t0);
    prevHash = t0.hash;
    turns.push(t0);
    const t1 = { ...buildTurn(prevHash, 'list_mcp_servers', '{}', '["Dynamo","xray-governance"]', 'Identified MCP servers for orchestration workflow and governance ecosystem. Self-critique for resilience patterns.'), timestamp: baseTime + 5000 };
    t1.hash = computeTurnHash(prevHash, t1);
    turns.push(t1);
    const trace = buildTraceFromTurns(session.sessionId, turns);

    // Without resonance: 2 turns < minTurns 3 → fails
    const normalValidation = validateTrace(session, trace, {});
    expect(normalValidation.valid).toBe(false);
    expect(normalValidation.violations.some(v => v.includes('too-few-turns'))).toBe(true);

    // With resonance >= 0.8: effectiveMinTurns = 2, so 2 turns passes
    const privilegedValidation = validateTrace(session, trace, { dynamoMetrics: { resonance: 0.9 } });
    expect(privilegedValidation.valid).toBe(true);
    expect(privilegedValidation.score).toBeGreaterThanOrEqual(70);
    expect(privilegedValidation.violations.some(v => v.includes('too-few-turns'))).toBe(false);
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

  it('full adaptive submit_challenge_turn flow completes and allows registration', async () => {
    const keys = generateKeyPair();
    const chal = await handleMcpToolCall({ name: 'get_registration_challenge', arguments: { pubkey: keys.publicKey } }) as any;
    expect(chal.success).toBe(true);
    const sessionId = chal.session.sessionId;
    const taskPrompt: string = chal.session.task.prompt;
    const baseTime = Date.now() - 5000;
    let prevHash = PREV_HASH_SEED;
    const turns = [];

    // Extract significant terms from the actual task prompt for reasoning coverage
    const sigTerms = taskPrompt.toLowerCase().replace(/[^a-z0-9_\s-]/g, '').split(/\s+/).filter(w => w.length > 4);
    const useTerms = sigTerms.slice(0, 8).join(' ');

    // Submit 3 turns via MCP handler
    for (let i = 0; i < 3; i++) {
      const tool = i === 0 ? 'search_plugins' : i === 1 ? 'list_mcp_servers' : 'synthesize';
      const reasoning = i === 0
        ? 'Searching registry: ' + useTerms
        : i === 1
        ? 'Listing servers for: ' + useTerms
        : 'Synthesizing with: ' + useTerms + ' novel plugin concept self-critique';
      const turn = { ...buildTurn(prevHash, tool, 'input-' + i, 'output-' + i, reasoning), timestamp: baseTime + i * 1500 };
      turn.hash = computeTurnHash(prevHash, turn);
      const resp = await handleMcpToolCall({ name: 'submit_challenge_turn', arguments: { sessionId, toolCall: turn.toolCall, input: turn.input, output: turn.output, reasoning: turn.reasoning, hash: turn.hash } }) as any;
      expect(resp.success).toBe(true);
      prevHash = turn.hash;
      turns.push(turn);
      if (i === 2) {
        // Turn 3 should generate a follow-up prompt
        expect(resp.followUpPrompt).toBeTruthy();
      }
    }

    const session = getSession(sessionId);
    expect(session).toBeTruthy();
    expect(session!.followUpPrompt).toBeTruthy();
    expect(session!.followUpCompleted).toBeUndefined();

    // Submit 4th adaptive turn
    const t4 = { ...buildTurn(prevHash, 'list_mcp_servers', 'follow-up-input', 'follow-up-output', 'Adaptive follow-up: ' + useTerms + ' cross-correlate governance resonance mitigation workflow.'), timestamp: baseTime + 5500 };
    t4.hash = computeTurnHash(prevHash, t4);
    const resp4 = await handleMcpToolCall({ name: 'submit_challenge_turn', arguments: { sessionId, toolCall: t4.toolCall, input: t4.input, output: t4.output, reasoning: t4.reasoning, hash: t4.hash } }) as any;
    expect(resp4.success).toBe(true);
    expect(session!.followUpCompleted).toBe(true);

    // Now register with the full 4-turn trace
    turns.push(t4);
    const trace = buildTraceFromTurns(sessionId, turns);
    const payload = 'adaptive-test-' + Date.now();
    const sig = signPayload(keys.privateKey, chal.nonce + '|' + payload);

    // Verify session state before registering
    const sessionBefore = getSession(sessionId);
    expect(sessionBefore?.followUpCompleted).toBe(true);
    expect(sessionBefore?.status).toBe('in-progress');

    const result = await registerPlugin({
      pubkey: keys.publicKey,
      payload,
      signature: sig,
      challengeNonce: chal.nonce,
      challengeTrace: trace,
      metadata: { name: 'adaptive-flow-test' },
    }) as any;
    expect(result.did).toMatch(/^did:groover:/);
    expect((result as any).apiKey).toMatch(/^groover_/);
  });
});

describe('Session-based MCP message handler', () => {
  it('initialize returns server info', async () => {
    const result = await handleMCPMessage('test-session', { jsonrpc: '2.0', id: 1, method: 'initialize' });
    expect(result).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'groover-registry', version: '0.2-mvp' },
      },
    });
  });

  it('ping returns empty result', async () => {
    const result = await handleMCPMessage('test-session', { jsonrpc: '2.0', id: 2, method: 'ping' });
    expect(result).toMatchObject({ jsonrpc: '2.0', id: 2, result: {} });
  });

  it('tools/list returns tool definitions', async () => {
    const result = await handleMCPMessage('test-session', { jsonrpc: '2.0', id: 3, method: 'tools/list' });
    expect(result.result.tools.length).toBeGreaterThanOrEqual(6);
    const names = result.result.tools.map((t: any) => t.name);
    expect(names).toContain('register_plugin');
    expect(names).toContain('get_registration_challenge');
    expect(names).toContain('search_plugins');
    expect(names).toContain('list_mcp_servers');
  });

  it('tools/call with valid tool returns result', async () => {
    const result = await handleMCPMessage('test-session', {
      jsonrpc: '2.0', id: 4,
      method: 'tools/call',
      params: { name: 'list_mcp_servers', arguments: {} },
    });
    expect(result.result.content[0].type).toBe('text');
    const parsed = JSON.parse(result.result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.count).toBeGreaterThanOrEqual(4);
  });

  it('tools/call with unknown tool returns error', async () => {
    const result = await handleMCPMessage('test-session', {
      jsonrpc: '2.0', id: 5,
      method: 'tools/call',
      params: { name: 'nonexistent_tool', arguments: {} },
    });
    expect(result.error.code).toBe(-32601);
    expect(result.error.message).toContain('Unknown tool');
  });

  it('unknown method returns error', async () => {
    const result = await handleMCPMessage('test-session', {
      jsonrpc: '2.0', id: 6,
      method: 'bogus_method',
    });
    expect(result.error.code).toBe(-32601);
  });

  it('notifications (no id) are silently ignored', async () => {
    const result = await handleMCPMessage('test-session', { jsonrpc: '2.0', method: 'ping' });
    expect(result).toBeNull();
  });

  it('missing tool name returns error', async () => {
    const result = await handleMCPMessage('test-session', {
      jsonrpc: '2.0', id: 7,
      method: 'tools/call',
      params: { arguments: {} },
    });
    expect(result.error.code).toBe(-32602);
    expect(result.error.message).toBe('Missing tool name');
  });
});