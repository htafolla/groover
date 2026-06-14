/**
 * Groover MCP Server entry — standard MCP HTTP transport with session-based SSE.
 *   GET /sse — SSE stream, sends `endpoint` event with session-specific POST URL
 *   POST /messages?sessionId=UUID — JSON-RPC request handling (response via SSE)
 *   POST /mcp — legacy synchronous JSON-RPC endpoint (direct response)
 *   GET /health — health check
 *
 * Exposes 6 registry tools including adaptive multi-turn challenge for agent self-verification.
 * Internally uses xray bridge for governance (consumes external MCPs).
 */

import * as http from 'http';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { frameworkLogger } from '../../xray/src/index.js';
import { registerPlugin, searchPlugins, getPluginUiManifest, getRegistrationChallenge } from './index.js';
import { listMcpServers } from '../../xray/src/index.js';
import { getSession, submitTurn, ChallengeTrace } from './challenge.js';

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

// ── Session registry ──

const activeSessions = new Map<string, true>();

// ── JSON-RPC helpers ──

function mcpResult(id: any, result: any) {
  return { jsonrpc: '2.0', id, result };
}

function mcpError(id: any, code: number, message: string, data?: any) {
  return { jsonrpc: '2.0', id, error: { code, message, data } };
}

// ── Tool definitions for MCP tools/list ──

const TOOL_DEFINITIONS = [
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
]

// ── Tool handlers ──

const TOOL_HANDLERS: Record<string, (args: any) => any> = {
  async register_plugin(args: any) {
    let challengeTrace: ChallengeTrace
    if (typeof args.challengeTrace === 'string') {
      challengeTrace = JSON.parse(args.challengeTrace)
    } else {
      challengeTrace = args.challengeTrace
    }
    const result = await registerPlugin({
      pubkey: args.pubkey,
      payload: args.payload,
      metadata: args.metadata || {},
      signature: args.signature,
      challengeNonce: args.challengeNonce,
      challengeTrace,
      uiManifest: args.uiManifest,
    })
    return { success: true, did: (result as any).did || (result as any).status, record: result }
  },

  get_registration_challenge(args: any) {
    const pubkey = (args.pubkey as string) || ''
    if (!pubkey) throw new Error('pubkey is required for challenge')
    const challenge = getRegistrationChallenge(pubkey)
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
    }
  },

  submit_challenge_turn(args: any) {
    const sessionId = (args.sessionId as string) || ''
    const session = getSession(sessionId)
    if (!session) throw new Error('Challenge session not found')
    const { followUpPrompt } = submitTurn(sessionId, {
      toolCall: (args.toolCall as string) || '',
      input: (args.input as string) || '',
      output: (args.output as string) || '',
      reasoning: (args.reasoning as string) || '',
      timestamp: Date.now(),
      hash: (args.hash as string) || '',
    })
    if (followUpPrompt) {
      frameworkLogger.log('marketplace-mcp', 'follow-up-generated', 'info', {
        sessionId: sessionId.slice(0, 16),
        followUpPrompt: followUpPrompt.slice(0, 80),
      })
    }
    if (session.followUpCompleted) {
      frameworkLogger.log('marketplace-mcp', 'follow-up-completed', 'success', {
        sessionId: sessionId.slice(0, 16),
        turnCount: session.turns.length,
      })
    }
    return { success: true, sessionId, turnCount: session.turns.length, followUpPrompt }
  },

  async search_plugins(args: any) {
    const query = (args.query as string) || 'cross-correlation'
    const results = await searchPlugins(query)
    return { success: true, count: results.length, results }
  },

  get_plugin_ui_manifest(args: any) {
    const did = args.did as string
    const manifest = getPluginUiManifest(did)
    return { success: !!manifest, manifest }
  },

  list_mcp_servers(_args: any) {
    const servers = listMcpServers()
    return { success: true, count: servers.length, servers }
  },
}

// ── Backward-compat raw tool call handler (used by tests) ──

async function handleMcpToolCall(request: { name: string; arguments: Record<string, unknown> }): Promise<unknown> {
  frameworkLogger.log('marketplace-mcp', 'tool-call', 'info', { tool: request.name })
  const handler = TOOL_HANDLERS[request.name]
  if (!handler) throw new Error('Unknown tool: ' + request.name)
  return handler(request.arguments)
}

// ── Session-based MCP message handler ──

async function handleMCPMessage(sessionId: string, msg: any): Promise<any> {
  const { jsonrpc, id, method, params } = msg || {}
  if (jsonrpc !== '2.0' || id === undefined) return null // notifications are ignored
  if (sessionId !== 'legacy') {
    frameworkLogger.log('marketplace-mcp', 'session-message', 'info', { sessionId: sessionId.slice(0, 8), method })
  }

  try {
    switch (method) {
      case 'initialize':
        return mcpResult(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'groover-registry', version: '0.2-mvp' },
        })
      case 'ping':
        return mcpResult(id, {})
      case 'tools/list':
        return mcpResult(id, { tools: TOOL_DEFINITIONS })
      case 'tools/call': {
        const { name, arguments: args } = params || {}
        if (!name) return mcpError(id, -32602, 'Missing tool name')
        const handler = TOOL_HANDLERS[name]
        if (!handler) return mcpError(id, -32601, `Unknown tool: ${name}`)
        const result = await handler(args ?? {})
        return mcpResult(id, { content: [{ type: 'text', text: JSON.stringify(result) }] })
      }
      default:
        return mcpError(id, -32601, `Method not found: ${method}`)
    }
  } catch (err: any) {
    return mcpError(id, -32603, 'Internal error', err.message)
  }
}

// ── HTTP Server ──

const PORT = parseInt(process.env.PORT || '3000', 10)

const server = http.createServer(async (req: any, res: any) => {
  // SSE endpoint — standard MCP HTTP transport
  if (req.method === 'GET' && req.url === '/sse') {
    const sessionId = crypto.randomUUID()
    const channel = `session:${sessionId}`
    activeSessions.set(sessionId, true)

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })

    const cleanup = () => {
      activeSessions.delete(sessionId)
      unsub().catch(() => {})
    }

    let unsub: () => Promise<void> = () => Promise.resolve()

    // Subscribe to channel before sending endpoint to avoid race
    unsub = await subscribe(channel, async (raw: string) => {
      try {
        res.write(`data: ${raw}\n\n`)
      } catch {
        cleanup()
      }
    })

    res.write(`event: endpoint\ndata: /messages?sessionId=${sessionId}\n\n`)

    frameworkLogger.log('marketplace-mcp', 'sse-connect', 'info', { sessionId: sessionId.slice(0, 8) })

    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n')
    }, 30000)

    req.on('close', () => {
      clearInterval(keepAlive)
      cleanup()
      frameworkLogger.log('marketplace-mcp', 'sse-disconnect', 'info', { sessionId: sessionId.slice(0, 8) })
    })
    return
  }

  // Session-based JSON-RPC POST — response goes via SSE pub/sub
  if (req.method === 'POST' && req.url?.startsWith('/messages')) {
    const sessionId = new URL(req.url, `http://${req.headers.host}`).searchParams.get('sessionId')
    if (!sessionId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32602, message: 'Missing sessionId query parameter' } }))
      return
    }

    let body = ''
    req.on('data', (chunk: any) => { body += chunk })
    req.on('end', async () => {
      try {
        const rpc = JSON.parse(body)
        const result = await handleMCPMessage(sessionId, rpc)
        if (result) {
          const delivered = await publish(`session:${sessionId}`, JSON.stringify(result))
          if (!delivered) {
            frameworkLogger.log('marketplace-mcp', 'messages-no-subscriber', 'warning', { sessionId: sessionId.slice(0, 8) })
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
        res.end(JSON.stringify({ ok: true }))
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e)
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: raw } }))
      }
    })
    return
  }

  // Legacy synchronous POST /mcp — responds directly, no SSE
  if (req.method === 'POST' && req.url === '/mcp') {
    let body = ''
    req.on('data', (chunk: any) => { body += chunk })
    req.on('end', async () => {
      let rpc: any
      try {
        rpc = JSON.parse(body)
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }))
        return
      }
      try {
        const result = await handleMCPMessage('legacy', rpc)
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
        res.end(JSON.stringify(result || { jsonrpc: '2.0', id: rpc.id || null }))
        frameworkLogger.log('marketplace-mcp', 'legacy-mcp', 'success', { method: rpc.method })
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e)
        const code = raw.includes('pubkey is required') || raw.includes('Challenge session not found') ? -32602 : -32603
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ jsonrpc: '2.0', id: rpc?.id || null, error: { code, message: raw } }))
      }
    })
    return
  }

  // Health check
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'healthy',
      server: 'groover-registry',
      version: '0.2-mvp',
      uptime: process.uptime(),
    }))
    return
  }

  // Catch-all
  res.writeHead(200)
  res.end('Groover MCP Registry active. GET /sse (SSE), POST /messages (JSON-RPC), POST /mcp (legacy), GET /health.')
})

async function runMcpServer() {
  frameworkLogger.log('marketplace-mcp', 'server-start', 'success', {
    exposedTools: Object.keys(TOOL_HANDLERS),
    purpose: 'registry for ai agents to self verify via adaptive multi-turn challenge',
    note: 'Railway hosted per gov-024. Standard MCP HTTP transport with session-based SSE.',
  })
  server.listen(PORT, () => {
    frameworkLogger.log('marketplace-mcp', 'listening', 'success', { port: PORT, url: 'http://localhost:' + PORT + '/sse' })
  })

  process.on('SIGTERM', () => {
    frameworkLogger.log('marketplace-mcp', 'shutdown', 'info', { signal: 'SIGTERM' })
    server.close(() => process.exit(0))
  })
  process.on('SIGINT', () => {
    frameworkLogger.log('marketplace-mcp', 'shutdown', 'info', { signal: 'SIGINT' })
    server.close(() => process.exit(0))
  })
}

const isMain = process.argv.includes('--mcp-server') || process.argv.includes('--registry') || !!process.env.RAILWAY_ENVIRONMENT || !!process.env.PORT

if (isMain) {
  runMcpServer().catch((e) => frameworkLogger.log('marketplace-mcp', 'fatal', 'error', { error: String(e) }))
}

export { runMcpServer, handleMcpToolCall, handleMCPMessage, mcpResult, mcpError }
