/**
 * Adaptive Multi-Turn MCP Orchestration Challenge for AI agent verification.
 *
 * Replaces trivial deterministic puzzles with a stateful challenge that requires:
 * - Real MCP tool orchestration (calling actual registry/governance tools)
 * - Reasoning across multiple turns
 * - Self-critique and signed attestation
 * - Cryptographic trace integrity (hash chain + Merkle root)
 *
 * This is "just good enough": real 0xRay/Groover agents already run this way;
 * scripts/humans need to maintain full agent infrastructure per attempt.
 */
import * as crypto from 'crypto';

// --- Types ---

export interface ChallengeTask {
  prompt: string;
  requiredTools: string[];
  minTurns: number;
  minDurationMs: number;
}

export interface ChallengeTurn {
  toolCall: string;
  input: string;
  output: string;
  reasoning: string;
  timestamp: number;
  hash: string;
}

export interface ChallengeTrace {
  sessionId: string;
  turns: ChallengeTurn[];
  merkleRoot: string;
  attestation: string;
}

export type ChallengeStatus = 'pending' | 'in-progress' | 'completed' | 'expired' | 'failed';

export interface ChallengeSession {
  sessionId: string;
  pubkey: string;
  createdAt: number;
  completedAt?: number;
  task: ChallengeTask;
  turns: ChallengeTurn[];
  status: ChallengeStatus;
  failCount: number;
  rateLimitedUntil: number;
  followUpPrompt?: string;
  followUpCompleted?: boolean;
  adaptiveTurnIndex?: number;
}

/** Extract Dynamo resonance from metrics object (0.0–1.0). */
export function computeDynamoResonance(metrics?: any): number {
  if (!metrics || typeof metrics.resonance !== 'number') return 0.0;
  return Math.max(0, Math.min(1.0, metrics.resonance));
}

// --- Task Prompts ---
// Each requires genuine tool orchestration, reasoning, and self-critique.
// Rotated periodically to prevent farming.

const TASKS: ChallengeTask[] = [
  {
    prompt: 'Using the Groover registry, discover 2-3 relevant plugins for temporal governance or reversible capital. Cross-correlate them with current Sui ecosystem signals. Synthesize one novel plugin idea. Self-critique for alignment, edge cases, and governance resonance.',
    requiredTools: ['search_plugins', 'list_mcp_servers'],
    minTurns: 3,
    minDurationMs: 3000,
  },
  {
    prompt: 'Identify a gap in the current MCP plugin ecosystem. Propose a concrete multi-agent workflow using at least two tools. Reason step-by-step about potential failure modes and mitigation strategies using Dynamo governance principles.',
    requiredTools: ['search_plugins'],
    minTurns: 3,
    minDurationMs: 4000,
  },
];

// --- Session Store ---

const sessions = new Map<string, ChallengeSession>();
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_FAIL_COUNT = 3;
const BASE_BACKOFF_MS = 30 * 1000; // 30 sec base backoff

// Periodic TTL sweep
setInterval(() => {
  const now = Date.now();
  let swept = 0;
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      session.status = 'expired';
      sessions.delete(id);
      swept++;
    }
  }
  if (swept > 0) {
    // silent — no frameworkLogger import here to keep challenge module standalone
  }
}, 60 * 1000).unref();

// --- Session Management ---

export function createChallengeSession(pubkey: string): ChallengeSession {
  // Rate limit: exponential backoff after failures
  const existing = findSessionByPubkey(pubkey);
  if (existing && existing.failCount >= MAX_FAIL_COUNT) {
    const backoffMs = BASE_BACKOFF_MS * Math.pow(2, existing.failCount - MAX_FAIL_COUNT);
    const retryAt = existing.rateLimitedUntil + backoffMs;
    if (Date.now() < retryAt) {
      throw new Error(`Rate limited. Retry after ${Math.ceil((retryAt - Date.now()) / 1000)}s.`);
    }
  }

  const sessionId = crypto.randomBytes(24).toString('hex');
  const task = TASKS[Math.floor(Math.random() * TASKS.length)];
  const session: ChallengeSession = {
    sessionId,
    pubkey,
    createdAt: Date.now(),
    task,
    turns: [],
    status: 'pending',
    failCount: 0,
    rateLimitedUntil: 0,
  };
  sessions.set(sessionId, session);
  return session;
}

function findSessionByPubkey(pubkey: string): ChallengeSession | undefined {
  for (const session of sessions.values()) {
    if (session.pubkey === pubkey) return session;
  }
  return undefined;
}

export function getSession(sessionId: string): ChallengeSession | undefined {
  return sessions.get(sessionId);
}

// --- Adaptive Follow-up ---

export function generateFollowUp(session: ChallengeSession): string {
  const lastTurn = session.turns[session.turns.length - 1];
  const priorReasoning = lastTurn?.reasoning?.slice(0, 60) || 'your prior analysis';
  const priorTool = lastTurn?.toolCall || 'exploration';

  const prompts = [
    `Your ${priorTool} work touched on "${priorReasoning}...". Now search the registry for plugins related to this concept and critique how they compare — use search_plugins.`,
    `Based on your insight "${priorReasoning}...", investigate which MCP servers would implement this. Use list_mcp_servers and cross-reference.`,
    `You mentioned "${priorReasoning}...". Now search the Groover registry for existing solutions addressing this gap and explain how your approach differs — use search_plugins.`,
    `Follow up on "${priorReasoning}...". Look up current governance signals in the registry via search_plugins, then critique alignment.`,
  ];
  return prompts[Math.floor(Math.random() * prompts.length)];
}

export function computeFollowUpDigest(followUpPrompt: string): string {
  return crypto.createHash('sha256').update(followUpPrompt).digest('hex').slice(0, 16);
}

export function submitTurn(
  sessionId: string,
  turn: { toolCall: string; input: string; output: string; reasoning: string; timestamp: number; hash: string }
): { followUpPrompt: string | null } {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Challenge session not found');

  session.turns.push(turn as ChallengeTurn);
  if (session.status === 'pending') session.status = 'in-progress';

  let followUpPrompt: string | null = null;
  if (session.turns.length >= session.task.minTurns && !session.followUpPrompt) {
    followUpPrompt = generateFollowUp(session);
    session.followUpPrompt = followUpPrompt;
    session.adaptiveTurnIndex = session.turns.length;
  }

  if (session.followUpPrompt && !session.followUpCompleted && session.turns.length >= (session.adaptiveTurnIndex || 0) + 1) {
    const r = turn.reasoning || '';
    if (r.length >= 30 && turn.toolCall.length > 0) {
      session.followUpCompleted = true;
    }
  }

  return { followUpPrompt };
}

// --- Trace Building (client-side) ---

export const PREV_HASH_SEED = 'groover-challenge-seed-v1';

export function computeTurnHash(prevHash: string, turn: Omit<ChallengeTurn, 'hash'>): string {
  const content = JSON.stringify({
    prevHash,
    toolCall: turn.toolCall,
    input: turn.input,
    output: turn.output,
    reasoning: turn.reasoning,
    timestamp: turn.timestamp,
  });
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function computeMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return crypto.createHash('sha256').update('empty').digest('hex');
  if (hashes.length === 1) return hashes[0];
  let level = hashes;
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      next.push(crypto.createHash('sha256').update(left + right).digest('hex'));
    }
    level = next;
  }
  return level[0];
}

export function buildTurn(prevHash: string, toolCall: string, input: string, output: string, reasoning: string): ChallengeTurn {
  const turn: Omit<ChallengeTurn, 'hash'> & { hash?: string } = {
    toolCall,
    input,
    output,
    reasoning,
    timestamp: Date.now(),
  };
  turn.hash = computeTurnHash(prevHash, turn);
  return turn as ChallengeTurn;
}

export function buildTraceFromTurns(sessionId: string, turns: ChallengeTurn[]): ChallengeTrace {
  const merkleRoot = computeMerkleRoot(turns.map(t => t.hash));
  const attestation = computeMerkleRoot([merkleRoot, sessionId]);
  return { sessionId, turns, merkleRoot, attestation };
}

// --- Validation (server-side) ---

export interface ValidationResult {
  valid: boolean;
  score: number;
  violations: string[];
}

export interface ValidateTraceOptions {
  dynamoMetrics?: { resonance?: number };
}

export function validateTrace(session: ChallengeSession, trace: ChallengeTrace, options?: ValidateTraceOptions): ValidationResult {
  const violations: string[] = [];
  let score = 0;
  const dynamoResonance = computeDynamoResonance(options?.dynamoMetrics);
  const isPrivileged = dynamoResonance >= 0.8;
  const effectiveMinTurns = isPrivileged ? Math.max(2, session.task.minTurns - 1) : session.task.minTurns;
  const effectiveCoverageThreshold = isPrivileged ? 0.125 : 0.25;

  // 1. Session must exist and be pending/in-progress
  if (!session || (session.status !== 'pending' && session.status !== 'in-progress')) {
    violations.push('invalid-session');
    return { valid: false, score: 0, violations };
  }

  // 2. Session must not be expired
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    violations.push('session-expired');
    return { valid: false, score: 0, violations };
  }

  // 3. Session ID must match
  if (trace.sessionId !== session.sessionId) {
    violations.push('session-id-mismatch');
    return { valid: false, score: 0, violations };
  }

  // 4. Minimum turns
  if (trace.turns.length < effectiveMinTurns) {
    violations.push(`too-few-turns: ${trace.turns.length} < ${effectiveMinTurns} (resonance: ${dynamoResonance.toFixed(2)})`);
  } else {
    score += 25;
  }

  // 5. Minimum duration
  if (trace.turns.length >= 2) {
    const duration = trace.turns[trace.turns.length - 1].timestamp - trace.turns[0].timestamp;
    if (duration < session.task.minDurationMs) {
      violations.push(`too-fast: ${duration}ms < ${session.task.minDurationMs}ms`);
    } else {
      score += 10;
    }
  } else {
    violations.push('insufficient-turns-for-duration-check');
  }

  // 6. Required tools must appear in the trace
  const toolCalls = trace.turns.map(t => t.toolCall);
  for (const required of session.task.requiredTools) {
    if (!toolCalls.includes(required)) {
      violations.push(`missing-required-tool: ${required}`);
    }
  }
  const coverRatio = session.task.requiredTools.filter(t => toolCalls.includes(t)).length / session.task.requiredTools.length;
  score += Math.round(15 * coverRatio);

  // 7. Hash chain integrity
  let prevHash = PREV_HASH_SEED;
  for (let i = 0; i < trace.turns.length; i++) {
    const turn = trace.turns[i];
    const expected = computeTurnHash(prevHash, {
      toolCall: turn.toolCall,
      input: turn.input,
      output: turn.output,
      reasoning: turn.reasoning,
      timestamp: turn.timestamp,
    });
    if (turn.hash !== expected) {
      violations.push(`hash-chain-broken-at-turn-${i}`);
    }
    prevHash = turn.hash;
  }
  if (!violations.some(v => v.startsWith('hash-chain-broken'))) {
    score += 20;
  }

  // 8. Merkle root must be correct
  const expectedMerkle = computeMerkleRoot(trace.turns.map(t => t.hash));
  if (trace.merkleRoot !== expectedMerkle) {
    violations.push('merkle-root-mismatch');
  } else {
    score += 10;
  }

  // 9. Attestation must be derivable from merkle root + sessionId
  const expectedAttestation = computeMerkleRoot([trace.merkleRoot, trace.sessionId]);
  if (trace.attestation !== expectedAttestation) {
    violations.push('attestation-mismatch');
  } else {
    score += 10;
  }

  // 10. Each turn must have non-empty reasoning
  for (let i = 0; i < trace.turns.length; i++) {
    if (!trace.turns[i].reasoning || trace.turns[i].reasoning.trim().length < 20) {
      violations.push(`shallow-reasoning-at-turn-${i}`);
    }
  }

  // 11. Adaptive follow-up: only required if the session has a follow-up prompt
  if (session.followUpPrompt) {
    if (trace.turns.length < effectiveMinTurns + 1) {
      violations.push(`missing-adaptive-turn: ${trace.turns.length} < ${effectiveMinTurns + 1}`);
    } else {
      score += 15;
    }
  }

  // 12. Semantic reasoning vs task prompt keyword coverage
  const coverage = computeReasoningCoverage(session.task.prompt, trace.turns);
  if (coverage < effectiveCoverageThreshold) {
    violations.push(`low-reasoning-coverage: ${Math.round(coverage * 100)}%`);
  }

  const valid = violations.length === 0 && score >= 70;
  return { valid, score, violations };
}

const STOP_WORDS = new Set([
  'about', 'above', 'after', 'again', 'against', 'being', 'below', 'between',
  'could', 'did', 'does', 'done', 'down', 'each', 'few', 'from', 'further',
  'here', 'just', 'like', 'more', 'most', 'much', 'must', 'only', 'other',
  'over', 'same', 'should', 'some', 'such', 'than', 'that', 'their', 'them',
  'then', 'there', 'these', 'they', 'this', 'those', 'through', 'too', 'under',
  'very', 'was', 'were', 'what', 'when', 'where', 'which', 'while', 'with',
  'your', 'have', 'into', 'also', 'will', 'after', 'before',
]);

export function computeReasoningCoverage(taskPrompt: string, turns: ChallengeTurn[]): number {
  const significantTerms = taskPrompt
    .toLowerCase()
    .replace(/[^a-z0-9_\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 4 && !STOP_WORDS.has(w));

  if (significantTerms.length === 0) return 1.0;

  const allReasoning = turns.map(t => t.reasoning?.toLowerCase() || '').join(' ');
  const reasoningWords = allReasoning.split(/\s+/);

  const matched = significantTerms.filter(term => {
    const prefix = term.slice(0, 5);
    return reasoningWords.some(w => w.startsWith(prefix) || w.includes(term));
  }).length;

  return matched / significantTerms.length;
}

export function markSessionCompleted(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.status = 'completed';
    session.completedAt = Date.now();
  }
}

export function markSessionFailed(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.failCount++;
    session.rateLimitedUntil = Date.now();
    if (session.failCount >= MAX_FAIL_COUNT) {
      const backoffMs = BASE_BACKOFF_MS * Math.pow(2, session.failCount - MAX_FAIL_COUNT);
      session.rateLimitedUntil = Date.now() + backoffMs;
    }
  }
}