#!/usr/bin/env node
/**
 * Probe governance deliberation voters.
 * Default: in-process xray nucleus + local Hermes xAI OAuth (plugin path).
 * Remote: set GOVERNANCE_MCP_URL (+ GOVERNANCE_API_KEY if the host requires it).
 */

import { loadPlatformEnv } from './load-platform-env.js';
import { callDeliberationRound } from './governance-helper.js';

loadPlatformEnv();

function out(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function err(msg: string): void {
  process.stderr.write(`${msg}\n`);
}

async function main(): Promise<void> {
  const remote = Boolean(process.env.GOVERNANCE_MCP_URL);
  out(`mode: ${remote ? 'remote MCP' : 'local in-process (plugin path)'}`);
  if (remote) {
    out(`GOVERNANCE_MCP_URL: ${process.env.GOVERNANCE_MCP_URL}`);
    out(`GOVERNANCE_API_KEY loaded: ${Boolean(process.env.GOVERNANCE_API_KEY)}`);
  } else {
    out(`XRAY_ROOT: ${process.env.XRAY_ROOT ?? '(sibling ../xray or 0xray package)'}`);
  }

  const result = await callDeliberationRound({
    title: 'Governance deliberation probe',
    description: 'Internal deliberation without external Dynamo',
    evidence: ['attestation-as-map'],
  });

  if (!result.ok) {
    err(result.message ?? 'deliberation failed');
    process.exit(1);
  }

  out(`internal votes: ${result.votes.length}`);
  for (const vote of result.votes) {
    out(`  ${vote.server}: ${vote.decision}`);
  }
}

main().catch((error) => {
  err(String(error));
  process.exit(1);
});