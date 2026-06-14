/**
 * Deploy verification script for Groover Railway MCP registry.
 * Tests all 5 MCP endpoints against the live deployed service.
 * Usage: RAILWAY_MCP_URL=https://... npx tsx deploy/confirm-railway-endpoints.ts
 * Default URL: https://registry-production-e2c4.up.railway.app
 */
import * as https from 'https';
import * as crypto from 'crypto';
import { frameworkLogger } from '../packages/xray/src/index.js';

const RAILWAY_PROD = 'https://registry-production-e2c4.up.railway.app';
const liveBase = (process.env.RAILWAY_MCP_URL || process.env.DEPLOYED_REGISTRY_URL || RAILWAY_PROD).replace(/\/$/, '');

interface McpEndpoint {
  name: string;
  args: (base: string) => Record<string, unknown>;
}

const MCP_ENDPOINTS: McpEndpoint[] = [
  { name: 'get_registration_challenge', args: () => ({ pubkey: crypto.randomBytes(32).toString('hex') }) },
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

  // Step 2: List tools — expect all 5
  const listRpc = await postMcp('tools/list', {}) as { result?: { tools?: Array<{ name: string }> } };
  const advertisedTools = (listRpc?.result?.tools || []).map((t: { name: string }) => t.name);
  const expectedTools = ['get_registration_challenge', 'register_plugin', 'search_plugins', 'get_plugin_ui_manifest', 'list_mcp_servers'];
  const allAdvertised = expectedTools.every(t => advertisedTools.includes(t));
  if (!allAdvertised) {
    frameworkLogger.log('deploy-verify', 'tools-list-mismatch', 'error', { advertised: advertisedTools, expected: expectedTools });
    return false;
  }
  frameworkLogger.log('deploy-verify', 'tools-list-ok', 'success', { count: advertisedTools.length, tools: advertisedTools });

  // Step 3: Call tools that don't depend on prior registration
  const all: Record<string, boolean> = {};

  for (const ep of MCP_ENDPOINTS) {
    const base = Date.now().toString(36);
    const rpcResp = await postMcp('tools/call', { name: ep.name, arguments: ep.args(base) });
    const parsed = parseMcpResult(rpcResp) as Record<string, unknown> | null;
    const ok = !!(parsed && parsed.success !== false && !parsed.error);
    all[ep.name] = ok;
    frameworkLogger.log('deploy-verify', `endpoint-${ep.name}`, ok ? 'success' : 'error', { ok, hasResult: !!parsed });
  }

  // Step 3b: search_plugins
  const searchResult = parseMcpResult(await postMcp('tools/call', {
    name: 'search_plugins',
    arguments: { query: 'deploy verification cross-correlation' },
  })) as Record<string, unknown> | null;
  all.search_plugins = !!(searchResult && searchResult.success !== false && !searchResult.error);

  // Step 3c: register_plugin with uiManifest (so get_plugin_ui_manifest returns a valid result)
  const regPubkey = crypto.randomBytes(32).toString('hex');
  const regResult = parseMcpResult(await postMcp('tools/call', {
    name: 'register_plugin',
    arguments: {
      pubkey: regPubkey,
      payload: `verify-${Date.now()}`,
      metadata: { name: 'deploy-verify-agent' },
      uiManifest: { version: '1', displayMode: 'form', fields: [{ id: 'q', label: 'Query', fieldType: 'text' }] },
    },
  })) as Record<string, unknown> | null;
  all.register_plugin = !!(regResult && regResult.success !== false && !regResult.error);

  // Step 3d: get_plugin_ui_manifest with the freshly registered DID
  const regDid = regResult?.did || (regResult?.record as Record<string, unknown>)?.did;
  if (regDid) {
    const uiResult = parseMcpResult(await postMcp('tools/call', {
      name: 'get_plugin_ui_manifest',
      arguments: { did: regDid },
    })) as Record<string, unknown> | null;
    all.get_plugin_ui_manifest = !!(uiResult && uiResult.success !== false && !uiResult.error);
  }

  const allPassed = Object.values(all).every(Boolean);
  frameworkLogger.log('deploy-verify', 'complete', allPassed ? 'success' : 'error', {
    url: liveBase, results: all, allPassed,
  });

  return allPassed;
}

main().then((ok) => {
  process.exit(ok ? 0 : 1);
}).catch((e) => {
  frameworkLogger.log('deploy-verify', 'fatal', 'error', { error: String(e) });
  process.exit(1);
});
