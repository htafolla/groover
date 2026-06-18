/**
 * Provider-agnostic governance helper for Groover engagement scripts.
 *
 * Curated signals path resolution (in order):
 * 1. CURATED_SIGNALS_PATH env var (absolute or relative to cwd)
 * 2. <repo-root>/curated_signals.json (one level above deploy/)
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
}

export interface DynamoGovernanceResult {
  recommendation?: string;
  resonanceScore?: number;
}

export interface DynamoResponse {
  result?: DynamoGovernanceResult;
}

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
  dynamo_result: {
    result: DynamoGovernanceResult | null;
    matchedPrimitives: string[];
    error?: string;
    status?: number;
  };
}

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
) {
  return {
    title,
    description: content,
    type: 'strategic',
    source: 'groover-inference',
    agentDid: options.agentDid,
    inferenceType: options.inferenceType,
    matchedPrimitives: options.matchedPrimitives ?? [],
    forced: options.force ?? false,
  };
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

function formatDynamoResult(result: DynamoGovernanceResult | undefined): string {
  const rec = result?.recommendation ?? 'N/A';
  const resonance =
    typeof result?.resonanceScore === 'number'
      ? result.resonanceScore.toFixed(3)
      : 'N/A';
  return `rec=${rec} resonance=${resonance}`;
}

export function extractDynamoResult(
  outcome: GovernanceCallOutcome | null | undefined,
): DynamoGovernanceResult | null {
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
  });

  try {
    const res = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: 'govern_with_solar',
        params: {
          proposal,
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

    const data = (await res.json()) as DynamoResponse;
    return { ok: true, data, matchedPrimitives };
  } catch (error) {
    return {
      ok: false,
      error: true,
      message: String(error),
      matchedPrimitives,
    };
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
    dynamoResult = {
      result: params.govOutcome.data.result ?? null,
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