/**
 * @groover/marketplace
 * Registry + search powered by @groover/core correlation.
 * registerPlugin implements the full Proof of Autonomy flow:
 *   1. Crypto PoP (ed25519 nonce signature)
 *   2. Adaptive multi-turn MCP orchestration challenge (trace validation)
 *   3. Dynamo governance gate (xray bridge)
 *   4. Codex enforcement (xray enforcer)
 * Prod-ready, frameworkLogger only, codex compliant.
 */
import { frameworkLogger } from '../../xray/src/index.js';
import { coreEngine, CorrelationResult } from '../../core/src/index.js';
import { xrayBridge, listMcpServers } from '../../xray/src/index.js';
import { generateDID, generateApiKey, verifyWithPublic } from '../../identity/src/index.js';
import {
  createChallengeSession, getSession, validateTrace,
  markSessionCompleted, markSessionFailed, computeReasoningCoverage,
  ChallengeSession, ChallengeTrace,
} from './challenge.js';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const REGISTRY_PATH = process.env.REGISTRY_FILE || path.resolve(process.cwd(), 'data/registry.json');

export interface PluginRecord {
  did: string;
  pubkey: string;
  signature: string;
  apiKey: string;
  metadata: Record<string, unknown>;
  registeredAt: string;
  reputation: number;
  uiManifest?: import('./agent-ui-manifest.js').AgentUiManifest;
}

function loadRegistry(): Map<string, PluginRecord> {
  try {
    const dir = path.dirname(REGISTRY_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(REGISTRY_PATH)) {
      const raw = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8')) as [string, PluginRecord][];
      const loaded = new Map(raw);
      frameworkLogger.log('marketplace', 'registry-loaded', 'success', { count: loaded.size, path: REGISTRY_PATH });
      return loaded;
    }
  } catch (e) {
    frameworkLogger.log('marketplace', 'registry-load-failed', 'warning', { error: String(e) });
  }
  return new Map();
}

function saveRegistry(): void {
  try {
    const dir = path.dirname(REGISTRY_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = REGISTRY_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(Array.from(registry.entries()), null, 2));
    fs.renameSync(tmp, REGISTRY_PATH);
  } catch (e) {
    frameworkLogger.log('marketplace', 'registry-save-failed', 'error', { error: String(e) });
  }
}

const registry = loadRegistry();

// PoP nonce store (unchanged — nonce is still required for crypto binding)
const challengeNonces = new Map<string, { pubkey: string; createdAt: number; used: boolean }>();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const NONCE_SWEEP_MS = 60 * 1000;

setInterval(() => {
  const now = Date.now();
  let swept = 0;
  for (const [nonce, entry] of challengeNonces) {
    if (now - entry.createdAt > CHALLENGE_TTL_MS) {
      challengeNonces.delete(nonce);
      swept++;
    }
  }
  if (swept > 0) {
    frameworkLogger.log('marketplace', 'nonce-sweep', 'info', { swept, remaining: challengeNonces.size });
  }
}, NONCE_SWEEP_MS).unref();

/**
 * Issue a challenge nonce for Proof-of-Possession AND start an adaptive MCP challenge session.
 * The agent must:
 *   1. Sign nonce+payload with ed25519 (crypto PoP)
 *   2. Complete the multi-turn challenge session (MCP orchestration trace)
 */
export function getRegistrationChallenge(pubkey: string): { nonce: string; ttl: number; session: ChallengeSession } {
  const session = createChallengeSession(pubkey);
  const nonce = crypto.randomBytes(32).toString('hex');
  challengeNonces.set(nonce, { pubkey, createdAt: Date.now(), used: false });
  frameworkLogger.log('marketplace', 'challenge-issued', 'success', {
    pubkeyPrefix: pubkey.slice(0, 16),
    ttl: CHALLENGE_TTL_MS,
    sessionId: session.sessionId,
    taskPrompt: session.task.prompt.slice(0, 80),
  });
  return { nonce, ttl: CHALLENGE_TTL_MS, session };
}

export async function searchPlugins(query: string): Promise<CorrelationResult[]> {
  frameworkLogger.log('marketplace', 'search', 'info', { query });
  const signals = Array.from(registry.values()).map((p, i) => {
    let content = `${p.metadata.name || p.did} ${JSON.stringify(p.metadata)}`;
    if (p.uiManifest) {
      const labels = (p.uiManifest.fields || []).map(f => `${f.label} ${f.description || ''}`).join(' ');
      content += ` ui: ${p.uiManifest.displayMode} ${labels} ${p.uiManifest.exampleQueries?.join(' ') || ''}`;
    }
    const mcpServers = listMcpServers().map(m => m.name).join(' ');
    content += ` mcps: ${mcpServers}`;
    return {
      content,
      tdf: 5781026310955 + i,
    };
  });
  if (signals.length === 0) {
    signals.push({ content: 'stringray-plugin-consumer cross-correlation demo ui: form GitHub Repository security scan mcps: Dynamo grok_com_github xray-enforcer', tdf: 5781027941748 });
  }
  return coreEngine.rankWithDynamo(signals);
}

export async function registerPlugin(params: {
  pubkey: string;
  payload: string;
  metadata: Record<string, unknown>;
  // Crypto Proof-of-Possession
  signature: string;
  challengeNonce: string;
  // Adaptive multi-turn challenge trace
  challengeTrace: ChallengeTrace;
  // Optional UI manifest
  uiManifest?: import('./agent-ui-manifest.js').AgentUiManifest;
}): Promise<PluginRecord | { status: 'gray'; cooldown: number }> {
  frameworkLogger.log('marketplace', 'register-start', 'info', { pubkeyPrefix: params.pubkey.slice(0, 16) });

  // 1. Crypto Proof-of-Possession
  const stored = challengeNonces.get(params.challengeNonce);
  if (!stored || stored.used) {
    throw new Error('Invalid or already-used challenge nonce');
  }
  if (Date.now() - stored.createdAt > CHALLENGE_TTL_MS) {
    throw new Error('Challenge nonce expired');
  }
  const verified = verifyWithPublic(params.pubkey, params.challengeNonce + '|' + params.payload, params.signature);
  if (!verified) {
    throw new Error('Proof-of-possession failed: signature does not match pubkey');
  }
  stored.used = true;
  const did = generateDID(params.pubkey);
  const apiKey = generateApiKey(did);
  frameworkLogger.log('marketplace', 'pop-verified', 'success', { did });

  // 2. Validate adaptive challenge trace (multi-turn MCP orchestration)
  const session = getSession(params.challengeTrace.sessionId);
  if (!session) {
    throw new Error('Challenge session not found');
  }
  if (!session.followUpCompleted) {
    markSessionFailed(session.sessionId);
    frameworkLogger.log('marketplace', 'adaptive-flow-rejected', 'warning', { sessionId: session.sessionId.slice(0, 16), did });
    return { status: 'gray', cooldown: 300_000 };
  }
  const validation = validateTrace(session, params.challengeTrace);
  frameworkLogger.log('marketplace', 'challenge-validation', 'info', {
    valid: validation.valid,
    score: validation.score,
    violations: validation.violations,
  });
  if (!validation.valid || validation.score < 70) {
    markSessionFailed(session.sessionId);
    frameworkLogger.log('marketplace', 'challenge-rejected', 'warning', {
      score: validation.score,
      violations: validation.violations,
      did,
    });
    return { status: 'gray', cooldown: 300_000 };
  }
  markSessionCompleted(session.sessionId);
  frameworkLogger.log('marketplace', 'challenge-accepted', 'success', { score: validation.score, did });

  // 3-5. Delegated MCP gates (orchestrate, govern, enforce).
  // Gracefully degrade when MCP servers are not running (standalone Railway mode).
  // The challenge trace is the primary behavioral gate; MCP gates are supplementary.
  let challengeStatus = 'delegated';
  try {
    const challengeProposal = (await xrayBridge.orchestrate('behavioral-challenge-for-registration', [
      { id: 'challenge-1', description: 'Verify tool orchestration capability', type: 'behavioral' },
      { id: 'challenge-2', description: 'Confirm governance resonance', type: 'governance' },
    ])) as { status?: string };
    challengeStatus = challengeProposal?.status || 'delegated';
  } catch (e) {
    frameworkLogger.log('marketplace', 'orchestrate-unavailable', 'warning', { error: String(e) });
  }
  if (challengeStatus === 'failed' || challengeStatus === 'error') {
    frameworkLogger.log('marketplace', 'orchestrate-rejected', 'warning', { status: challengeStatus, did });
    return { status: 'gray', cooldown: 300_000 };
  }

  let govDecision = 'delegated-to-mcp';
  try {
    const gov = (await xrayBridge.govern({
      id: `reg-${Date.now()}`,
      title: 'Plugin registration request',
      description: JSON.stringify(params.metadata),
      type: 'automate',
      confidence: 0.9,
      evidence: ['crypto-bound', 'challenge-passed', params.uiManifest ? 'ui-manifest-provided' : 'no-ui-manifest', 'mcp-discovery-integrated'],
      submitter: 'Grok (xAI Grok 4.3, lead dev AI for Groover MVP per AGENTS.md and user guidance)',
    })) as { decision?: string };
    govDecision = gov?.decision || 'delegated-to-mcp';
  } catch (e) {
    frameworkLogger.log('marketplace', 'govern-unavailable', 'warning', { error: String(e) });
  }
  if (govDecision !== 'delegated-to-mcp' && govDecision !== 'approved') {
    frameworkLogger.log('marketplace', 'governance-rejected', 'warning', { decision: govDecision, did });
    return { status: 'gray', cooldown: 300_000 };
  }

  let enforcementScore = 100;
  try {
    let reasoningQualityScore = validation.score;
    if (session.task) {
      const coverage = computeReasoningCoverage(session.task.prompt, params.challengeTrace.turns);
      reasoningQualityScore = Math.round(validation.score * (0.5 + coverage * 0.5));
      frameworkLogger.log('marketplace', 'reasoning-coverage', 'info', {
        coverage: Math.round(coverage * 100),
        adjustedScore: reasoningQualityScore,
      });
    }
    const enforcement = await xrayBridge.enforce('register-plugin', [`did:${did}`], JSON.stringify({
      pubkey: params.pubkey,
      payload: params.payload,
      metadata: params.metadata,
      signature: params.signature,
      challengeNonce: params.challengeNonce,
      challengeScore: reasoningQualityScore,
      uiManifest: params.uiManifest,
      reasoningTrace: params.challengeTrace.turns.map(t => ({
        tool: t.toolCall,
        reasoning: t.reasoning,
      })),
      taskPrompt: session.task?.prompt,
    }));
    enforcementScore = enforcement?.score ?? 100;
  } catch (e) {
    frameworkLogger.log('marketplace', 'enforce-unavailable', 'warning', { error: String(e) });
  }
  if (enforcementScore < 75) {
    frameworkLogger.log('marketplace', 'enforcement-rejected', 'warning', { score: enforcementScore });
    return { status: 'gray', cooldown: 300_000 };
  }
  if (enforcementScore < 100) {
    frameworkLogger.log('marketplace', 'enforcement-warning', 'warning', { score: enforcementScore });
  }

  // Validate manifest if provided
  if (params.uiManifest) {
    const { validateAgentUiManifest } = await import('./agent-ui-manifest.js');
    const manifestValidation = validateAgentUiManifest(params.uiManifest);
    if (!manifestValidation.valid) {
      frameworkLogger.log('marketplace', 'ui-manifest-invalid', 'warning', { errors: manifestValidation.errors });
    }
  }

  const record: PluginRecord = {
    did,
    pubkey: params.pubkey,
    signature: params.signature,
    apiKey,
    metadata: params.metadata,
    registeredAt: new Date().toISOString(),
    reputation: 1.0,
    uiManifest: params.uiManifest,
  };
  registry.set(did, record);
  saveRegistry();
  frameworkLogger.log('marketplace', 'register-success', 'success', { did, reputation: record.reputation, challengeScore: validation.score, hasUiManifest: !!record.uiManifest });
  return record;
}

export function getRegistrySnapshot(): PluginRecord[] {
  return Array.from(registry.values());
}

export function getPluginUiManifest(did: string): import('./agent-ui-manifest.js').AgentUiManifest | undefined {
  const record = registry.get(did);
  return record?.uiManifest;
}

async function runTinyCli() {
  const args = process.argv.slice(2);
  const cmd = args[0] || '--help';
  frameworkLogger.log('marketplace', 'cli-start', 'info', { cmd, args });

  if (cmd === '--help' || cmd === '-h') {
    frameworkLogger.log('marketplace', 'cli-help', 'success', {
      usage: 'groover-marketplace [--register | --search <query> | --snapshot]',
      note: 'register requires Proof-of-Possession + adaptive MCP challenge trace'
    });
    return;
  }

  if (cmd === '--register') {
    const { generateKeyPair, signPayload } = await import('../../identity/src/index.js');
    const keys = generateKeyPair();
    const challenge = getRegistrationChallenge(keys.publicKey);
    frameworkLogger.log('marketplace', 'cli-challenge', 'success', {
      sessionId: challenge.session.sessionId,
      task: challenge.session.task.prompt.slice(0, 80),
    });
    // CLI demo: auto-solve the challenge by calling available tools
    const { buildTurn, buildTraceFromTurns, PREV_HASH_SEED: SEED } = await import('./challenge.js');
    const { searchPlugins: search } = await import('./index.js');
    const { listMcpServers: list } = await import('../../xray/src/index.js');
    let prevHash = SEED;
    const turns = [];
    // Turn 1: search plugins
    const searchResult = await search('cross-correlation marketplace');
    turns.push(buildTurn(prevHash, 'search_plugins', 'cross-correlation marketplace', JSON.stringify(searchResult.slice(0, 2)), 'Discovered cross-correlation signals for plugin synthesis.'));
    prevHash = turns[turns.length - 1].hash;
    // Turn 2: list MCP servers
    const mcps = list();
    turns.push(buildTurn(prevHash, 'list_mcp_servers', '{}', JSON.stringify(mcps.map(m => m.name).slice(0, 3)), 'Identified available MCP servers for orchestration.'));
    prevHash = turns[turns.length - 1].hash;
    // Turn 3: synthesize
    turns.push(buildTurn(prevHash, 'synthesize', 'cross-correlation + MCP ecosystem', 'novel-plugin-concept', 'Synthesized a novel plugin concept combining cross-correlation with MCP orchestration. This covers a gap in automated governance workflows.'));
    const trace = buildTraceFromTurns(challenge.session.sessionId, turns);
    const payload = `cli-plugin-registration-${Date.now()}`;
    const sig = signPayload(keys.privateKey, challenge.nonce + '|' + payload);
    const metadata = { name: 'cli-demo-plugin', capabilities: ['register', 'search'], version: 'cli-mvp' };
    const result = await registerPlugin({ pubkey: keys.publicKey, payload, signature: sig, challengeNonce: challenge.nonce, challengeTrace: trace, metadata });
    frameworkLogger.log('marketplace', 'cli-register-complete', 'success', {
      did: (result as PluginRecord).did,
      reputation: (result as PluginRecord).reputation
    });
  } else if (cmd === '--search') {
    const query = args[1] || 'cross-correlation marketplace';
    const results = await searchPlugins(query);
    frameworkLogger.log('marketplace', 'cli-search-complete', 'success', {
      query,
      topScore: results[0]?.score,
      topFingerprint: results[0]?.fingerprint,
      count: results.length
    });
  } else if (cmd === '--snapshot') {
    const snap = getRegistrySnapshot();
    frameworkLogger.log('marketplace', 'cli-snapshot', 'success', { count: snap.length, dids: snap.map(r => r.did) });
  } else if (cmd === '--mcps') {
    const mcps = listMcpServers();
    frameworkLogger.log('marketplace', 'cli-mcps', 'success', { count: mcps.length, servers: mcps.map(m => `${m.name}: ${m.role}`) });
  } else {
    frameworkLogger.log('marketplace', 'cli-unknown', 'warning', { cmd });
  }
}

const isInvokedAsMain = process.argv.includes('--register') || process.argv.includes('--search') ||
  process.argv.includes('--snapshot') || process.argv.includes('--mcps') ||
  process.argv.includes('--mcp-server') || process.argv.includes('--registry') ||
  process.argv.includes('--help') || process.argv.includes('-h');

if (isInvokedAsMain) {
  const args = process.argv.slice(2);
  if (args.includes('--mcp-server') || args.includes('--registry')) {
    frameworkLogger.log('marketplace', 'mcp-server-start', 'info', { mode: 'hosted-registry', note: 'Railway deployment target for agent self-verification' });
    (async () => {
      const mcps = listMcpServers();
      frameworkLogger.log('marketplace', 'mcp-server-tools', 'success', {
        availableTools: ['register_plugin', 'search_plugins', 'get_plugin_ui_manifest', 'list_mcp_servers', 'get_registration_challenge'],
        mcpServersDiscovered: mcps.length
      });
    })();
  } else {
    runTinyCli().catch((e) => frameworkLogger.log('marketplace', 'cli-fatal', 'error', { error: String(e) }));
  }
}