import { createServer, type AddressInfo } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MCP_REGISTRY_BANNER } from './agent-docs-gate.js';
import { handleRegistryRequest, TOOL_DEFINITIONS } from './mcp-server.js';
import {
  CLEARING_CATALOG_URL,
  CLEARING_SHOP_URLS,
  GROOVER_AGENT_CARD,
  GROOVER_AGENT_JSON,
  GROOVER_AGENT_REGISTRATION,
  GROOVER_MCP_URL,
  GROOVER_PUBLIC_ORIGIN,
  GROOVER_X402,
  WELL_KNOWN_DOCUMENTS,
  WELL_KNOWN_PATHS,
} from './well-known.js';

const RAILWAY_HOST = 'railway.app';

describe('Groover well-known JSON documents', () => {
  it('advertises groover.rippel.ai / clearing.rippel.ai only', () => {
    const body = JSON.stringify(WELL_KNOWN_DOCUMENTS);
    expect(body).not.toContain(RAILWAY_HOST);
    expect(body).not.toContain(MCP_REGISTRY_BANNER);
    expect(body).toContain(GROOVER_PUBLIC_ORIGIN);
    expect(body).toContain(CLEARING_CATALOG_URL);
  });

  it('agent-card is A2A 0.3.0 Groover Registry with the five MCP skills', () => {
    expect(GROOVER_AGENT_CARD.protocolVersion).toBe('0.3.0');
    expect(GROOVER_AGENT_CARD.name).toBe('Groover Registry');
    expect(GROOVER_AGENT_CARD.url).toBe(GROOVER_PUBLIC_ORIGIN);
    expect(GROOVER_AGENT_CARD.description).toContain(CLEARING_CATALOG_URL);
    const skillIds = GROOVER_AGENT_CARD.skills.map((skill) => skill.id);
    expect(skillIds).toEqual([
      'register_plugin',
      'mint_suit',
      'list_hangars',
      'list_mcp_servers',
      'search_plugins',
    ]);
    const toolNames = TOOL_DEFINITIONS.map((tool) => tool.name);
    for (const id of skillIds) {
      expect(toolNames).toContain(id);
    }
  });

  it('x402 v2 lists clearing hangar shops; Groover MCP is unpaid', () => {
    expect(GROOVER_X402.x402Version).toBe(2);
    expect(GROOVER_X402.resources).toEqual(CLEARING_SHOP_URLS);
    expect(GROOVER_X402.resources).toEqual([
      'https://clearing.rippel.ai/v1/extract',
      'https://clearing.rippel.ai/v1/skim',
      'https://clearing.rippel.ai/v1/witness',
      'https://clearing.rippel.ai/v1/pin',
      'https://clearing.rippel.ai/v1/card',
      'https://clearing.rippel.ai/v1/blip',
    ]);
    expect(GROOVER_X402.note).toMatch(/unpaid/i);
    expect(GROOVER_X402.note).toContain('clearing.rippel.ai');
  });

  it('agent.json points MCP at groover and catalog at clearing', () => {
    expect(GROOVER_AGENT_JSON.endpoints.mcp).toBe(GROOVER_MCP_URL);
    expect(GROOVER_AGENT_JSON.endpoints.catalog).toBe(CLEARING_CATALOG_URL);
    expect(GROOVER_MCP_URL).toBe('https://groover.rippel.ai/mcp');
  });

  it('agent-registration is 8004 registration-v1 with MCP and empty registrations', () => {
    expect(GROOVER_AGENT_REGISTRATION.type).toBe(
      'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    );
    const mcp = GROOVER_AGENT_REGISTRATION.services.find((service) => service.name === 'MCP');
    expect(mcp?.endpoint).toBe(GROOVER_MCP_URL);
    expect(GROOVER_AGENT_REGISTRATION.registrations).toEqual([]);
    expect(GROOVER_AGENT_REGISTRATION.x402Support).toBe(false);
  });
});

describe('registry well-known HTTP routes', () => {
  let baseUrl = '';
  const server = createServer((req, res) => {
    void handleRegistryRequest(req, res);
  });

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it.each(WELL_KNOWN_PATHS)('GET %s returns JSON, not the MCP banner', async (route) => {
    const res = await fetch(`${baseUrl}${route}`);
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/i);
    expect(text.trimStart().startsWith(MCP_REGISTRY_BANNER)).toBe(false);
    expect(text).not.toContain(MCP_REGISTRY_BANNER);
    expect(text).not.toContain(RAILWAY_HOST);
    const parsed: unknown = JSON.parse(text);
    expect(parsed).toEqual(WELL_KNOWN_DOCUMENTS[route]);
  });

  it('query strings still resolve well-known JSON', async () => {
    const res = await fetch(`${baseUrl}/.well-known/agent-card.json?src=agent`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/i);
    const parsed = (await res.json()) as { name: string; url: string };
    expect(parsed.name).toBe('Groover Registry');
    expect(parsed.url).toBe(GROOVER_PUBLIC_ORIGIN);
  });

  it('unknown GET still returns the MCP banner', async () => {
    const res = await fetch(`${baseUrl}/.well-known/not-a-discovery`);
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).toContain(MCP_REGISTRY_BANNER);
  });
});
