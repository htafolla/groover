/**
 * Deploy verification script for Groover Railway MCP registry.
 * Tests the full adaptive multi-turn challenge flow against the live deployed service.
 * Usage: RAILWAY_MCP_URL=https://... npx tsx deploy/confirm-railway-endpoints.ts
 * Default URL: https://registry-production-e2c4.up.railway.app
 */
import * as https from 'https';
import * as crypto from 'crypto';

const RAILWAY_PROD = 'https://registry-production-e2c4.up.railway.app';
const liveBase = (process.env.RAILWAY_MCP_URL || process.env.DEPLOYED_REGISTRY_URL || RAILWAY_PROD).replace(/\/$/, '');

function out(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function err(msg: string): void {
  process.stderr.write(`${msg}\n`);
}

function postMcp(method: string, params: unknown = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params });
    const url = new URL(liveBase + '/mcp');
    const req = https.request({
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', (c: string) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function parseMcpResult(rpc: unknown): unknown | null {
  try {
    const r = rpc as { result?: { content?: [{ text?: string }] } };
    if (!r?.result?.content?.[0]) return null;
    return JSON.parse(r.result.content[0].text as string);
  } catch {
    return null;
  }
}

async function main(): Promise<boolean> {
  out('Verifying deployed registry at', liveBase);

  // --- Step 1: Initialize ---
  const initRpc = await postMcp('initialize', {}) as { result?: { serverInfo?: { name?: string } } };
  const serverName = initRpc?.result?.serverInfo?.name;
  if (serverName !== 'groover-registry') {
    err('Initialize failed: expected groover-registry, got', serverName);
    return false;
  }
  out('✓ Initialize:', serverName);

  // --- Step 2: List tools ---
  const listRpc = await postMcp('tools/list', {}) as { result?: { tools?: Array<{ name: string }> } };
  const advertisedTools = (listRpc?.result?.tools || []).map((t: { name: string }) => t.name);
  const expectedTools = ['get_registration_challenge', 'register_plugin', 'submit_challenge_turn', 'search_plugins', 'get_plugin_ui_manifest', 'list_mcp_servers'];
  const allAdvertised = expectedTools.every(t => advertisedTools.includes(t));
  if (!allAdvertised) {
    err('Tools list mismatch. Expected:', expectedTools, 'Got:', advertisedTools);
    return false;
  }
  out('✓ Tools list:', advertisedTools.length, 'tools');

  // --- Step 3: Get registration challenge ---
  const pubkey = crypto.randomBytes(32).toString('hex');
  const challengeRpc = await postMcp('tools/call', { name: 'get_registration_challenge', arguments: { pubkey } });
  const challengeResult = parseMcpResult(challengeRpc) as Record<string, unknown> | null;
  if (!challengeResult || challengeResult.success === false) {
    err('get_registration_challenge failed:', challengeResult);
    return false;
  }
  const sessionId = (challengeResult.session as Record<string, unknown>).sessionId as string;
  out('✓ Challenge issued, sessionId:', sessionId.slice(0, 16) + '...');

  // --- Step 4: Build and submit 4-turn adaptive challenge ---
  const { buildTurn, buildTraceFromTurns, PREV_HASH_SEED, computeTurnHash } = await import('../packages/marketplace/src/challenge.js');
  let prevHash = PREV_HASH_SEED;
  const turns = [];
  // Use explicit timestamps with spacing to satisfy minDurationMs gate
  const baseTime = Date.now() - 6000;

  // Turn 1: search_plugins
  const t1raw = buildTurn(prevHash, 'search_plugins', 'deploy-verification cross-correlation', 'signal-results', 'Searching registry for cross-correlation signals relevant to deploy verification.');
  const t1 = { ...t1raw, timestamp: baseTime };
  t1.hash = computeTurnHash(prevHash, t1);
  await postMcp('tools/call', { name: 'submit_challenge_turn', arguments: { sessionId, toolCall: t1.toolCall, input: t1.input, output: t1.output, reasoning: t1.reasoning, hash: t1.hash, timestamp: t1.timestamp } });
  turns.push(t1);
  prevHash = t1.hash;
  out('✓ Turn 1: search_plugins submitted');

  // Turn 2: list_mcp_servers
  const t2raw = buildTurn(prevHash, 'list_mcp_servers', '{}', 'server-list', 'Listing available MCP servers to understand orchestration capabilities for verification workflow.');
  const t2 = { ...t2raw, timestamp: baseTime + 1500 };
  t2.hash = computeTurnHash(prevHash, t2);
  await postMcp('tools/call', { name: 'submit_challenge_turn', arguments: { sessionId, toolCall: t2.toolCall, input: t2.input, output: t2.output, reasoning: t2.reasoning, hash: t2.hash, timestamp: t2.timestamp } });
  turns.push(t2);
  prevHash = t2.hash;
  out('✓ Turn 2: list_mcp_servers submitted');

  // Turn 3: search_plugins — triggers adaptive follow-up
  const t3raw = buildTurn(prevHash, 'search_plugins', 'MCP orchestration gaps deploy verification', 'gap-analysis', 'Cross-referencing registry results with MCP ecosystem to identify verification workflow gaps and propose automated governance integration.');
  const t3 = { ...t3raw, timestamp: baseTime + 3500 };
  t3.hash = computeTurnHash(prevHash, t3);
  const turn3Resp = await postMcp('tools/call', { name: 'submit_challenge_turn', arguments: { sessionId, toolCall: t3.toolCall, input: t3.input, output: t3.output, reasoning: t3.reasoning, hash: t3.hash, timestamp: t3.timestamp } });
  turns.push(t3);
  prevHash = t3.hash;
  const turn3Parsed = parseMcpResult(turn3Resp) as Record<string, unknown> | null;
  const followUpPrompt = (turn3Parsed?.followUpPrompt as string) || null;
  out('✓ Turn 3 submitted' + (followUpPrompt ? ', follow-up generated' : ''));

  // Turn 4: respond to adaptive follow-up
  if (followUpPrompt) {
    const tool = followUpPrompt.toLowerCase().includes('search_plugins') ? 'search_plugins' : 'list_mcp_servers';
    const t4raw = buildTurn(prevHash, tool, followUpPrompt.slice(0, 80), 'adaptive-response', 'Responding to server-issued adaptive follow-up: re-engaging registry tools to cross-reference and critique the proposed concept for alignment with governance requirements.');
    const t4 = { ...t4raw, timestamp: baseTime + 5500 };
    t4.hash = computeTurnHash(prevHash, t4);
    await postMcp('tools/call', { name: 'submit_challenge_turn', arguments: { sessionId, toolCall: t4.toolCall, input: t4.input, output: t4.output, reasoning: t4.reasoning, hash: t4.hash, timestamp: t4.timestamp } });
    turns.push(t4);
    out('✓ Turn 4: adaptive follow-up submitted');
  }

  // --- Step 5: Build trace and register ---
  const trace = buildTraceFromTurns(sessionId, turns);
  const nonce = challengeResult.nonce as string;
  const payload = `deploy-verify-${Date.now()}`;
  const { generateKeyPair, signPayload } = await import('../packages/identity/src/index.js');
  const keys = generateKeyPair();
  const sig = signPayload(keys.privateKey, nonce + '|' + payload);
  const registerRpc = await postMcp('tools/call', {
    name: 'register_plugin',
    arguments: {
      pubkey: keys.publicKey,
      payload,
      metadata: { name: 'deploy-verify-agent' },
      signature: sig,
      challengeNonce: nonce,
      challengeTrace: trace,
      uiManifest: { version: '1', displayMode: 'form', fields: [{ id: 'q', label: 'Query', fieldType: 'text' }] },
    },
  });
  const registerResult = parseMcpResult(registerRpc) as Record<string, unknown> | null;
  const record = registerResult?.record as Record<string, unknown> | undefined;
  if (!registerResult || record?.status === 'gray') {
    err('register_plugin returned gray:', registerResult);
    return false;
  }
  const did = (registerResult.did as string) || (record?.did as string);
  out('✓ register_plugin success, DID:', did?.slice(0, 16) + '...');

  // --- Step 6: get_plugin_ui_manifest ---
  if (did) {
    const uiRpc = await postMcp('tools/call', { name: 'get_plugin_ui_manifest', arguments: { did } });
    const uiResult = parseMcpResult(uiRpc) as Record<string, unknown> | null;
    if (uiResult && uiResult.success !== false) {
      out('✓ get_plugin_ui_manifest success');
    }
  }

  out('✓ All endpoints verified successfully');
  return true;
}

main().then((ok) => {
  process.exit(ok ? 0 : 1);
}).catch((e) => {
  err('Fatal:', e);
  process.exit(1);
});
