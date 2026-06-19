import { afterEach, describe, expect, it, vi } from 'vitest';

describe('engage-config env mesh (P0.1)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('derives DYNAMO_MCP from DYNAMO_MCP_URL when DYNAMO_MCP unset', async () => {
    vi.stubEnv('DYNAMO_MCP_URL', 'https://example.test');
    delete process.env.DYNAMO_MCP;
    const { DYNAMO_MCP, DYNAMO_MCP_URL, GOVERNANCE_ENDPOINT } = await import(
      './engage-config.js'
    );
    expect(DYNAMO_MCP_URL).toBe('https://example.test');
    expect(DYNAMO_MCP).toBe('https://example.test/call_connected_tool');
    expect(GOVERNANCE_ENDPOINT).toBe('https://example.test/governance');
  });

  it('strips trailing slash from DYNAMO_MCP_URL', async () => {
    vi.stubEnv('DYNAMO_MCP_URL', 'https://example.test/');
    delete process.env.DYNAMO_MCP;
    const { DYNAMO_MCP_URL, DYNAMO_MCP } = await import('./engage-config.js');
    expect(DYNAMO_MCP_URL).toBe('https://example.test');
    expect(DYNAMO_MCP).toBe('https://example.test/call_connected_tool');
  });

  it('prefers explicit DYNAMO_MCP over derived URL', async () => {
    vi.stubEnv('DYNAMO_MCP_URL', 'https://example.test');
    vi.stubEnv('DYNAMO_MCP', 'https://override.test/call_connected_tool');
    const { DYNAMO_MCP } = await import('./engage-config.js');
    expect(DYNAMO_MCP).toBe('https://override.test/call_connected_tool');
  });

  it('prefers explicit GOVERNANCE_ENDPOINT', async () => {
    vi.stubEnv('DYNAMO_MCP_URL', 'https://example.test');
    vi.stubEnv('GOVERNANCE_ENDPOINT', 'https://gov.custom.test/governance');
    const { GOVERNANCE_ENDPOINT } = await import('./engage-config.js');
    expect(GOVERNANCE_ENDPOINT).toBe('https://gov.custom.test/governance');
  });

  it('does not switch governance MCP to Railway when only GOVERNANCE_API_KEY is set', async () => {
    vi.stubEnv('GOVERNANCE_API_KEY', 'test-key-should-not-imply-remote');
    vi.stubEnv('GOVERNANCE_MCP_URL', '');
    const { XRAY_GOVERNANCE_MCP_URL, USE_REMOTE_GOVERNANCE_MCP } = await import(
      './engage-config.js'
    );
    expect(XRAY_GOVERNANCE_MCP_URL).toBe('http://localhost:4002');
    expect(USE_REMOTE_GOVERNANCE_MCP).toBe(false);
  });

  it('marks remote governance only when GOVERNANCE_MCP_URL is explicit', async () => {
    vi.stubEnv('GOVERNANCE_MCP_URL', 'https://governance.example.test');
    const { USE_REMOTE_GOVERNANCE_MCP } = await import('./engage-config.js');
    expect(USE_REMOTE_GOVERNANCE_MCP).toBe(true);
  });
});