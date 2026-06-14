/**
 * Groover MCP Server entry - the registry MCP for AI agents to self-verify and register.
 * Exposes core endpoints as MCP tools including adaptive multi-turn challenge.
 * Real HTTP transport for Railway hosting (POST /mcp JSON-RPC subset).
 * Internally uses xray bridge for governance (consumes external MCPs).
 */

import * as http from 'http';
import { frameworkLogger } from '../../xray/src/index.js';
import { registerPlugin, searchPlugins, getPluginUiManifest, getRegistrationChallenge } from './index.js';
import { listMcpServers } from '../../xray/src/index.js';
import { getSession, submitTurn, ChallengeTrace } from './challenge.js';

interface McpToolRequest {
  name: string;
  arguments: Record<string, unknown>;
}

async function handleMcpToolCall(request: McpToolRequest): Promise<unknown> {
      frameworkLogger.log('marketplace-mcp', 'tool-call', 'info', { tool: request.name });

  switch (request.name) {
    case 'register_plugin': {
      const params = request.arguments as any;
      let challengeTrace: ChallengeTrace;
      if (typeof params.challengeTrace === 'string') {
        challengeTrace = JSON.parse(params.challengeTrace);
      } else {
        challengeTrace = params.challengeTrace;
      }
      const result = await registerPlugin({
        pubkey: params.pubkey,
        payload: params.payload,
        metadata: params.metadata || {},
        signature: params.signature,
        challengeNonce: params.challengeNonce,
        challengeTrace,
        uiManifest: params.uiManifest,
      });
      return { success: true, did: (result as any).did || (result as any).status, record: result };
    }
    case 'get_registration_challenge': {
      const pubkey = (request.arguments.pubkey as string) || '';
      if (!pubkey) throw new Error('pubkey is required for challenge');
      const challenge = getRegistrationChallenge(pubkey);
      return {
        success: true,
        nonce: challenge.nonce,
        ttl: challenge.ttl,
        session: {
          sessionId: challenge.session.sessionId,
          task: challenge.session.task,
          status: challenge.session.status,
          followUpPrompt: challenge.session.followUpPrompt || null,
          followUpCompleted: challenge.session.followUpCompleted || false,
        },
      };
    }
    case 'submit_challenge_turn': {
      const sessionId = (request.arguments.sessionId as string) || '';
      const session = getSession(sessionId);
      if (!session) throw new Error('Challenge session not found');
      const { followUpPrompt } = submitTurn(sessionId, {
        toolCall: (request.arguments.toolCall as string) || '',
        input: (request.arguments.input as string) || '',
        output: (request.arguments.output as string) || '',
        reasoning: (request.arguments.reasoning as string) || '',
        timestamp: Date.now(),
        hash: (request.arguments.hash as string) || '',
      });
      if (followUpPrompt) {
        frameworkLogger.log('marketplace-mcp', 'follow-up-generated', 'info', {
          sessionId: sessionId.slice(0, 16),
          followUpPrompt: followUpPrompt.slice(0, 80),
        });
      }
      if (session.followUpCompleted) {
        frameworkLogger.log('marketplace-mcp', 'follow-up-completed', 'success', {
          sessionId: sessionId.slice(0, 16),
          turnCount: session.turns.length,
        });
      }
      return { success: true, sessionId, turnCount: session.turns.length, followUpPrompt };
    }
    case 'search_plugins': {
      const query = (request.arguments.query as string) || 'cross-correlation';
      const results = await searchPlugins(query);
      return { success: true, count: results.length, results };
    }
    case 'get_plugin_ui_manifest': {
      const did = request.arguments.did as string;
      const manifest = getPluginUiManifest(did);
      return { success: !!manifest, manifest };
    }
    case 'list_mcp_servers': {
      const servers = listMcpServers();
      return { success: true, count: servers.length, servers };
    }
    default:
      throw new Error('Unknown tool: ' + request.name);
  }
}

const PORT = parseInt(process.env.PORT || '3000', 10);

const server = http.createServer(async (req: any, res: any) => {
  if (req.method === 'POST' && req.url === '/mcp') {
    let body = '';
    req.on('data', (chunk: any) => { body += chunk; });
    req.on('end', async () => {
      let rpc: any;
      try {
        rpc = JSON.parse(body);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }));
        return;
      }
      try {
        let resp: any = { jsonrpc: '2.0', id: rpc.id || null };

        if (rpc.method === 'initialize') {
          resp.result = {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'groover-registry', version: '0.2-mvp' }
          };
        } else if (rpc.method === 'tools/list') {
          resp.result = {
            tools: [
              { name: 'register_plugin', description: 'Register agent with Proof of Autonomy (ed25519 PoP + adaptive MCP challenge trace)', inputSchema: { type: 'object', properties: { pubkey: { type: 'string', description: 'Ed25519 public key (PEM)' }, payload: { type: 'string', description: 'Arbitrary payload string' }, signature: { type: 'string', description: 'Ed25519 signature over nonce+payload' }, challengeNonce: { type: 'string', description: 'Nonce from get_registration_challenge' }, challengeTrace: { type: 'object', description: 'Adaptive multi-turn challenge trace' }, metadata: { type: 'object', description: 'Plugin metadata (name, version, etc.)' }, uiManifest: { type: 'object', description: 'Optional UI manifest for marketplace display' } }, required: ['pubkey', 'payload', 'signature', 'challengeNonce', 'challengeTrace'] } },
              { name: 'get_registration_challenge', description: 'Start registration: get nonce + adaptive challenge session for multi-turn MCP orchestration', inputSchema: { type: 'object', properties: { pubkey: { type: 'string', description: 'Ed25519 public key (PEM)' } }, required: ['pubkey'] } },
              { name: 'submit_challenge_turn', description: 'Submit a turn in the adaptive challenge session (for server-side tracking)', inputSchema: { type: 'object', properties: { sessionId: { type: 'string', description: 'Challenge session ID' }, toolCall: { type: 'string', description: 'MCP tool invoked' }, input: { type: 'string', description: 'Tool input' }, output: { type: 'string', description: 'Tool output' }, reasoning: { type: 'string', description: 'Agent reasoning' }, hash: { type: 'string', description: 'Turn hash for chain integrity' } }, required: ['sessionId', 'toolCall', 'hash'] } },
              { name: 'search_plugins', description: 'Search registry with MCP signals', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Search query' } } } },
              { name: 'get_plugin_ui_manifest', description: 'Retrieve UI manifest', inputSchema: { type: 'object', properties: { did: { type: 'string', description: 'DID of the plugin' } }, required: ['did'] } },
              { name: 'list_mcp_servers', description: 'List available MCP servers for correlation', inputSchema: { type: 'object' } }
            ]
          };
        } else if (rpc.method === 'tools/call') {
          const toolName = rpc.params.name;
          const args = rpc.params.arguments || {};
          const result = await handleMcpToolCall({ name: toolName, arguments: args });
          resp.result = { content: [{ type: 'text', text: JSON.stringify(result) }] };
        } else {
          resp.error = { code: -32601, message: 'Method not found' };
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(resp));
        frameworkLogger.log('marketplace-mcp', 'mcp-http', 'success', { method: rpc.method });
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        const message = sanitizeErrorMessage(raw);
        const code = raw.startsWith('pubkey is required') || raw.startsWith('Challenge session not found') ? -32602 : -32603;
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: rpc?.id || null, error: { code, message } }));
        frameworkLogger.log('marketplace-mcp', 'mcp-http-error', 'error', { error: raw });
      }
    });
  } else if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      server: 'groover-registry',
      version: '0.2-mvp',
      uptime: process.uptime(),
    }));
  } else {
    res.writeHead(200);
    res.end('Groover MCP Registry active. POST /mcp for tools, GET /health for status.');
  }
});

const SAFE_ERROR_TOKENS = ['pubkey is required', 'Challenge session not found', 'Unknown tool', 'Invalid or already-used', 'Challenge nonce expired', 'Proof-of-possession failed'];

function sanitizeErrorMessage(raw: string): string {
  if (SAFE_ERROR_TOKENS.some(t => raw.includes(t))) return raw;
  return 'Internal server error';
}

async function runMcpServer() {
  frameworkLogger.log('marketplace-mcp', 'server-start', 'success', {
    exposedTools: ['get_registration_challenge', 'submit_challenge_turn', 'register_plugin', 'search_plugins', 'get_plugin_ui_manifest', 'list_mcp_servers'],
    purpose: 'registry for ai agents to self verify via adaptive multi-turn challenge',
    note: 'Railway hosted per gov-024. Real HTTP MCP. Challenge trace validation + Dynamo hammer.'
  });
  server.listen(PORT, () => {
    frameworkLogger.log('marketplace-mcp', 'listening', 'success', { port: PORT, url: 'http://localhost:' + PORT + '/mcp' });
  });

  process.on('SIGTERM', () => {
    frameworkLogger.log('marketplace-mcp', 'shutdown', 'info', { signal: 'SIGTERM' });
    server.close(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    frameworkLogger.log('marketplace-mcp', 'shutdown', 'info', { signal: 'SIGINT' });
    server.close(() => process.exit(0));
  });
}

const isMain = process.argv.includes('--mcp-server') || process.argv.includes('--registry') || !!process.env.RAILWAY_ENVIRONMENT || !!process.env.PORT;

if (isMain) {
  runMcpServer().catch((e) => frameworkLogger.log('marketplace-mcp', 'fatal', 'error', { error: String(e) }));
}

export { runMcpServer, handleMcpToolCall };