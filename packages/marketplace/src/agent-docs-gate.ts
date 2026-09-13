/**
 * Enforceable agent-docs gate. Missing files or the MCP catch-all banner fail.
 * CI curls a Railway-shaped local registry. Task C2 ship-ready curls live hosts.
 */
import { AGENT_DOC_FILES, type AgentDocPath } from './agent-docs.js';

export const MCP_REGISTRY_BANNER = 'Groover MCP Registry active';

export const AGENT_DOC_HEADINGS: Record<string, string> = {
  'AGENTS.md': '# Groover — factory (agents)',
  'SKILLS.md': '# Groover skills',
  'llms.txt': '# groover',
};

export const AGENT_DOC_KEYWORDS = [
  'Factory E2E',
  'mint_suit',
  '0x045B35480F289F8f83F53345A0f367875958957a',
  'govern_with_solar',
  'register_plugin',
  'solar hammer',
  'Retry until approved',
] as const;

export const AGENT_DOC_PATHS = Object.keys(AGENT_DOC_FILES) as AgentDocPath[];

export type AgentDocEvaluation = { ok: true } | { ok: false; reason: string };

export function evaluateAgentDocResponse(input: {
  path: string;
  status: number;
  contentType: string | null;
  body: string;
}): AgentDocEvaluation {
  if (input.status !== 200) {
    return { ok: false, reason: `${input.path} HTTP ${input.status} (missing)` };
  }
  if (input.body.includes(MCP_REGISTRY_BANNER)) {
    return { ok: false, reason: `${input.path} returned MCP catch-all banner` };
  }
  const lowered = input.body.slice(0, 200).toLowerCase();
  if (lowered.includes('<!doctype html') || lowered.includes('<html')) {
    return { ok: false, reason: `${input.path} returned HTML (likely a 404 page)` };
  }
  const type = (input.contentType ?? '').toLowerCase();
  if (type.includes('text/html') || type.includes('application/json')) {
    return { ok: false, reason: `${input.path} content-type ${input.contentType ?? '(empty)'}` };
  }
  const file = input.path.replace(/^\//, '');
  const heading = AGENT_DOC_HEADINGS[file];
  if (heading && !input.body.includes(heading)) {
    return { ok: false, reason: `${input.path} missing heading ${heading}` };
  }
  const bodyLower = input.body.toLowerCase();
  for (const keyword of AGENT_DOC_KEYWORDS) {
    if (!bodyLower.includes(keyword.toLowerCase())) {
      return { ok: false, reason: `${input.path} missing keyword ${keyword}` };
    }
  }
  if (!/Dynamo is (NOT|not) required for register/i.test(input.body)) {
    return { ok: false, reason: `${input.path} missing Dynamo-not-required-for-register rule` };
  }
  return { ok: true };
}

export async function fetchAndEvaluateAgentDocs(baseUrl: string): Promise<string[]> {
  const base = baseUrl.replace(/\/$/, '');
  const reasons: string[] = [];
  for (const docPath of AGENT_DOC_PATHS) {
    const url = `${base}${docPath}`;
    try {
      const res = await fetch(url, { redirect: 'follow' });
      const result = evaluateAgentDocResponse({
        path: docPath,
        status: res.status,
        contentType: res.headers.get('content-type'),
        body: await res.text(),
      });
      if (!result.ok) {
        reasons.push(`${base} ${result.reason}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reasons.push(`${url} fetch failed: ${message}`);
    }
  }
  return reasons;
}
