/**
 * Shared configuration for Moltbook field workers (engage / post / dry-run).
 * Env overrides — single source for coalesced deploy scripts.
 */

import { loadPlatformEnv } from './load-platform-env.js';

loadPlatformEnv();

export const API_BASE =
  process.env.MOLTBOOK_API_BASE ?? 'https://www.moltbook.com/api/v1';

/** P0.1 platform contract base — see 0x0/docs/0x0-platform-contract.md */
export const DYNAMO_MCP_URL =
  process.env.DYNAMO_MCP_URL?.replace(/\/$/, '') ??
  'https://mcp-production-80e2.up.railway.app';

export const DYNAMO_MCP =
  process.env.DYNAMO_MCP ?? `${DYNAMO_MCP_URL}/call_connected_tool`;

/** xray-governance HTTP endpoint derived from the same base */
export const GOVERNANCE_ENDPOINT =
  process.env.GOVERNANCE_ENDPOINT ?? `${DYNAMO_MCP_URL}/governance`;

const explicitGovernanceMcpUrl = process.env.GOVERNANCE_MCP_URL?.trim() || '';

/**
 * Optional remote xray-governance HTTP MCP (hosted Railway, etc.).
 * Default deliberation uses in-process nucleus + Hermes OAuth — not this URL.
 */
export const XRAY_GOVERNANCE_MCP_URL = explicitGovernanceMcpUrl
  ? explicitGovernanceMcpUrl.replace(/\/$/, '')
  : 'http://localhost:4002';

export const XRAY_GOVERNANCE_MCP_PATH =
  process.env.GOVERNANCE_MCP_PATH ?? '/mcp';

/** True only when an operator explicitly opts into remote HTTP governance MCP. */
export const USE_REMOTE_GOVERNANCE_MCP = Boolean(explicitGovernanceMcpUrl);

export const GROOVER_DID =
  process.env.GROOVER_DID ?? 'did:groover:284895bead2ac15b';

/** Live engage: block when non-PASS and resonance below this (matches moltbook-engage). */
export const DYNAMO_BLOCK_RESONANCE_THRESHOLD = Number(
  process.env.DYNAMO_BLOCK_RESONANCE_THRESHOLD ?? '0.75',
);

export const MAX_ACTIONS_PER_RUN = Number(process.env.MAX_ACTIONS_PER_RUN ?? '4');

/** Cap Hermes subprocess calls per engage/post pipeline invocation. */
export const MAX_HERMES_CALLS_PER_RUN = Number(
  process.env.MAX_HERMES_CALLS_PER_RUN ?? '1',
);

/** Per-call Hermes timeout — keep sum under cron wall (~60s). */
export const HERMES_TIMEOUT_MS = Number(process.env.HERMES_TIMEOUT_MS ?? '45000');

export const HERMES_MAX_RETRIES = Number(process.env.HERMES_MAX_RETRIES ?? '1');

/** Repertoire consult: skip Hermes when no signals and avg below this. */
export const REPERTOIRE_SKIP_CONFIDENCE_THRESHOLD = Number(
  process.env.REPERTOIRE_SKIP_CONFIDENCE_THRESHOLD ?? '0.55',
);