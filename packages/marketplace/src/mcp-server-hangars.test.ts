import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateToolArguments } from './mcp-schemas.js';
import { resetRateLimitStore } from './mcp-rate-limit.js';
import {
  DEFAULT_CLEARING_CATALOG_URL,
  TOOL_DEFINITIONS,
  TOOL_HANDLERS,
  processStreamableMcpRequest,
} from './mcp-server.js';

const catalogFixture = {
  protocol: 'clearing-catalog/0',
  hangars: [
    {
      did: 'did:groover:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      shops: ['extract', 'witness', 'pin'],
    },
  ],
  source: 'clearing',
};

function jsonResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubCatalogFetch(
  impl: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('list_hangars', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetRateLimitStore();
  });

  it('is a registered MCP tool distinct from list_mcp_servers', () => {
    const names = TOOL_DEFINITIONS.map((tool) => tool.name);
    expect(names).toContain('list_hangars');
    expect(names).toContain('list_mcp_servers');
    const def = TOOL_DEFINITIONS.find((tool) => tool.name === 'list_hangars');
    expect(def?.description).toBe(
      'List hangars in the Clearing catalog (Groover DID + pin). Not MCP servers. Not plugins.',
    );
    expect(TOOL_HANDLERS.list_hangars).toEqual(expect.any(Function));
  });

  it('accepts empty args or https catalogUrl', () => {
    expect(validateToolArguments('list_hangars', {}).success).toBe(true);
    expect(
      validateToolArguments('list_hangars', {
        catalogUrl: 'https://clearing.example.test/v1/catalog',
      }).success,
    ).toBe(true);
    expect(validateToolArguments('list_hangars', { catalogUrl: 'not-a-url' }).success).toBe(false);
    expect(
      validateToolArguments('list_hangars', { catalogUrl: 'http://clearing.rippel.ai/v1/catalog' })
        .success,
    ).toBe(false);
    expect(validateToolArguments('list_hangars', { catalogUrl: 'file:///etc/passwd' }).success).toBe(
      false,
    );
  });

  it('maps Clearing catalog hangars and uses the default catalog URL', async () => {
    const fetchMock = stubCatalogFetch(async () =>
      jsonResponse(200, JSON.stringify(catalogFixture)),
    );

    const listing = await TOOL_HANDLERS.list_hangars({});
    expect(listing).toEqual({
      protocol: catalogFixture.protocol,
      hangars: catalogFixture.hangars,
      source: catalogFixture.source,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const called = fetchMock.mock.calls[0]?.[0];
    expect(String(called)).toBe(DEFAULT_CLEARING_CATALOG_URL);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('GET');
    expect(init?.redirect).toBe('manual');
  });

  it('does not invent shops when the catalog hangars list is empty', async () => {
    stubCatalogFetch(async () =>
      jsonResponse(
        200,
        JSON.stringify({ protocol: 'clearing-catalog/0', hangars: [], source: 'clearing' }),
      ),
    );

    const listing = (await TOOL_HANDLERS.list_hangars({})) as {
      protocol: string;
      hangars: unknown[];
      source: string;
    };
    expect(listing.hangars).toEqual([]);
  });

  it('honors catalogUrl override', async () => {
    const override = 'https://clearing.example.test/v1/catalog';
    const fetchMock = stubCatalogFetch(async () =>
      jsonResponse(200, JSON.stringify(catalogFixture)),
    );

    await TOOL_HANDLERS.list_hangars({ catalogUrl: override });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(override);
  });

  it('returns mapped catalog through streamable tools/call', async () => {
    stubCatalogFetch(async () => jsonResponse(200, JSON.stringify(catalogFixture)));

    const outcome = await processStreamableMcpRequest(
      {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: { name: 'list_hangars', arguments: {} },
      },
      'hangars-client',
      TOOL_HANDLERS,
      TOOL_DEFINITIONS,
    );

    expect(outcome.kind).toBe('json');
    if (outcome.kind !== 'json') return;
    expect(outcome.status).toBe(200);
    const text = (outcome.json.result as { content: { text: string }[] }).content[0].text;
    const parsed = JSON.parse(text) as {
      protocol: string;
      hangars: unknown[];
      source: string;
    };
    expect(parsed.protocol).toBe('clearing-catalog/0');
    expect(parsed.source).toBe('clearing');
    expect(parsed.hangars).toEqual(catalogFixture.hangars);
  });

  it('fails closed on non-200', async () => {
    stubCatalogFetch(async () => jsonResponse(500, '{"error":"nope"}'));

    await expect(TOOL_HANDLERS.list_hangars({})).rejects.toThrow('Clearing catalog request failed');

    const outcome = await processStreamableMcpRequest(
      {
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: { name: 'list_hangars', arguments: {} },
      },
      'hangars-fail-client',
      TOOL_HANDLERS,
      TOOL_DEFINITIONS,
    );
    expect(outcome.kind).toBe('json');
    if (outcome.kind !== 'json') return;
    expect(outcome.json.error?.message).toBe('Clearing catalog request failed');
    expect(outcome.json.result).toBeUndefined();
  });

  it('fails closed on invalid JSON', async () => {
    stubCatalogFetch(async () => jsonResponse(200, '<html>not json</html>'));

    await expect(TOOL_HANDLERS.list_hangars({})).rejects.toThrow(
      'Clearing catalog response is not valid JSON',
    );
  });

  it('fails closed when hangars is missing (does not invent shops)', async () => {
    stubCatalogFetch(async () =>
      jsonResponse(200, JSON.stringify({ protocol: 'clearing-catalog/0', shops: ['extract'] })),
    );

    await expect(TOOL_HANDLERS.list_hangars({})).rejects.toThrow(
      'Clearing catalog payload is invalid',
    );
  });
});
