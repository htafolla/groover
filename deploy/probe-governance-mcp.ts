#!/usr/bin/env node
import { loadPlatformEnv } from './load-platform-env.js';
import { XRAY_GOVERNANCE_MCP_URL, XRAY_GOVERNANCE_MCP_PATH } from './engage-config.js';
import { McpStreamableClient } from './mcp-streamable-client.js';

loadPlatformEnv();

function out(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function err(msg: string): void {
  process.stderr.write(`${msg}\n`);
}

async function main(): Promise<void> {
  const hasKey = Boolean(process.env.GOVERNANCE_API_KEY);
  const mcpUrl = process.env.GOVERNANCE_MCP_URL ?? XRAY_GOVERNANCE_MCP_URL;
  const mcpPath = process.env.GOVERNANCE_MCP_PATH ?? XRAY_GOVERNANCE_MCP_PATH;

  out(`GOVERNANCE_API_KEY loaded: ${hasKey}`);
  out(`GOVERNANCE_MCP_URL: ${mcpUrl}`);

  if (!hasKey) {
    err('No GOVERNANCE_API_KEY. Set in groover/.env or export before running.');
    process.exit(2);
  }

  const client = new McpStreamableClient({
    baseUrl: mcpUrl,
    mcpPath,
    apiKey: process.env.GOVERNANCE_API_KEY,
  });

  await client.ensureSession();
  out('session: initialized');

  const parsed = (await client.callTool('govern_proposals', {
    proposals: [
      {
        type: 'strategic',
        title: 'P0.6b deliberation probe',
        description: 'Internal deliberation without external Dynamo',
        evidence: ['attestation-as-map'],
      },
    ],
    options: { require_external: false },
  })) as {
    results?: Array<{ votes?: Array<{ server: string; decision: string }> }>;
  };

  const votes = parsed.results?.[0]?.votes ?? [];
  const internal = votes.filter((v) =>
    ['code-review', 'security-audit', 'researcher'].includes(v.server),
  );
  out(`internal votes: ${internal.length}`);
  for (const vote of internal) {
    out(`  ${vote.server}: ${vote.decision}`);
  }
}

main().catch((error) => {
  err(String(error));
  process.exit(1);
});