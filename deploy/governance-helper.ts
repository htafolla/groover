/**
 * Provider-agnostic governance helper for Groover engagement scripts.
 * Signal matching uses CURATED_SIGNALS_PATH (defaults to repo curated_signals.json).
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface CuratedSignal {
  name: string;
  tags: string[];
  evaluation_criteria: string;
}

export interface GovernOptions {
  agentDid: string;
  inferenceType?: string;
  matchedPrimitives?: string[];
  force?: boolean;
}

let cachedSignals: CuratedSignal[] | null = null;

export function loadCuratedSignals(): CuratedSignal[] {
  if (cachedSignals) return cachedSignals;

  const path =
    process.env.CURATED_SIGNALS_PATH ??
    join(__dirname, '..', 'curated_signals.json');

  if (!existsSync(path)) {
    cachedSignals = [];
    return cachedSignals;
  }

  const data = JSON.parse(readFileSync(path, 'utf8'));
  cachedSignals = (data.signals ?? []) as CuratedSignal[];
  return cachedSignals;
}

export function isOntologicalTrap(inference: string): boolean {
  return /TYPE:\s*ontological-trap/i.test(inference);
}

export function matchPrimitivesFromInference(inference: string): string[] {
  const signals = loadCuratedSignals();
  const normalized = inference.toLowerCase();
  const matched: string[] = [];

  for (const signal of signals) {
    if (normalized.includes(signal.name.replace(/-/g, ' ')) || normalized.includes(signal.name)) {
      matched.push(signal.name);
      continue;
    }
    for (const tag of signal.tags) {
      if (normalized.includes(tag.toLowerCase())) {
        matched.push(signal.name);
        break;
      }
    }
  }

  if (isOntologicalTrap(inference)) {
    for (const signal of signals.filter((s) => s.tags.includes('ontological-trap'))) {
      if (!matched.includes(signal.name)) matched.push(signal.name);
    }
  }

  return matched;
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

export function formatDynamoLog(govResult: unknown): string {
  const rec = (govResult as any)?.result?.recommendation ?? 'N/A';
  const res = (govResult as any)?.result?.resonanceScore;
  const resonance = typeof res === 'number' ? res.toFixed(3) : 'N/A';
  return `rec=${rec} resonance=${resonance}`;
}