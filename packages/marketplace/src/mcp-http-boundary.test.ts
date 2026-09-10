import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeEach } from 'vitest';
import { resetRateLimitStore, rateLimit } from './mcp-rate-limit.js';
import { validateToolArguments } from './mcp-schemas.js';
import { processStreamableMcpRequest, TOOL_HANDLERS, TOOL_DEFINITIONS } from './mcp-server.js';

describe('MCP HTTP boundary (P0.9)', () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it('rejects invalid JSON-RPC envelope', async () => {
    const outcome = await processStreamableMcpRequest(
      { jsonrpc: '1.0', method: 'ping' },
      'test-client',
      TOOL_HANDLERS,
      TOOL_DEFINITIONS,
    );
    expect(outcome.kind).toBe('json');
    if (outcome.kind === 'json') {
      expect(outcome.status).toBe(400);
      expect(outcome.json.error?.code).toBe(-32700);
    }
  });

  it('accepts JSON-RPC notification with 202', async () => {
    const outcome = await processStreamableMcpRequest(
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      'test-client',
      TOOL_HANDLERS,
      TOOL_DEFINITIONS,
    );
    expect(outcome).toMatchObject({ kind: 'notification', status: 202 });
  });

  it('returns 429 when HTTP rate limit exceeded', async () => {
    for (let i = 0; i < 30; i++) {
      await processStreamableMcpRequest(
        { jsonrpc: '2.0', id: i, method: 'ping' },
        'flood-client',
        TOOL_HANDLERS,
        TOOL_DEFINITIONS,
      );
    }
    const blocked = await processStreamableMcpRequest(
      { jsonrpc: '2.0', id: 'blocked', method: 'ping' },
      'flood-client',
      TOOL_HANDLERS,
      TOOL_DEFINITIONS,
    );
    expect(blocked.kind).toBe('json');
    if (blocked.kind === 'json') {
      expect(blocked.status).toBe(429);
      expect(blocked.json.error?.code).toBe(-32000);
    }
  });

  it('validates register_plugin args at boundary', () => {
    const bad = validateToolArguments('register_plugin', { pubkey: 'only-pubkey' });
    expect(bad.success).toBe(false);
    const ok = validateToolArguments('get_registration_challenge', { pubkey: 'test-pubkey' });
    expect(ok.success).toBe(true);
  });

  it('validates mint_suit args at boundary', () => {
    const bad = validateToolArguments('mint_suit', { did: 'did:groover:aaaaaaaaaaaaaaaa' });
    expect(bad.success).toBe(false);
    const ok = validateToolArguments('mint_suit', {
      did: 'did:groover:aaaaaaaaaaaaaaaa',
      apiKey: 'groover_test',
      pack: 'groover-identity',
      to: '0x0000000000000000000000000000000000000001',
      dryRun: true,
    });
    expect(ok.success).toBe(true);
  });

  it('lists mint_suit on GET /mcp tool names', () => {
    expect(TOOL_DEFINITIONS.map((t) => t.name)).toContain('mint_suit');
  });

  it('token-image route uses the compositor renderer, not the GRVR stub', () => {
    const src = readFileSync(new URL('./mcp-server.ts', import.meta.url), 'utf8');
    expect(src).toContain('renderIdentityTokenImage');
    expect(src).not.toContain('font-size="28">GRVR');
  });

  it('answers CORS preflight on OPTIONS (browser mint_suit)', () => {
    const src = readFileSync(new URL('./mcp-server.ts', import.meta.url), 'utf8');
    expect(src).toContain("req.method === 'OPTIONS'");
    expect(src).toContain("'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'");
    expect(src).toContain("'Access-Control-Allow-Headers': 'Content-Type'");
  });

  it('rejects register_plugin with invalid args via tools/call', async () => {
    const outcome = await processStreamableMcpRequest(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'register_plugin', arguments: { pubkey: 'x' } },
      },
      'register-client',
      TOOL_HANDLERS,
      TOOL_DEFINITIONS,
    );
    expect(outcome.kind).toBe('json');
    if (outcome.kind === 'json') {
      expect(outcome.json.error?.code).toBe(-32602);
    }
  });

  it('list_mcp_servers still works through streamable handler', async () => {
    const outcome = await processStreamableMcpRequest(
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'list_mcp_servers', arguments: {} },
      },
      'ok-client',
      TOOL_HANDLERS,
      TOOL_DEFINITIONS,
    );
    expect(outcome.kind).toBe('json');
    if (outcome.kind === 'json') {
      expect(outcome.status).toBe(200);
      const text = (outcome.json.result as { content: { text: string }[] }).content[0].text;
      const parsed = JSON.parse(text) as { success: boolean; count: number };
      expect(parsed.success).toBe(true);
      expect(parsed.count).toBeGreaterThanOrEqual(4);
    }
  });

  it('register_plugin has stricter rate bucket', () => {
    const key = 'reg-test';
    for (let i = 0; i < 5; i++) {
      const r = rateLimit(`register:${key}`, { maxRequests: 5, windowMs: 3_600_000 });
      expect(r.success).toBe(true);
    }
    const blocked = rateLimit(`register:${key}`, { maxRequests: 5, windowMs: 3_600_000 });
    expect(blocked.success).toBe(false);
  });
});