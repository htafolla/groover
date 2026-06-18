/**
 * Shared configuration for Moltbook field workers (engage / post / dry-run).
 * Env overrides — single source for coalesced deploy scripts.
 */

export const API_BASE =
  process.env.MOLTBOOK_API_BASE ?? 'https://www.moltbook.com/api/v1';

export const DYNAMO_MCP =
  process.env.DYNAMO_MCP ??
  'https://mcp-production-80e2.up.railway.app/call_connected_tool';

export const GROOVER_DID =
  process.env.GROOVER_DID ?? 'did:groover:284895bead2ac15b';

/** Live engage: block when non-PASS and resonance below this (matches moltbook-engage). */
export const DYNAMO_BLOCK_RESONANCE_THRESHOLD = Number(
  process.env.DYNAMO_BLOCK_RESONANCE_THRESHOLD ?? '0.75',
);

export const MAX_ACTIONS_PER_RUN = Number(process.env.MAX_ACTIONS_PER_RUN ?? '4');