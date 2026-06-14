/**
 * Deploy verification script for Groover Railway MCP registry.
 * Tests all 4 MCP endpoints against the live deployed service.
 * Usage: RAILWAY_MCP_URL=https://... npx tsx deploy/confirm-railway-endpoints.ts
 * Default URL: https://optimistic-victory-production.up.railway.app
 */
import * as https from 'https';
import * as crypto from 'crypto';
import { frameworkLogger } from '../packages/xray/src/index.js';

const RAILWAY_PROD = 'https://optimistic-victory-production.up.railway.app';
const liveBase = (process.env.RAILWAY_MCP_URL || process.env.DEPLOYED_REGISTRY_URL || RAILWAY_PROD).replace(/\/$/, '');

interface McpEndpoint {
  name: string;
  args: (base: string) => Record<string, unknown>;
}

const MCP_ENDPOINTS: McpEndpoint[] = [
  {
    name: 'register_plugin',
    args: (base: string) => ({
      pubkey: crypto.randomBytes(32).toString('hex'),
      payload: `mcp-live-test-${base}`,
      metadata: { name: `live-confirm-agent-${base}` },
      uiManifest: { version: '1', displayMode: 'form', fields: [{ id: 'q', label: 'Query', fieldType: 'text' }] },
    }),
  },
  { name: 'search_plugins', args: () => ({ query: 'live deployed cross-correlation test' }) },
  { name: 'get_plugin_ui_manifest', args: () => ({ did: 'did:plugin:groover:live-test' }) },
  { name: 'list_mcp_servers', args: () => ({}) },
];

function postMcp(method: string, params: unknown = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params });
    const url = new URL(liveBase + '/mcp');
    const req = https.request({
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      rejectUnauthorized: false,
    }, (res) => {
      let data = '';
      res.on('data', (c: string) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function parseMcpResult(rpc: unknown): unknown | null {
  try {
    const r = rpc as { result?: { content?: [{ text?: string }] } };
    if (!r?.result?.content?.[0]) return null;
    return JSON.parse(r.result.content[0].text as string);
  } catch {
    return null;
  }
}

async function main(): Promise<boolean> {
  frameworkLogger.log('deploy-verify', 'start', 'info', { url: liveBase });

  // Step 1: Initialize
  const initRpc = await postMcp('initialize', {}) as { result?: { serverInfo?: { name?: string } } };
  const serverName = initRpc?.result?.serverInfo?.name;
  if (serverName !== 'groover-registry') {
    frameworkLogger.log('deploy-verify', 'initialize-failed', 'error', { got: serverName });
    return false;
  }
  frameworkLogger.log('deploy-verify', 'initialize-ok', 'success', { serverName });

  // Step 2: List tools
  const listRpc = await postMcp('tools/list', {}) as { result?: { tools?: Array<{ name: string }> } };
  const advertisedTools = (listRpc?.result?.tools || []).map((t: { name: string }) => t.name);
  const expectedTools = MCP_ENDPOINTS.map(e => e.name);
  const allAdvertised = expectedTools.every(t => advertisedTools.includes(t));
  if (!allAdvertised) {
    frameworkLogger.log('deploy-verify', 'tools-list-mismatch', 'error', { advertised: advertisedTools, expected: expectedTools });
    return false;
  }
  frameworkLogger.log('deploy-verify', 'tools-list-ok', 'success', { count: advertisedTools.length, tools: advertisedTools });

  // Step 3: Call each tool
  const results: Record<string, boolean> = {};
  let lastRegDid: string | undefined;

  for (const ep of MCP_ENDPOINTS) {
    const base = Date.now().toString(36);
    const callArgs = ep.name === 'get_plugin_ui_manifest' && lastRegDid
      ? { did: lastRegDid }
      : ep.args(base);
    const rpcResp = await postMcp('tools/call', { name: ep.name, arguments: callArgs });
    const parsed = parseMcpResult(rpcResp) as Record<string, unknown> | null;
    const ok = !!(parsed && parsed.success !== false && !parsed.error);
    results[ep.name] = ok;
    if (ep.name === 'register_plugin' && parsed && parsed.did) {
      lastRegDid = parsed.did as string;
    }
    frameworkLogger.log('deploy-verify', `endpoint-${ep.name}`, ok ? 'success' : 'error', {
      ok, hasResult: !!parsed, did: ep.name === 'register_plugin' ? lastRegDid : undefined,
    });
  }

  const allPassed = Object.values(results).every(Boolean);
  frameworkLogger.log('deploy-verify', 'complete', allPassed ? 'success' : 'error', {
    url: liveBase, results, allPassed,
  });

  return allPassed;
}

main().then((ok) => {
  process.exit(ok ? 0 : 1);
}).catch((e) => {
  frameworkLogger.log('deploy-verify', 'fatal', 'error', { error: String(e) });
  process.exit(1);
});
