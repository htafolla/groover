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
import { getSession, ChallengeTrace, ChallengeTurn } from './challenge.js';

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
        },
      };
    }
    case 'submit_challenge_turn': {
      const sessionId = (request.arguments.sessionId as string) || '';
      const session = getSession(sessionId);
      if (!session) throw new Error('Challenge session not found');
      // Append turn to session — client builds trace locally, this is just for server-side tracking
      const turn: ChallengeTurn = {
        toolCall: (request.arguments.toolCall as string) || '',
        input: (request.arguments.input as string) || '',
        output: (request.arguments.output as string) || '',
        reasoning: (request.arguments.reasoning as string) || '',
        timestamp: Date.now(),
        hash: (request.arguments.hash as string) || '',
      };
      session.turns.push(turn);
      if (session.status === 'pending') session.status = 'in-progress';
      return { success: true, sessionId, turnCount: session.turns.length };
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
      try {
        const rpc = JSON.parse(body);
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
              { name: 'register_plugin', description: 'Register agent with Proof of Autonomy (ed25519 PoP + adaptive MCP challenge trace)', inputSchema: { type: 'object' } },
              { name: 'get_registration_challenge', description: 'Start registration: get nonce + adaptive challenge session for multi-turn MCP orchestration', inputSchema: { type: 'object' } },
              { name: 'submit_challenge_turn', description: 'Submit a turn in the adaptive challenge session (for server-side tracking)', inputSchema: { type: 'object' } },
              { name: 'search_plugins', description: 'Search registry with MCP signals', inputSchema: { type: 'object' } },
              { name: 'get_plugin_ui_manifest', description: 'Retrieve UI manifest', inputSchema: { type: 'object' } },
              { name: 'list_mcp_servers', description: 'List 10 integrated MCP servers', inputSchema: { type: 'object' } }
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
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'bad request' }));
        frameworkLogger.log('marketplace-mcp', 'mcp-http-error', 'error', { error: String(e) });
      }
    });
  } else {
    res.writeHead(200);
    res.end('Groover MCP Registry active. POST /mcp for tools.');
  }
});

async function runMcpServer() {
  frameworkLogger.log('marketplace-mcp', 'server-start', 'success', {
    exposedTools: ['get_registration_challenge', 'submit_challenge_turn', 'register_plugin', 'search_plugins', 'get_plugin_ui_manifest', 'list_mcp_servers'],
    purpose: 'registry for ai agents to self verify via adaptive multi-turn challenge',
    note: 'Railway hosted per gov-024. Real HTTP MCP. Challenge trace validation + Dynamo hammer.'
  });
  server.listen(PORT, () => {
    frameworkLogger.log('marketplace-mcp', 'listening', 'success', { port: PORT, url: 'http://localhost:' + PORT + '/mcp' });
  });
}

const isMain = process.argv.includes('--mcp-server') || process.argv.includes('--registry') || !!process.env.RAILWAY_ENVIRONMENT || !!process.env.PORT;

if (isMain) {
  runMcpServer().catch((e) => frameworkLogger.log('marketplace-mcp', 'fatal', 'error', { error: String(e) }));
}

export { runMcpServer, handleMcpToolCall };