/**
 * Groover MCP Server — Streamable HTTP + session SSE.
 *   GET /sse — SSE stream, session-specific POST URL
 *   POST /messages?sessionId=UUID — JSON-RPC (response via SSE)
 *   POST /mcp — Streamable HTTP JSON-RPC (starters mcp-http-nextjs pattern)
 *   GET /mcp — tool discovery
 *   GET /health — health check
 *
 * P0.9: Zod boundaries + per-IP rate limits on POST /mcp and tool args.
 */

import * as http from 'http';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { frameworkLogger } from '../../xray/src/index.js';
import { registerPlugin, searchPlugins, getPluginUiManifest, getRegistrationChallenge } from './index.js';
import { listMcpServers } from '../../xray/src/index.js';
import { getSession, submitTurn, ChallengeTrace } from './challenge.js';
import { JsonRpcRequestSchema } from './mcp-schemas.js';
import { generateRequestId } from './mcp-request.js';
import {
  dispatchMcpMethod,
  mcpError,
  mcpResult,
  processStreamableMcpRequest,
  type McpJsonResponse,
} from './mcp-streamable-http.js';

// ── In-memory pub/sub for session-based SSE ──

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

async function publish(channel: string, message: string): Promise<boolean> {
  return emitter.emit(channel, message);
}

async function subscribe(channel: string, callback: (message: string) => void): Promise<() => Promise<void>> {
  emitter.on(channel, callback);
  return async () => { emitter.off(channel, callback); };
}

const activeSessions = new Map<string, true>();

// ── Tool definitions for MCP tools/list ──

export const TOOL_DEFINITIONS = [
  {
    name: 'register_plugin',
    description: 'Register agent with Proof of Autonomy (ed25519 PoP + adaptive MCP challenge trace)',
    inputSchema: {
      type: 'object',
      properties: {
        pubkey: { type: 'string', description: 'Ed25519 public key (PEM)' },
        payload: { type: 'string', description: 'Arbitrary payload string' },
        signature: { type: 'string', description: 'Ed25519 signature over nonce+payload' },
        challengeNonce: { type: 'string', description: 'Nonce from get_registration_challenge' },
        challengeTrace: { type: 'object', description: 'Adaptive multi-turn challenge trace' },
        metadata: { type: 'object', description: 'Plugin metadata (name, version, etc.)' },
        uiManifest: { type: 'object', description: 'Optional UI manifest for marketplace display' },
      },
      required: ['pubkey', 'payload', 'signature', 'challengeNonce', 'challengeTrace'],
    },
  },
  {
    name: 'get_registration_challenge',
    description: 'Start registration: get nonce + adaptive challenge session for multi-turn MCP orchestration',
    inputSchema: {
      type: 'object',
      properties: { pubkey: { type: 'string', description: 'Ed25519 public key (PEM)' } },
      required: ['pubkey'],
    },
  },
  {
    name: 'submit_challenge_turn',
    description: 'Submit a turn in the adaptive challenge session (for server-side tracking)',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Challenge session ID' },
        toolCall: { type: 'string', description: 'MCP tool invoked' },
        input: { type: 'string', description: 'Tool input' },
        output: { type: 'string', description: 'Tool output' },
        reasoning: { type: 'string', description: 'Agent reasoning' },
        hash: { type: 'string', description: 'Turn hash for chain integrity' },
      },
      required: ['sessionId', 'toolCall', 'hash'],
    },
  },
  {
    name: 'search_plugins',
    description: 'Search registry with MCP signals',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search query' } },
    },
  },
  {
    name: 'get_plugin_ui_manifest',
    description: 'Retrieve UI manifest',
    inputSchema: {
      type: 'object',
      properties: { did: { type: 'string', description: 'DID of the plugin' } },
      required: ['did'],
    },
  },
  {
    name: 'list_mcp_servers',
    description: 'List available MCP servers for correlation',
    inputSchema: { type: 'object' },
  },
];

// ── Tool handlers ──

export const TOOL_HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<unknown> | unknown> = {
  async register_plugin(args) {
    let challengeTrace: ChallengeTrace;
    if (typeof args.challengeTrace === 'string') {
      challengeTrace = JSON.parse(args.challengeTrace) as ChallengeTrace;
    } else {
      challengeTrace = args.challengeTrace as ChallengeTrace;
    }
    const result = await registerPlugin({
      pubkey: args.pubkey as string,
      payload: args.payload as string,
      metadata: (args.metadata as Record<string, unknown>) || {},
      signature: args.signature as string,
      challengeNonce: args.challengeNonce as string,
      challengeTrace,
      uiManifest: args.uiManifest as import('./agent-ui-manifest.js').AgentUiManifest | undefined,
    });
    const record = result as { did?: string; status?: string };
    return { success: true, did: record.did || record.status, record: result };
  },

  get_registration_challenge(args) {
    const pubkey = args.pubkey as string;
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
  },

  submit_challenge_turn(args) {
    const sessionId = args.sessionId as string;
    const session = getSession(sessionId);
    if (!session) throw new Error('Challenge session not found');
    const timestamp = typeof args.timestamp === 'number' ? args.timestamp : Date.now();
    const { followUpPrompt } = submitTurn(sessionId, {
      toolCall: (args.toolCall as string) || '',
      input: (args.input as string) || '',
      output: (args.output as string) || '',
      reasoning: (args.reasoning as string) || '',
      timestamp,
      hash: (args.hash as string) || '',
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
  },

  async search_plugins(args) {
    const query = (args.query as string) || 'cross-correlation';
    const results = await searchPlugins(query);
    return { success: true, count: results.length, results };
  },

  get_plugin_ui_manifest(args) {
    const did = args.did as string;
    const manifest = getPluginUiManifest(did);
    return { success: !!manifest, manifest };
  },

  list_mcp_servers() {
    const servers = listMcpServers();
    return { success: true, count: servers.length, servers };
  },
};

// ── Handlers ──

async function handleMcpToolCall(request: {
  name: string;
  arguments: Record<string, unknown>;
}): Promise<unknown> {
  frameworkLogger.log('marketplace-mcp', 'tool-call', 'info', { tool: request.name });
  const handler = TOOL_HANDLERS[request.name];
  if (!handler) throw new Error('Unknown tool: ' + request.name);
  return handler(request.arguments);
}

async function handleMCPMessage(sessionId: string, msg: unknown): Promise<McpJsonResponse | null> {
  const parsed = JsonRpcRequestSchema.safeParse(msg);
  if (!parsed.success) {
    const fallbackId =
      msg && typeof msg === 'object' && msg !== null && 'id' in msg
        ? (msg as { id: string | number }).id
        : null;
    return mcpError(fallbackId, -32700, 'Parse error: Invalid JSON-RPC 2.0 request', parsed.error.format());
  }

  const { id, method, params } = parsed.data;
  if (id === undefined) return null;

  if (sessionId !== 'legacy') {
    frameworkLogger.log('marketplace-mcp', 'session-message', 'info', {
      sessionId: sessionId.slice(0, 8),
      method,
    });
  }

  return dispatchMcpMethod(
    id,
    method,
    params as Record<string, unknown> | undefined,
    TOOL_HANDLERS,
    generateRequestId(),
    TOOL_DEFINITIONS,
  );
}

function clientKeyFromRequest(req: http.IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return req.socket.remoteAddress || 'unknown';
}

function writeStreamableOutcome(
  res: http.ServerResponse,
  outcome: Awaited<ReturnType<typeof processStreamableMcpRequest>>,
): void {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'X-Request-Id': outcome.requestId,
  };
  if (outcome.kind === 'notification') {
    res.writeHead(outcome.status, headers);
    res.end();
    return;
  }
  res.writeHead(outcome.status, headers);
  res.end(JSON.stringify(outcome.json));
}

// ── HTTP Server ──

const PORT = parseInt(process.env.PORT || '3000', 10);

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/sse') {
    const sessionId = crypto.randomUUID();
    const channel = `session:${sessionId}`;
    activeSessions.set(sessionId, true);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const cleanup = () => {
      activeSessions.delete(sessionId);
      unsub().catch(() => {});
    };

    let unsub: () => Promise<void> = () => Promise.resolve();
    unsub = await subscribe(channel, async (raw: string) => {
      try {
        res.write(`data: ${raw}\n\n`);
      } catch {
        cleanup();
      }
    });

    res.write(`event: endpoint\ndata: /messages?sessionId=${sessionId}\n\n`);
    frameworkLogger.log('marketplace-mcp', 'sse-connect', 'info', { sessionId: sessionId.slice(0, 8) });

    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(keepAlive);
      cleanup();
      frameworkLogger.log('marketplace-mcp', 'sse-disconnect', 'info', { sessionId: sessionId.slice(0, 8) });
    });
    return;
  }

  if (req.method === 'POST' && req.url?.startsWith('/messages')) {
    const sessionId = new URL(req.url, `http://${req.headers.host}`).searchParams.get('sessionId');
    if (!sessionId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32602, message: 'Missing sessionId query parameter' },
      }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const rpc = JSON.parse(body) as unknown;
        const result = await handleMCPMessage(sessionId, rpc);
        if (result) {
          const delivered = await publish(`session:${sessionId}`, JSON.stringify(result));
          if (!delivered) {
            frameworkLogger.log('marketplace-mcp', 'messages-no-subscriber', 'warning', {
              sessionId: sessionId.slice(0, 8),
            });
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: raw } }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/mcp') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(body) as unknown;
      } catch {
        const requestId = generateRequestId();
        res.writeHead(400, {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify(mcpError(null, -32700, 'Parse error')));
        return;
      }
      const outcome = await processStreamableMcpRequest(
        parsed,
        clientKeyFromRequest(req),
        TOOL_HANDLERS,
        TOOL_DEFINITIONS,
      );
      if (outcome.kind === 'json' && outcome.json.result) {
        frameworkLogger.log('marketplace-mcp', 'streamable-mcp', 'success', {
          requestId: outcome.requestId,
          status: outcome.status,
        });
      }
      writeStreamableOutcome(res, outcome);
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/mcp') {
    const requestId = generateRequestId();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
    });
    res.end(JSON.stringify({
      protocol: 'mcp',
      version: '0.2-mvp',
      transport: 'streamable-http',
      tools: TOOL_DEFINITIONS.map((t) => t.name),
    }));
    return;
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      server: 'groover-registry',
      version: '0.2-mvp',
      uptime: process.uptime(),
    }));
    return;
  }

  res.writeHead(200);
  res.end(
    'Groover MCP Registry active. GET /sse, POST /messages, POST /mcp (Streamable HTTP), GET /mcp, GET /health.',
  );
});

async function runMcpServer() {
  frameworkLogger.log('marketplace-mcp', 'server-start', 'success', {
    exposedTools: Object.keys(TOOL_HANDLERS),
    purpose: 'registry for ai agents to self verify via adaptive multi-turn challenge',
    note: 'P0.9 Streamable HTTP on POST /mcp with Zod + rate limits',
  });
  server.listen(PORT, () => {
    frameworkLogger.log('marketplace-mcp', 'listening', 'success', {
      port: PORT,
      url: 'http://localhost:' + PORT + '/mcp',
    });
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

const isMain =
  process.argv.includes('--mcp-server') ||
  process.argv.includes('--registry') ||
  !!process.env.RAILWAY_ENVIRONMENT ||
  !!process.env.PORT;

if (isMain) {
  runMcpServer().catch((e) =>
    frameworkLogger.log('marketplace-mcp', 'fatal', 'error', { error: String(e) }),
  );
}

export {
  runMcpServer,
  handleMcpToolCall,
  handleMCPMessage,
  mcpResult,
  mcpError,
  processStreamableMcpRequest,
};