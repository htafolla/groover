import { describe, it, expect, vi } from 'vitest';

vi.mock('../../xray/src/index.js', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    xrayBridge: {
      orchestrate: vi.fn().mockResolvedValue({ status: 'delegated' }),
      govern: vi.fn().mockResolvedValue({ decision: 'delegated-to-mcp' }),
      enforce: vi.fn().mockResolvedValue({ score: 100, violations: [] }),
    },
  };
});

import {
  generateKeyPair,
  signPayload,
  canonicalRegisterMessage,
  canonicalMintMessage,
  ed25519PublicKeyToRawHex,
} from '../../identity/src/index.js';
import { getRegistrationChallenge, registerPlugin } from './index.js';
import {
  PREV_HASH_SEED,
  buildTraceFromTurns,
  buildTurn,
  computeTurnHash,
  getSession,
  submitTurn,
  type ChallengeTrace,
} from './challenge.js';
import { TOOL_HANDLERS } from './mcp-server.js';

function buildValidTrace(sessionId: string) {
  const baseTime = Date.now() - 6000;
  let prevHash = PREV_HASH_SEED;
  const turns: ReturnType<typeof buildTurn>[] = [];
  const push = (tool: string, input: string, output: string, reasoning: string, ts: number) => {
    const t = { ...buildTurn(prevHash, tool, input, output, reasoning), timestamp: ts };
    t.hash = computeTurnHash(prevHash, t);
    turns.push(t);
    prevHash = t.hash;
  };
  push('search_plugins', 'cross-correlation marketplace', '[result1,result2]',
    'Discovered Groover registry cross-correlation signals for plugin synthesis and governance alignment. Execution trace submitted for verification of automated workflow.', baseTime);
  push('list_mcp_servers', '{}', '["Dynamo","xray-enforcer","xray-governance"]',
    'Identified available MCP servers for orchestration workflow and security audit ecosystem. Explore resilience patterns and improved automated governance landscape.', baseTime + 1500);
  push('synthesize', 'correlation + MCP ecosystem', 'novel-plugin-concept',
    'Synthesized a novel plugin concept combining registry search with MCP tools. Self-critique against current architecture validates execution completeness, marketplace registration flow, and security audit alignment.', baseTime + 4500);
  push('search_plugins', 'follow-up governance', 'adaptive-response',
    'Adaptive follow-up: cross-correlate governance resonance mitigation workflow for registry alignment and automated verification.', baseTime + 6000);
  return buildTraceFromTurns(sessionId, turns);
}

function submitValidTraceFlow(sessionId: string): ChallengeTrace {
  const trace = buildValidTrace(sessionId);
  for (const turn of trace.turns) {
    submitTurn(sessionId, turn);
  }
  expect(getSession(sessionId)?.followUpCompleted).toBe(true);
  return trace;
}

async function registerFixture() {
  const keys = generateKeyPair();
  const challenge = getRegistrationChallenge(keys.publicKey);
  const trace = submitValidTraceFlow(challenge.session.sessionId);
  const payload = 'mint-suit-' + Date.now();
  const metadata = { name: 'mint-suit-test' };
  const sig = signPayload(
    keys.privateKey,
    canonicalRegisterMessage({
      nonce: challenge.nonce,
      publicKeyHex: ed25519PublicKeyToRawHex(keys.publicKey),
      payload,
      metadata,
    }),
  );
  const rec = (await registerPlugin({
    pubkey: keys.publicKey,
    payload,
    signature: sig,
    challengeNonce: challenge.nonce,
    challengeTrace: trace,
    metadata,
  })) as { did: string; apiKey: string };
  return { ...rec, keys };
}

function mintAuth(rec: { did: string; apiKey: string; keys: { privateKey: string } }, pack: string, to: string) {
  const issuedAtMs = Date.now();
  return {
    issuedAtMs,
    mintSignature: signPayload(
      rec.keys.privateKey,
      canonicalMintMessage({ did: rec.did, pack, to, issuedAtMs }),
    ),
  };
}

describe('mint_suit MCP', () => {
  const to = '0x0000000000000000000000000000000000000001';

  it('rejects unregistered DID', async () => {
    await expect(
      TOOL_HANDLERS.mint_suit({
        did: 'did:groover:aaaaaaaaaaaaaaaa',
        apiKey: 'groover_nope',
        pack: 'groover-identity',
        to,
        dryRun: true,
      }),
    ).rejects.toThrow(/not registered/);
  });

  it('rejects bad apiKey', async () => {
    const rec = await registerFixture();
    const auth = mintAuth(rec, 'groover-identity', to);
    await expect(
      TOOL_HANDLERS.mint_suit({
        did: rec.did,
        apiKey: 'groover_wrong',
        pack: 'groover-identity',
        to,
        dryRun: true,
        ...auth,
      }),
    ).rejects.toThrow(/API key/);
  });

  it('rejects mint without Ed25519 proof', async () => {
    const rec = await registerFixture();
    const issuedAtMs = Date.now();
    await expect(
      TOOL_HANDLERS.mint_suit({
        did: rec.did,
        apiKey: rec.apiKey,
        pack: 'groover-identity',
        to,
        dryRun: true,
        issuedAtMs,
        mintSignature: '00'.repeat(64),
      }),
    ).rejects.toThrow(/proof-of-possession/);
  });

  it('dry-runs a registered DID without broadcasting', async () => {
    const rec = await registerFixture();
    delete process.env.GRVR_PRIVATE_KEY;
    const auth = mintAuth(rec, 'groover-identity', to);
    const result = (await TOOL_HANDLERS.mint_suit({
      did: rec.did,
      apiKey: rec.apiKey,
      pack: 'groover-identity',
      to,
      dryRun: true,
      ...auth,
    })) as { success: boolean; dryRun: boolean; txHash?: string; level: number };
    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.txHash).toBeUndefined();
    expect(result.level).toBe(0);
  });

  it('sets Level from fullBox7D on dry-run', async () => {
    const rec = await registerFixture();
    delete process.env.GRVR_PRIVATE_KEY;
    const auth = mintAuth(rec, 'groover-identity', to);
    const result = (await TOOL_HANDLERS.mint_suit({
      did: rec.did,
      apiKey: rec.apiKey,
      pack: 'groover-identity',
      to,
      fullBox7D: 0.91,
      dryRun: true,
      ...auth,
    })) as { success: boolean; level: number };
    expect(result.success).toBe(true);
    expect(result.level).toBe(3);
  });
});
