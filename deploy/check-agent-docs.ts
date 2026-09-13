/**
 * Agent-docs HTTP gate (Task C2).
 *
 * CI: curl a Railway-shaped local registry (PORT + mcp-server.ts).
 * Ship-ready: curl live registry + website. Green vitest is not enough.
 *
 *   npx tsx deploy/check-agent-docs.ts --base http://127.0.0.1:3456
 *   npx tsx deploy/check-agent-docs.ts
 *
 * No --base defaults to both production hosts (live C2 evidence).
 */
import { fetchAndEvaluateAgentDocs } from '../packages/marketplace/src/agent-docs-gate.js';

export const LIVE_AGENT_DOC_BASES = [
  'https://registry-production-e2c4.up.railway.app',
  'https://website-production-c0da.up.railway.app',
] as const;

export function parseAgentDocBases(argv: string[]): string[] {
  const bases: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] !== '--base') {
      continue;
    }
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      throw new Error('--base requires a URL');
    }
    bases.push(value.replace(/\/$/, ''));
    i += 1;
  }
  return bases;
}

export async function checkAgentDocs(bases: string[]): Promise<string[]> {
  const reasons: string[] = [];
  for (const base of bases) {
    reasons.push(...(await fetchAndEvaluateAgentDocs(base)));
  }
  return reasons;
}

function writeLine(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

async function main(): Promise<void> {
  const bases = parseAgentDocBases(process.argv.slice(2));
  const targets = bases.length > 0 ? bases : [...LIVE_AGENT_DOC_BASES];
  writeLine(`agent-docs gate: ${targets.join(' ')}`);
  const reasons = await checkAgentDocs(targets);
  if (reasons.length > 0) {
    for (const reason of reasons) {
      writeLine(`FAIL ${reason}`);
    }
    writeLine('Task C2 not ship-ready: a host is missing a core doc or returned the MCP banner. Acceptance: /AGENTS.md /SKILLS.md /llms.txt must be 200 on website+registry.');
    process.exit(1);
  }
  writeLine('PASS agent-docs HTTP gate (200, factory E2E, not MCP banner)');
}

const isMain = process.argv[1]?.endsWith('check-agent-docs.ts') === true
  || process.argv[1]?.endsWith('check-agent-docs.js') === true;

if (isMain) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    writeLine(`FATAL ${message}`);
    process.exit(1);
  });
}
