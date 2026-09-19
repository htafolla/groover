/**
 * Unpaid JSON at GET /.well-known/* (A2A 0.3.0, x402 v2, 8004 registration-v1).
 * Advertise groover.rippel.ai / clearing.rippel.ai only — never railway.app.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

export const GROOVER_PUBLIC_ORIGIN = 'https://groover.rippel.ai';
export const CLEARING_PUBLIC_ORIGIN = 'https://clearing.rippel.ai';
export const CLEARING_CATALOG_URL = `${CLEARING_PUBLIC_ORIGIN}/v1/catalog`;
export const GROOVER_MCP_URL = `${GROOVER_PUBLIC_ORIGIN}/mcp`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const HANGAR_SHOP_PATHS = ['extract', 'skim', 'witness', 'pin', 'card', 'blip'] as const;

export const CLEARING_SHOP_URLS = HANGAR_SHOP_PATHS.map(
  (shop) => `${CLEARING_PUBLIC_ORIGIN}/v1/${shop}`,
);

export const GROOVER_AGENT_CARD = {
  protocolVersion: '0.3.0',
  name: 'Groover Registry',
  description:
    'MCP registry. Catalog of hangars is GET https://clearing.rippel.ai/v1/catalog',
  url: GROOVER_PUBLIC_ORIGIN,
  provider: { organization: 'Rippel', url: 'https://rippel.ai' },
  version: '0.2-mvp',
  capabilities: { streaming: false, pushNotifications: false },
  defaultInputModes: ['text/plain', 'application/json'],
  defaultOutputModes: ['application/json'],
  skills: [
    {
      id: 'register_plugin',
      name: 'register_plugin',
      description: 'Register agent with Proof of Autonomy (Ed25519 + adaptive MCP challenge).',
      tags: ['mcp', 'registry'],
    },
    {
      id: 'mint_suit',
      name: 'mint_suit',
      description: 'Mint a Groover Identity (GRVR) 1/1 on Base for a registered DID.',
      tags: ['mcp', 'registry'],
    },
    {
      id: 'list_hangars',
      name: 'list_hangars',
      description: 'List hangars in the Clearing catalog (Groover DID + pin).',
      tags: ['mcp', 'registry', 'hangar'],
    },
    {
      id: 'list_mcp_servers',
      name: 'list_mcp_servers',
      description: 'List available MCP servers for correlation.',
      tags: ['mcp', 'registry'],
    },
    {
      id: 'search_plugins',
      name: 'search_plugins',
      description: 'Search registry with MCP signals.',
      tags: ['mcp', 'registry'],
    },
  ],
};

export const GROOVER_X402 = {
  x402Version: 2,
  resources: CLEARING_SHOP_URLS,
  note: 'Groover MCP is unpaid; hangar shops live on clearing.rippel.ai',
};

export const GROOVER_AGENT_JSON = {
  name: 'Groover Registry',
  description:
    'MCP registry. Catalog of hangars is GET https://clearing.rippel.ai/v1/catalog',
  url: GROOVER_PUBLIC_ORIGIN,
  endpoints: {
    mcp: GROOVER_MCP_URL,
    catalog: CLEARING_CATALOG_URL,
  },
};

export const GROOVER_AGENT_REGISTRATION = {
  type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
  name: 'Groover Registry',
  description:
    'MCP registry. Catalog of hangars is GET https://clearing.rippel.ai/v1/catalog',
  image: `${GROOVER_PUBLIC_ORIGIN}/llms.txt`,
  services: [
    { name: 'MCP', endpoint: GROOVER_MCP_URL },
    {
      name: 'A2A',
      endpoint: `${GROOVER_PUBLIC_ORIGIN}/.well-known/agent-card.json`,
      version: '0.3.0',
    },
    { name: 'web', endpoint: GROOVER_PUBLIC_ORIGIN },
  ],
  x402Support: false,
  active: true,
  registrations: [] as Array<{ agentId: string; agentRegistry: string }>,
};

export const WELL_KNOWN_DOCUMENTS = {
  '/.well-known/agent-card.json': GROOVER_AGENT_CARD,
  '/.well-known/x402': GROOVER_X402,
  '/.well-known/agent.json': GROOVER_AGENT_JSON,
  '/.well-known/agent-registration.json': GROOVER_AGENT_REGISTRATION,
};

export type WellKnownPath = keyof typeof WELL_KNOWN_DOCUMENTS;

export const WELL_KNOWN_PATHS = Object.keys(WELL_KNOWN_DOCUMENTS) as WellKnownPath[];

export function wellKnownPathname(url: string | undefined): string {
  const raw = url ?? '/';
  return raw.split('?')[0]?.split('#')[0] ?? '/';
}

export function loadWellKnown(pathname: string): string | null {
  if (!Object.hasOwn(WELL_KNOWN_DOCUMENTS, pathname)) {
    return null;
  }
  return JSON.stringify(WELL_KNOWN_DOCUMENTS[pathname as WellKnownPath]);
}

export function tryServeWellKnown(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return false;
  }
  const body = loadWellKnown(wellKnownPathname(req.url));
  if (body === null) {
    return false;
  }
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60',
    ...CORS_HEADERS,
  });
  res.end(req.method === 'HEAD' ? undefined : body);
  return true;
}
