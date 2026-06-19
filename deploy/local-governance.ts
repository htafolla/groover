/**
 * In-process xray nucleus governance — same path as the TUI/CLI plugin agents.
 * Uses Hermes xAI OAuth from ~/.hermes/auth.json (no Railway, no GOVERNANCE_API_KEY).
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIBLING_XRAY_ROOT = join(__dirname, '..', '..', 'xray');

export interface LocalGovernanceVote {
  server: string;
  decision: string;
  confidence: number;
  reasoning?: string;
}

export interface LocalGovernanceResponse {
  results?: Array<{
    votes?: Array<{
      server?: string;
      decision?: string;
      confidence?: number;
      reasoning?: string;
    }>;
  }>;
}

function resolveXrayRootFromNodeModules(startDir: string): string | null {
  let dir = startDir;
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = join(dir, 'node_modules', '0xray');
    if (existsSync(join(candidate, 'dist/nucleus/index.js'))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function resolveXrayRoot(): string | null {
  const candidates = [
    process.env.XRAY_ROOT,
    SIBLING_XRAY_ROOT,
    resolveXrayRootFromNodeModules(__dirname),
    resolveXrayRootFromNodeModules(process.cwd()),
  ].filter((value): value is string => Boolean(value));

  for (const root of candidates) {
    if (existsSync(join(root, 'dist/nucleus/index.js'))) return root;
  }

  return null;
}

type HandleGovernRequest = (
  body: unknown,
  options?: { requireExternalDynamo?: boolean },
) => Promise<LocalGovernanceResponse>;

let cachedHandle: HandleGovernRequest | null | undefined;

async function loadHandleGovernRequest(): Promise<HandleGovernRequest | null> {
  if (cachedHandle !== undefined) return cachedHandle;

  const root = resolveXrayRoot();
  if (!root) {
    cachedHandle = null;
    return null;
  }

  process.env.XRAY_GOVERNANCE_IN_PROCESS = '1';

  try {
    const mod = await import(pathToFileURL(join(root, 'dist/nucleus/index.js')).href);
    if (typeof mod.handleGovernRequest !== 'function') {
      cachedHandle = null;
      return null;
    }
    cachedHandle = mod.handleGovernRequest as HandleGovernRequest;
    return cachedHandle;
  } catch {
    cachedHandle = null;
    return null;
  }
}

export function resetLocalGovernanceCache(): void {
  cachedHandle = undefined;
}

export async function callLocalGovernanceDeliberation(params: {
  title: string;
  description: string;
  evidence: string[];
  timeoutMs?: number;
}): Promise<{ ok: boolean; votes: LocalGovernanceVote[]; message?: string }> {
  const handle = await loadHandleGovernRequest();
  if (!handle) {
    return {
      ok: false,
      votes: [],
      message:
        'Local xray governance unavailable — set XRAY_ROOT, build xray dist, or set GOVERNANCE_MCP_URL for remote MCP',
    };
  }

  const timeoutMs = params.timeoutMs ?? 60_000;

  try {
    const response = await Promise.race([
      handle(
        {
          proposals: [
            {
              id: `groover-delib-${Date.now()}`,
              type: 'strategic',
              title: params.title,
              description: params.description,
              evidence: params.evidence,
              source: 'inference',
              confidence: 0.85,
            },
          ],
          options: { require_external: false },
        },
        { requireExternalDynamo: false },
      ),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Local governance deliberation timed out')),
          timeoutMs,
        );
      }),
    ]);

    const votes: LocalGovernanceVote[] = (response.results?.[0]?.votes ?? [])
      .filter((vote) => vote.server)
      .map((vote) => ({
        server: vote.server!,
        decision: vote.decision ?? 'abstain',
        confidence: typeof vote.confidence === 'number' ? vote.confidence : 0.5,
        reasoning: vote.reasoning,
      }));

    return { ok: true, votes };
  } catch (error) {
    return { ok: false, votes: [], message: String(error) };
  }
}