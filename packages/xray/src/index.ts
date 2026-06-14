/**
 * @groover/xray
 * 0xRay MCP execution & orchestration bridge.
 * Primary integration point for all connected MCP endpoints (Dynamo, xray-*, strray-*, grok_com_github).
 * Per ARCHITECTURE.md and AGENTS.md.
 *
 * All three subsystem methods (orchestrate, govern, enforce) make real MCP calls.
 * No stub mode. No silent fallthroughs. If MCP servers are unreachable, errors propagate.
 */
import { getFrameworkLogger, frameworkLogger } from './logger.js';
import * as https from 'https';
import * as http from 'http';

export { frameworkLogger, getFrameworkLogger };

const MCP_ENDPOINTS: Record<string, string> = {
  'xray-orchestrator': process.env.ORCHESTRATOR_MCP_URL || 'http://localhost:4001',
  'xray-governance': process.env.GOVERNANCE_MCP_URL || 'http://localhost:4002',
  'xray-enforcer': process.env.ENFORCER_MCP_URL || 'http://localhost:4003',
};

export function mcpCall(server: string, method: string, params: unknown = {}): Promise<unknown> {
  const baseUrl = MCP_ENDPOINTS[server];
  if (!baseUrl) return Promise.reject(new Error(`No URL configured for MCP server: ${server}`));
  const proto = baseUrl.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params });
    const url = new URL(baseUrl + '/mcp');
    const req = proto.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      rejectUnauthorized: process.env.MCP_REJECT_UNAUTHORIZED === 'false' ? false : true,
      timeout: 5000,
    }, (res) => {
      let data = '';
      res.on('data', (c: string) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

export interface MCPBridge {
  orchestrate(description: string, tasks: Array<{id: string; description: string; type: string}>): Promise<unknown>;
  govern(proposal: {id: string; title: string; description: string; type: string; confidence: number; evidence: string[]}): Promise<unknown>;
  enforce(operation: string, files: string[], newCode?: string): Promise<{score: number; violations: unknown[]}>;
}

export class XrayBridge implements MCPBridge {
  private _mcpCall: typeof mcpCall;

  constructor(mcpCallFn?: typeof mcpCall) {
    this._mcpCall = mcpCallFn ?? mcpCall;

    frameworkLogger.log('xray', 'bridge-init', 'success', {
      mcpEndpoints: Object.keys(MCP_ENDPOINTS),
      orchestrateUrl: MCP_ENDPOINTS['xray-orchestrator'],
      governUrl: MCP_ENDPOINTS['xray-governance'],
      enforceUrl: MCP_ENDPOINTS['xray-enforcer'],
    });
  }

  async orchestrate(description: string, tasks: Array<{id: string; description: string; type: string}>) {
    frameworkLogger.log('xray', 'orchestrate-call', 'info', { description, taskCount: tasks.length });
    return await this._mcpCall('xray-orchestrator', 'tools/call', { name: 'orchestrate-task', arguments: { description, tasks } });
  }

  async govern(proposal: any) {
    frameworkLogger.log('xray', 'govern-proposal', 'info', { id: proposal.id, type: proposal.type });
    return await this._mcpCall('xray-governance', 'tools/call', { name: 'govern_proposals', arguments: { proposal } });
  }

  async enforce(operation: string, files: string[], newCode?: string) {
    frameworkLogger.log('xray', 'enforce-call', 'info', { operation, fileCount: files.length });
    const result = await this._mcpCall('xray-enforcer', 'tools/call', {
      name: 'codex-enforcement',
      arguments: { operation, files, newCode },
    }) as any;
    return result?.result || result;
  }
}

export const xrayBridge = new XrayBridge();

/**
 * MCP Servers Discovery & Indexing (for Groover marketplace/plugin capabilities).
 * Indexes all discovered servers from exhaustive search_tool during build.
 * Runtime: Use xray-orchestrator / Dynamo__call_connected_tool / xray-skills__list-skills.
 * Plugins can declare required MCPs in uiManifest or metadata.
 * See docs/mcp-servers-index.md and docs/mcp-tools-index.json.
 */
export interface McpServerInfo {
  name: string;
  role: string;
  toolCount: number;
  keyTools: string[];
}

export function listMcpServers(): McpServerInfo[] {
  frameworkLogger.log('xray', 'mcp-list-servers', 'success', { count: 10 });
  return [
    { name: 'Dynamo', role: 'Governance & signals (SSOT, Hammer, triangulation for core correlation, isotopic math)', toolCount: 20, keyTools: ['govern_with_solar', 'evaluate_governance', 'triangulate_signals', 'call_connected_tool', 'harmonic_oscillator', 'wave_function', 'optimize_cascade', 'cross_correlate', 'emit_isotopic_signal'] },
    { name: 'grok_com_github', role: 'GitHub signals & ops for marketplace/repo correlation, releases, code search', toolCount: 44, keyTools: ['search_code', 'get_file_contents', 'list_releases', 'list_branches', 'create_branch', 'fork_repository', 'get_me', 'search_repositories'] },
    { name: 'strray-enforcer', role: 'Codex enforcement & quality gates (parallel variant for resilience)', toolCount: 7, keyTools: ['codex-enforcement', 'quality-gate-check', 'run-pre-commit-validation', 'security-scan'] },
    { name: 'strray-governance', role: 'Proposal governance + active codex snapshot (parallel variant)', toolCount: 3, keyTools: ['govern_proposals', 'govern_reflection', 'get_active_codex'] },
    { name: 'strray-orchestrator', role: 'thinDispatch 7-flow orchestration, complexity analysis, delegation (parallel)', toolCount: 6, keyTools: ['orchestrate-task', 'analyze-complexity', 'govern-and-apply', 'optimize-orchestration'] },
    { name: 'strray-skills', role: 'Specialized skills invocation (code-review, project-analysis, ui-ux etc; parallel)', toolCount: 13, keyTools: ['list-skills', 'invoke-skill', 'skill-code-review', 'skill-project-analysis', 'skill-testing-strategy', 'skill-ui-ux-design'] },
    { name: 'xray-enforcer', role: 'Codex enforcement & quality gates (primary per AGENTS.md)', toolCount: 7, keyTools: ['codex-enforcement', 'quality-gate-check', 'run-pre-commit-validation', 'security-scan'] },
    { name: 'xray-governance', role: 'Proposal governance + active codex (68 terms v3.0.10; primary per AGENTS.md)', toolCount: 3, keyTools: ['govern_proposals', 'govern_reflection', 'get_active_codex'] },
    { name: 'xray-orchestrator', role: 'thinDispatch 7-flow orchestration, complexity analysis, delegation (primary)', toolCount: 6, keyTools: ['orchestrate-task', 'analyze-complexity', 'govern-and-apply', 'get-orchestration-status'] },
    { name: 'xray-skills', role: 'Specialized skills (code-review, api-design, ui-ux, project-analysis, docs, security, testing; primary per AGENTS.md)', toolCount: 13, keyTools: ['list-skills', 'invoke-skill', 'skill-code-review', 'skill-project-analysis', 'skill-ui-ux-design', 'skill-testing-strategy', 'skill-documentation-generation'] }
  ];
}

export async function getMcpToolSchema(server: string, tool: string): Promise<object | null> {
  frameworkLogger.log('xray', 'mcp-get-schema', 'info', { server, tool });
  // In full runtime: proxy via Dynamo__call_connected_tool or xray-orchestrator.
  // For MVP: return from index (see docs/mcp-tools-index.json).
  return { note: 'See docs/mcp-tools-index.json for full schemas. Use search_tool or connected MCP for live.' };
}

