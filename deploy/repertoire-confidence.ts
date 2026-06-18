/**
 * PASS-30: Moltbook engagement → Repertoire confidence consultation.
 *
 * Loads @0xray/repertoire in-process (same contract as repertoire__get_task_confidence MCP).
 * Used by moltbook-engage.ts and moltbook-other-engage.ts before Hermes inference.
 */

import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface RepertoireRoutingSnapshot {
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

export interface RepertoireConsultResult extends RepertoireRoutingSnapshot {
  promptBlock: string;
}

const DEFAULT_REPERTOIRE_ROOT = join(__dirname, '..', '..', 'repertoire');

let cachedConsult:
  | ((description: string) => RepertoireConsultResult)
  | null
  | undefined;

function resolveRepertoireRoot(): string {
  return process.env.REPERTOIRE_ROOT ?? DEFAULT_REPERTOIRE_ROOT;
}

function unavailableResult(): RepertoireConsultResult {
  return {
    consulted: false,
    providerAvailable: false,
    highConfidenceTrapPresent: false,
    ontologicalTrapDetected: false,
    recommendedAgent: null,
    matchedSignals: [],
    avgConfidence: 0,
    maxConfidence: 0,
    complexityBoost: 0,
    promptBlock: '',
  };
}

function buildPromptBlock(snapshot: RepertoireRoutingSnapshot): string {
  if (!snapshot.consulted || !snapshot.providerAvailable) return '';

  const lines = [
    'MEMORY_ROUTING (Repertoire — consult before inference):',
    `- highConfidenceTrapPresent: ${snapshot.highConfidenceTrapPresent}`,
    `- recommendedAgent: ${snapshot.recommendedAgent ?? 'none'}`,
    `- matchedSignals: ${snapshot.matchedSignals.join(', ') || 'none'}`,
    `- avgConfidence: ${snapshot.avgConfidence.toFixed(3)}`,
  ];

  if (snapshot.highConfidenceTrapPresent) {
    lines.push(
      '- If TYPE is ontological-trap or signals align, prefer closure primitives from matchedSignals.',
      '- Treat consumer-boundary and attestation-map semantics as first-class in the reply.',
    );
  }

  return `\n${lines.join('\n')}\n`;
}

async function loadConsultFn(): Promise<(description: string) => RepertoireConsultResult> {
  const repertoireRoot = resolveRepertoireRoot();
  const providerPath = join(
    repertoireRoot,
    'dist/provider/memory-routing-provider.js',
  );

  if (!existsSync(providerPath)) {
    return () => unavailableResult();
  }

  const mod = await import(pathToFileURL(providerPath).href);
  const factory = mod.createMemoryRoutingProvider ?? mod.default?.createMemoryRoutingProvider;

  if (typeof factory !== 'function') {
    return () => unavailableResult();
  }

  const provider = factory({
    dataDir: join(repertoireRoot, 'data'),
    signalsPath: join(repertoireRoot, 'data', 'curated_signals.json'),
    logDir: join(repertoireRoot, 'logs', 'groover-inference'),
  });

  if (!provider?.isAvailable?.()) {
    return () => unavailableResult();
  }

  return (description: string): RepertoireConsultResult => {
    const confidence = provider.getTaskConfidence?.({
      id: 'moltbook-engage',
      description,
      type: 'governance',
    });

    if (!confidence) {
      return unavailableResult();
    }

    const snapshot: RepertoireRoutingSnapshot = {
      consulted: true,
      providerAvailable: true,
      highConfidenceTrapPresent: confidence.highConfidenceTrapPresent ?? false,
      ontologicalTrapDetected: confidence.ontologicalTrapDetected ?? false,
      recommendedAgent: confidence.recommendedAgent ?? null,
      matchedSignals: confidence.matchedSignals ?? [],
      avgConfidence: confidence.avgConfidence ?? 0,
      maxConfidence: confidence.maxConfidence ?? 0,
      complexityBoost: confidence.complexityBoost ?? 0,
    };

    return {
      ...snapshot,
      promptBlock: buildPromptBlock(snapshot),
    };
  };
}

export async function consultRepertoire(description: string): Promise<RepertoireConsultResult> {
  if (cachedConsult === undefined) {
    cachedConsult = await loadConsultFn();
  }
  return cachedConsult(description);
}

/** Test-only reset */
export function resetRepertoireConfidenceCache(): void {
  cachedConsult = undefined;
}

export function shouldForceGovernanceWithRepertoire(
  inference: string,
  repertoire: RepertoireConsultResult,
): boolean {
  return repertoire.highConfidenceTrapPresent || /TYPE:\s*ontological-trap/i.test(inference);
}

export function toRepertoireLogFields(
  repertoire: RepertoireConsultResult,
): RepertoireRoutingSnapshot {
  return {
    consulted: repertoire.consulted,
    providerAvailable: repertoire.providerAvailable,
    highConfidenceTrapPresent: repertoire.highConfidenceTrapPresent,
    ontologicalTrapDetected: repertoire.ontologicalTrapDetected,
    recommendedAgent: repertoire.recommendedAgent,
    matchedSignals: repertoire.matchedSignals,
    avgConfidence: repertoire.avgConfidence,
    maxConfidence: repertoire.maxConfidence,
    complexityBoost: repertoire.complexityBoost,
  };
}