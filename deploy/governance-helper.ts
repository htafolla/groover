/**
 * Provider-agnostic governance helper for Groover engagement scripts.
 *
 * Curated signals path resolution (in order):
 * 1. CURATED_SIGNALS_PATH env var (absolute or relative to cwd)
 * 2. research/repertoire-brain/curated_signals.json (persistent brain location)
 */

import {
  readFileSync,
  existsSync,
  mkdirSync,
  appendFileSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CURATED_SIGNALS_PATH = join(__dirname, '..', 'curated_signals.json');

const MIN_TAG_LENGTH_FOR_LOOSE_MATCH = 6;
const DEFAULT_MIN_MATCH_CONFIDENCE = 0.55;

export interface CuratedSignal {
  name: string;
  tags: string[];
  evaluation_criteria: string;
  priority?: string;
}

export interface GovernOptions {
  agentDid: string;
  inferenceType?: string;
  matchedPrimitives?: string[];
  force?: boolean;
  deliberationSummary?: string;
}

export interface StructuredGovernanceProposal {
  summary: string;
  source: 'agent';
  intent: string;
  tags: string[];
  scope: 'agent';
}

export interface GovernanceProposalPayload {
  structuredProposal: StructuredGovernanceProposal;
}

export interface DynamoHammerEnvelope {
  recommendation?: 'PASS' | 'NEEDS_REVISION' | 'REJECT' | string;
  resonanceScore?: number;
  structuralResonance?: number;
  proximity?: number;
  phaseAlignment?: number;
  vortexAlignment?: number;
  synchronization?: number;
  signalTiming?: 'leading' | 'trailing' | 'synced' | string;
  hybridVerdict?: string;
  fullBox7DVerdict?: string;
  fullBox7DComposite?: number;
  signalPurity?: number;
  hammerReason?: string;
  phaseType?: 'push' | 'pull' | string;
  isotope?: string;
  smoothedResonance?: number;
  trend?: string;
  moralNumerologicalTension?: string;
  trinitariumDetectedConcerns?: string[];
  solarContext?: { solarActivityLevel?: string };
  neuralContextUsed?: boolean;
}

/** @deprecated Use DynamoHammerEnvelope — kept for call-site compatibility */
export type DynamoGovernanceResult = DynamoHammerEnvelope;

export interface DynamoResponse {
  result?: DynamoHammerEnvelope;
}

export interface DeliberationVote {
  server: string;
  decision: string;
  confidence: number;
  reasoning?: string;
}

export type DeliberationRoundOutcome =
  | { ok: true; votes: DeliberationVote[]; summary: string }
  | { ok: false; message: string; votes: DeliberationVote[] };

export type GovernanceCallOutcome =
  | { ok: true; data: DynamoResponse; matchedPrimitives: string[] }
  | { ok: false; error: true; status?: number; message: string; matchedPrimitives: string[] };

export interface PrimitiveMatch {
  name: string;
  confidence: number;
}

export interface RepertoireRoutingLogFields {
  consulted: boolean;
  providerAvailable: boolean;
  highConfidenceTrapPresent: boolean;
  ontologicalTrapDetected: boolean;
  recommendedAgent: string | null;
  matchedSignals: string[];
  avgConfidence: number;
  maxConfidence: number;
  complexityBoost: number;
}

export interface InferenceLogEntry {
  timestamp: string;
  source: string;
  post_id: string;
  post_title?: string;
  comment_id?: string;
  type?: string;
  inference: string;
  public_reply: string;
  inference_type?: string;
  matched_primitives: string[];
  match_confidence: Record<string, number>;
  repertoire_signals: string[];
  repertoire_routing?: RepertoireRoutingLogFields;
  governance_forced: boolean;
  deliberation_rounds?: DeliberationVote[];
  dynamo_result: {
    result: DynamoHammerEnvelope | null;
    matchedPrimitives: string[];
    error?: string;
    status?: number;
  };
}

const MAX_PROPOSAL_SUMMARY_LENGTH = 8000;
const INTERNAL_DELIBERATION_SERVERS = new Set([
  'code-review',
  'security-audit',
  'researcher',
]);

interface SignalIndex {
  signals: CuratedSignal[];
  ontologicalTrapNames: string[];
}

let cachedSignals: CuratedSignal[] | null = null;
let cachedIndex: SignalIndex | null = null;
let signalsOverride: CuratedSignal[] | null | undefined;

export function resolveCuratedSignalsPath(): string {
  return process.env.CURATED_SIGNALS_PATH ?? DEFAULT_CURATED_SIGNALS_PATH;
}

export function resetGovernanceHelperState(): void {
  cachedSignals = null;
  cachedIndex = null;
  signalsOverride = undefined;
}

/** Test-only: inject signals without reading curated_signals.json from disk. */
export function setCuratedSignalsForTesting(signals: CuratedSignal[] | null): void {
  signalsOverride = signals;
  cachedSignals = null;
  cachedIndex = null;
}

export function loadCuratedSignals(): CuratedSignal[] {
  if (cachedSignals) return cachedSignals;

  if (signalsOverride !== undefined) {
    cachedSignals = signalsOverride ?? [];
    cachedIndex = buildSignalIndex(cachedSignals);
    return cachedSignals;
  }

  const path = resolveCuratedSignalsPath();

  if (!existsSync(path)) {
    cachedSignals = [];
    cachedIndex = buildSignalIndex([]);
    return cachedSignals;
  }

  const data = JSON.parse(readFileSync(path, 'utf8'));
  cachedSignals = (data.signals ?? []) as CuratedSignal[];
  cachedIndex = buildSignalIndex(cachedSignals);
  return cachedSignals;
}

function buildSignalIndex(signals: CuratedSignal[]): SignalIndex {
  return {
    signals,
    ontologicalTrapNames: signals
      .filter((signal) => signal.tags.includes('ontological-trap'))
      .map((signal) => signal.name),
  };
}

function getSignalIndex(): SignalIndex {
  loadCuratedSignals();
  return cachedIndex ?? buildSignalIndex([]);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenPattern(token: string): RegExp {
  const escaped = escapeRegExp(token).replace(/-/g, '[\\s-]');
  return new RegExp(`(?:^|[^a-z0-9-])${escaped}(?:[^a-z0-9-]|$)`, 'i');
}

function scoreSignalMatch(signal: CuratedSignal, normalized: string): number {
  const namePattern = tokenPattern(signal.name);
  if (namePattern.test(normalized)) return 1;

  const spacedName = signal.name.replace(/-/g, ' ');
  if (spacedName !== signal.name && tokenPattern(spacedName).test(normalized)) {
    return 0.9;
  }

  let bestTagScore = 0;
  for (const tag of signal.tags) {
    const tagLower = tag.toLowerCase();
    if (tagLower.length < MIN_TAG_LENGTH_FOR_LOOSE_MATCH) continue;
    if (tokenPattern(tagLower).test(normalized)) {
      bestTagScore = Math.max(bestTagScore, tagLower.includes('-') ? 0.75 : 0.6);
    }
  }

  return bestTagScore;
}

export function isOntologicalTrap(inference: string): boolean {
  return /TYPE:\s*ontological-trap/i.test(inference);
}

export function shouldForceGovernance(inference: string): boolean {
  return isOntologicalTrap(inference);
}

export function matchPrimitivesFromInference(
  inference: string,
  options: { minConfidence?: number } = {},
): PrimitiveMatch[] {
  const minConfidence = options.minConfidence ?? DEFAULT_MIN_MATCH_CONFIDENCE;
  const index = getSignalIndex();
  const normalized = inference.toLowerCase();
  const matches = new Map<string, number>();

  for (const signal of index.signals) {
    const confidence = scoreSignalMatch(signal, normalized);
    if (confidence >= minConfidence) {
      matches.set(signal.name, Math.max(matches.get(signal.name) ?? 0, confidence));
    }
  }

  if (isOntologicalTrap(inference)) {
    for (const name of index.ontologicalTrapNames) {
      matches.set(name, Math.max(matches.get(name) ?? 0, 1));
    }
  }

  return [...matches.entries()]
    .map(([name, confidence]) => ({ name, confidence }))
    .sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));
}

export function matchedPrimitiveNames(
  inference: string,
  options: { minConfidence?: number } = {},
): string[] {
  return matchPrimitivesFromInference(inference, options).map((match) => match.name);
}

export function buildGovernanceProposal(
  title: string,
  content: string,
  options: GovernOptions,
): GovernanceProposalPayload {
  const summary = [
    title,
    content,
    options.deliberationSummary,
    options.matchedPrimitives?.length
      ? `Matched primitives: ${options.matchedPrimitives.join(', ')}`
      : '',
    options.inferenceType ? `Inference type: ${options.inferenceType}` : '',
    options.force ? 'Governance forced: true' : '',
    `Agent: ${options.agentDid}`,
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, MAX_PROPOSAL_SUMMARY_LENGTH);

  return {
    structuredProposal: {
      summary,
      source: 'agent',
      intent: 'groover-engage',
      tags: options.matchedPrimitives ?? [],
      scope: 'agent',
    },
  };
}

export function parseDynamoHammerEnvelope(raw: unknown): DynamoHammerEnvelope | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const solarContext =
    r.solarContext && typeof r.solarContext === 'object'
      ? { solarActivityLevel: (r.solarContext as Record<string, unknown>).solarActivityLevel as string | undefined }
      : undefined;

  return {
    recommendation: r.recommendation as DynamoHammerEnvelope['recommendation'],
    resonanceScore:
      typeof r.resonanceScore === 'number'
        ? r.resonanceScore
        : typeof r.structuralResonance === 'number'
          ? r.structuralResonance
          : undefined,
    structuralResonance: r.structuralResonance as number | undefined,
    proximity: r.proximity as number | undefined,
    phaseAlignment: r.phaseAlignment as number | undefined,
    vortexAlignment: r.vortexAlignment as number | undefined,
    synchronization: r.synchronization as number | undefined,
    signalTiming: r.signalTiming as DynamoHammerEnvelope['signalTiming'],
    hybridVerdict: r.hybridVerdict as string | undefined,
    fullBox7DVerdict: r.fullBox7DVerdict as string | undefined,
    fullBox7DComposite: r.fullBox7DComposite as number | undefined,
    signalPurity: r.signalPurity as number | undefined,
    hammerReason: r.hammerReason as string | undefined,
    phaseType: r.phaseType as DynamoHammerEnvelope['phaseType'],
    isotope: r.isotope as string | undefined,
    smoothedResonance: r.smoothedResonance as number | undefined,
    trend: r.trend as string | undefined,
    moralNumerologicalTension: r.moralNumerologicalTension as string | undefined,
    trinitariumDetectedConcerns: Array.isArray(r.trinitariumDetectedConcerns)
      ? (r.trinitariumDetectedConcerns as string[])
      : undefined,
    solarContext,
    neuralContextUsed: r.neuralContextUsed as boolean | undefined,
  };
}

export function unwrapDynamoConnectedToolResponse(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = raw as Record<string, unknown>;
  if (obj.success === true && obj.result !== undefined) return obj.result;
  return raw;
}

export function buildDeliberationSummary(votes: DeliberationVote[]): string {
  if (votes.length === 0) return '';
  return votes
    .map(
      (vote) =>
        `${vote.server}: ${vote.decision} (${(vote.confidence * 100).toFixed(0)}%)${vote.reasoning ? ` — ${vote.reasoning.slice(0, 200)}` : ''}`,
    )
    .join('\n');
}

export function formatDynamoLog(
  outcome: GovernanceCallOutcome | DynamoResponse | null | undefined,
): string {
  if (!outcome) return 'rec=N/A resonance=N/A';

  if ('ok' in outcome) {
    if (!outcome.ok) {
      const status = outcome.status ? ` status=${outcome.status}` : '';
      return `rec=N/A resonance=N/A error=${outcome.message}${status}`;
    }
    return formatDynamoResult(outcome.data.result);
  }

  return formatDynamoResult(outcome.result);
}

function formatDynamoResult(result: DynamoHammerEnvelope | undefined): string {
  const rec = result?.recommendation ?? 'N/A';
  const resonance =
    typeof result?.resonanceScore === 'number'
      ? result.resonanceScore.toFixed(3)
      : 'N/A';
  const parts = [`rec=${rec}`, `resonance=${resonance}`];
  if (typeof result?.phaseAlignment === 'number') {
    parts.push(`phase=${result.phaseAlignment.toFixed(3)}`);
  }
  if (typeof result?.synchronization === 'number') {
    parts.push(`sync=${result.synchronization.toFixed(3)}`);
  }
  if (result?.signalTiming) parts.push(`timing=${result.signalTiming}`);
  if (typeof result?.signalPurity === 'number') {
    parts.push(`purity=${result.signalPurity.toFixed(3)}`);
  }
  return parts.join(' ');
}

export function extractDynamoResult(
  outcome: GovernanceCallOutcome | null | undefined,
): DynamoHammerEnvelope | null {
  if (!outcome || !outcome.ok) return null;
  return outcome.data.result ?? null;
}

/**
 * Unified Dynamo gate for live + dry-run: block only when governance succeeded,
 * recommendation is not PASS, and resonance is below threshold.
 */
export function shouldBlockDynamoAction(
  outcome: GovernanceCallOutcome | null | undefined,
  threshold = 0.75,
): boolean {
  if (!outcome?.ok) return false;
  const result = outcome.data.result;
  const rec = result?.recommendation;
  const resonance = result?.resonanceScore ?? 0;
  if (rec === 'PASS') return false;
  return resonance < threshold;
}

export async function callGovernWithSolar(
  mcpUrl: string,
  title: string,
  content: string,
  options: {
    agentDid: string;
    inference?: string;
    force?: boolean;
    deliberationSummary?: string;
  },
): Promise<GovernanceCallOutcome> {
  const inference = options.inference ?? content;
  const primitiveMatches = matchPrimitivesFromInference(inference);
  const matchedPrimitives = primitiveMatches.map((match) => match.name);

  const proposal = buildGovernanceProposal(title, content, {
    agentDid: options.agentDid,
    inferenceType: isOntologicalTrap(inference) ? 'ontological-trap' : undefined,
    matchedPrimitives,
    force: options.force ?? shouldForceGovernance(inference),
    deliberationSummary: options.deliberationSummary,
  });

  try {
    const res = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: 'govern_with_solar',
        params: {
          structuredProposal: proposal.structuredProposal,
          baseVoteWeight: 1.0,
          spectralQuality: 0.9,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        error: true,
        status: res.status,
        message: text || `HTTP ${res.status}`,
        matchedPrimitives,
      };
    }

    const raw = await res.json();
    const hammer = parseDynamoHammerEnvelope(unwrapDynamoConnectedToolResponse(raw));
    return { ok: true, data: { result: hammer ?? undefined }, matchedPrimitives };
  } catch (error) {
    return {
      ok: false,
      error: true,
      message: String(error),
      matchedPrimitives,
    };
  }
}

function mapInternalDeliberationVotes(
  votes: Array<{
    server?: string;
    decision?: string;
    confidence?: number;
    reasoning?: string;
  }>,
): DeliberationVote[] {
  return votes
    .filter((vote) => vote.server && INTERNAL_DELIBERATION_SERVERS.has(vote.server))
    .map((vote) => ({
      server: vote.server!,
      decision: vote.decision ?? 'abstain',
      confidence: typeof vote.confidence === 'number' ? vote.confidence : 0.5,
      reasoning: vote.reasoning,
    }));
}

async function callRemoteDeliberationRound(params: {
  title: string;
  description: string;
  evidence: string[];
  mcpUrl: string;
  mcpPath: string;
  timeoutMs: number;
}): Promise<DeliberationRoundOutcome> {
  const { McpStreamableClient } = await import('./mcp-streamable-client.js');

  const client = new McpStreamableClient({
    baseUrl: params.mcpUrl,
    mcpPath: params.mcpPath,
    apiKey: process.env.GOVERNANCE_API_KEY,
    timeoutMs: params.timeoutMs,
  });

  const parsed = (await client.callTool('govern_proposals', {
    proposals: [
      {
        id: `groover-delib-${Date.now()}`,
        type: 'strategic',
        title: params.title,
        description: params.description,
        evidence: params.evidence,
        confidence: 0.85,
        source: 'inference',
      },
    ],
    options: { require_external: false },
  })) as {
    results?: Array<{
      votes?: Array<{
        server?: string;
        decision?: string;
        confidence?: number;
        reasoning?: string;
      }>;
    }>;
  };

  const votes = mapInternalDeliberationVotes(parsed.results?.[0]?.votes ?? []);
  return { ok: true, votes, summary: buildDeliberationSummary(votes) };
}

export async function callDeliberationRound(params: {
  title: string;
  description: string;
  evidence: string[];
  mcpUrl?: string;
  mcpPath?: string;
  timeoutMs?: number;
}): Promise<DeliberationRoundOutcome> {
  const timeoutMs = params.timeoutMs ?? 60_000;
  const remoteUrl =
    params.mcpUrl ?? (process.env.GOVERNANCE_MCP_URL?.trim() || undefined);

  try {
    if (remoteUrl) {
      const { XRAY_GOVERNANCE_MCP_PATH } = await import('./engage-config.js');
      return await callRemoteDeliberationRound({
        title: params.title,
        description: params.description,
        evidence: params.evidence,
        mcpUrl: remoteUrl.replace(/\/$/, ''),
        mcpPath: params.mcpPath ?? process.env.GOVERNANCE_MCP_PATH ?? XRAY_GOVERNANCE_MCP_PATH,
        timeoutMs,
      });
    }

    const { callLocalGovernanceDeliberation } = await import('./local-governance.js');
    const local = await callLocalGovernanceDeliberation({
      title: params.title,
      description: params.description,
      evidence: params.evidence,
      timeoutMs,
    });

    if (!local.ok) {
      return { ok: false, message: local.message ?? 'local governance failed', votes: [] };
    }

    const votes = mapInternalDeliberationVotes(local.votes);
    return { ok: true, votes, summary: buildDeliberationSummary(votes) };
  } catch (error) {
    return { ok: false, message: String(error), votes: [] };
  }
}

export function buildInferenceLogEntry(params: {
  source: string;
  postId: string;
  postTitle?: string;
  commentId?: string;
  type?: string;
  inference: string;
  publicReply: string;
  govOutcome: GovernanceCallOutcome | null;
  repertoireRouting?: RepertoireRoutingLogFields;
  /** Pre-inference signals from Repertoire consult (distinct from post-inference text match). */
  repertoireSignals?: string[];
  /** Override governance_forced when Repertoire trap detected before inference. */
  governanceForced?: boolean;
  deliberationRounds?: DeliberationVote[];
}): InferenceLogEntry {
  const primitiveMatches = matchPrimitivesFromInference(params.inference);
  const matchedPrimitives = primitiveMatches.map((match) => match.name);
  const matchConfidence = Object.fromEntries(
    primitiveMatches.map((match) => [match.name, match.confidence]),
  );
  const forced = params.governanceForced ?? shouldForceGovernance(params.inference);
  const repertoireSignals =
    params.repertoireSignals ??
    params.repertoireRouting?.matchedSignals ??
    matchedPrimitives;

  let dynamoResult: InferenceLogEntry['dynamo_result'];
  if (!params.govOutcome) {
    dynamoResult = { result: null, matchedPrimitives };
  } else if (!params.govOutcome.ok) {
    dynamoResult = {
      result: null,
      matchedPrimitives: params.govOutcome.matchedPrimitives,
      error: params.govOutcome.message,
      status: params.govOutcome.status,
    };
  } else {
    const rawResult = params.govOutcome.data.result;
    dynamoResult = {
      result: rawResult ? parseDynamoHammerEnvelope(rawResult) : null,
      matchedPrimitives: params.govOutcome.matchedPrimitives,
    };
  }

  const entry: InferenceLogEntry = {
    timestamp: new Date().toISOString(),
    source: params.source,
    post_id: params.postId,
    inference: params.inference,
    public_reply: params.publicReply,
    matched_primitives: matchedPrimitives,
    match_confidence: matchConfidence,
    repertoire_signals: repertoireSignals,
    governance_forced: forced,
    dynamo_result: dynamoResult,
  };

  if (params.postTitle !== undefined) entry.post_title = params.postTitle;
  if (params.commentId !== undefined) entry.comment_id = params.commentId;
  if (params.type !== undefined) entry.type = params.type;
  if (isOntologicalTrap(params.inference)) entry.inference_type = 'ontological-trap';
  if (params.repertoireRouting) entry.repertoire_routing = params.repertoireRouting;
  if (params.deliberationRounds?.length) {
    entry.deliberation_rounds = params.deliberationRounds;
  }

  return entry;
}

export function appendInferenceLog(
  logDir: string,
  entry: InferenceLogEntry,
): void {
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  const logFile = join(logDir, `${new Date().toISOString().split('T')[0]}.jsonl`);
  appendFileSync(logFile, `${JSON.stringify(entry)}\n`);
}