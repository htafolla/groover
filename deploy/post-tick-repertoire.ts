/**
 * Post-tick memory loop — closes Repertoire feedback after each governed action.
 * Loads @0xray/repertoire provider in-process (same resolution as repertoire-confidence).
 */

import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const SIBLING_REPERTOIRE_ROOT = join(__dirname, '..', '..', 'repertoire');
const LOCAL_NODE_MODULES_ROOT = join(__dirname, '..', 'node_modules', '@0xray', 'repertoire');

function providerExistsAt(root: string): boolean {
  return existsSync(join(root, 'dist/provider/memory-routing-provider.js'));
}

function resolveRepertoireRoot(): string | null {
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
  return null;
}

export interface PostTickInput {
  taskId: string;
  memorySignals: string[];
  dynamoRecommendation: string | null;
  resonanceScore: number;
  posted: boolean;
  durationMs?: number;
}

export interface PostTickResult {
  ok: boolean;
  skipped?: string;
  updatedSignals?: string[];
}

let cachedIngestFeedback:
  | ((entry: Record<string, unknown>) => { updatedSignals?: string[] })
  | null
  | undefined;

export async function runPostTickRepertoire(
  input: PostTickInput,
): Promise<PostTickResult> {
  if (process.env.SKIP_REPERTOIRE_FEEDBACK === '1') {
    return { ok: true, skipped: 'SKIP_REPERTOIRE_FEEDBACK' };
  }

  if (input.memorySignals.length === 0) {
    return { ok: true, skipped: 'no-memory-signals' };
  }

  if (cachedIngestFeedback === undefined) {
    const root = resolveRepertoireRoot();
    if (!root) {
      cachedIngestFeedback = null;
      return { ok: false, skipped: 'repertoire-provider-unavailable' };
    }
    try {
      const mod = await import(
        pathToFileURL(join(root, 'dist/provider/memory-routing-provider.js')).href
      );
      const provider = mod.createMemoryRoutingProvider?.({
        dataDir: join(root, 'data'),
        signalsPath: join(root, 'data/curated_signals.json'),
        logDir: join(root, 'logs/groover-inference'),
      });
      if (!provider?.ingestFeedback) {
        cachedIngestFeedback = null;
        return { ok: false, skipped: 'ingestFeedback-not-exported' };
      }
      cachedIngestFeedback = provider.ingestFeedback.bind(provider);
    } catch {
      cachedIngestFeedback = null;
      return { ok: false, skipped: 'provider-load-failed' };
    }
  }

  if (!cachedIngestFeedback) {
    return { ok: false, skipped: 'repertoire-provider-unavailable' };
  }

  const success =
    input.posted &&
    (input.dynamoRecommendation === 'PASS' ||
      input.resonanceScore >= 0.75);

  const result = cachedIngestFeedback({
    timestamp: new Date().toISOString(),
    sessionId: `moltbook-${input.taskId}`,
    taskId: input.taskId,
    assignedAgent: 'field-shadow',
    memorySignals: input.memorySignals,
    complexity: 30,
    success,
    durationMs: input.durationMs ?? 0,
    dynamoResult: {
      recommendation: input.dynamoRecommendation,
      resonanceScore: input.resonanceScore,
    },
  });

  return { ok: true, updatedSignals: result?.updatedSignals };
}

export function resetPostTickCache(): void {
  cachedIngestFeedback = undefined;
}