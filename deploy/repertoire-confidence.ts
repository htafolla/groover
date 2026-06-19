/**
 * PASS-30: Field engage → Repertoire confidence consultation.
 *
 * Loads @0xray/repertoire in-process (same contract as repertoire__get_task_confidence MCP).
 * Used by engage-core (and optional Moltbook workers) before Hermes inference.
 */

import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { repertoireServicePaths } from './repertoire-service-config.js';

const require = createRequire(import.meta.url);

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

const SIBLING_REPERTOIRE_ROOT = join(__dirname, '..', '..', 'repertoire');
const LOCAL_NODE_MODULES_ROOT = join(__dirname, '..', 'node_modules', '@0xray', 'repertoire');

function providerExistsAt(root: string): boolean {
  return existsSync(join(root, 'dist/provider/memory-routing-provider.js'));
}

function resolveRepertoireRoot(): string {
  if (process.env.REPERTOIRE_ROOT && providerExistsAt(process.env.REPERTOIRE_ROOT)) {
    return process.env.REPERTOIRE_ROOT;
  }

  for (const candidate of [SIBLING_REPERTOIRE_ROOT, LOCAL_NODE_MODULES_ROOT]) {
    if (providerExistsAt(candidate)) return candidate;
  }

  try {
    const pkgJson = require.resolve('@0xray/repertoire/package.json');
    const root = dirname(pkgJson);
    if (providerExistsAt(root)) return root;
  } catch {
    // not installed
  }

  return process.env.REPERTOIRE_ROOT ?? SIBLING_REPERTOIRE_ROOT;
}

let cachedConsult:
  | ((description: string) => RepertoireConsultResult)
  | null
  | undefined;

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

/** Build the text Repertoire matches against (post + comment), not the Hermes output. */
export function buildRepertoireConsultDescription(input: {
  postTitle?: string;
  postContent?: string;
  commentContent?: string;
}): string {
  return [
    input.postTitle?.trim() && `Post title: ${input.postTitle.trim()}`,
    input.postContent?.trim() && `Post content: ${input.postContent.trim()}`,
    input.commentContent?.trim() && `Comment: ${input.commentContent.trim()}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildPromptBlock(snapshot: RepertoireRoutingSnapshot): string {
  if (!snapshot.consulted || !snapshot.providerAvailable) return '';
  if (!snapshot.highConfidenceTrapPresent && snapshot.matchedSignals.length === 0) {
    return '';
  }

  const lines = [
    'MEMORY_ROUTING (Repertoire pre-inference — apply to classification and primitives; do not echo in PUBLIC REPLY):',
    `- highConfidenceTrapPresent: ${snapshot.highConfidenceTrapPresent}`,
    `- recommendedAgent: ${snapshot.recommendedAgent ?? 'none'}`,
    `- matchedSignals: ${snapshot.matchedSignals.join(', ') || 'none'}`,
    `- avgConfidence: ${snapshot.avgConfidence.toFixed(3)}`,
  ];

  if (snapshot.complexityBoost > 0) {
    lines.push(`- complexityBoost: ${snapshot.complexityBoost}`);
  }

  if (snapshot.highConfidenceTrapPresent) {
    lines.push(
      '- Prefer matchedSignals when mapping cryptographic primitives in INFERENCE.',
      '- If signals align, classify TYPE as ontological-trap and add a closure primitive.',
      '- Treat consumer-boundary and attestation-map semantics as first-class in the reply.',
    );
  } else if (snapshot.matchedSignals.length > 0) {
    lines.push('- Weight matchedSignals when mapping primitives; TYPE may still be non-trap.');
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

  const paths = repertoireServicePaths(repertoireRoot);
  const provider = factory({
    dataDir: paths.dataDir,
    signalsPath: paths.signalsPath,
    logDir: paths.logDir,
    feedbackDir: paths.feedbackDir,
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