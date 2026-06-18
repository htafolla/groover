import { checkMcpHttpRateLimit, checkMcpToolRateLimit } from './mcp-rate-limit.js';
import { generateRequestId, sanitizeToolError } from './mcp-request.js';
import {
  JsonRpcRequestSchema,
  ToolsCallParamsSchema,
  validateToolArguments,
  type JsonRpcRequest,
} from './mcp-schemas.js';

export type McpJsonResponse = {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export function mcpResult(id: string | number | null, result: unknown): McpJsonResponse {
  return { jsonrpc: '2.0', id, result };
}

export function mcpError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): McpJsonResponse {
  return { jsonrpc: '2.0', id, error: { code, message, data } };
}

export type StreamableMcpOutcome =
  | { kind: 'notification'; status: 202; requestId: string; body: null }
  | { kind: 'json'; status: number; requestId: string; json: McpJsonResponse };

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown> | unknown;

export async function dispatchMcpMethod(
  id: string | number,
  method: string,
  params: Record<string, unknown> | undefined,
  handlers: Record<string, ToolHandler>,
  requestId: string,
  toolDefinitions: unknown[],
): Promise<McpJsonResponse> {
  switch (method) {
    case 'initialize':
      return mcpResult(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'groover-registry', version: '0.2-mvp' },
      });
    case 'ping':
      return mcpResult(id, {});
    case 'tools/list':
      return mcpResult(id, { tools: toolDefinitions });
    case 'tools/call': {
      const callParams = ToolsCallParamsSchema.safeParse(params);
      if (!callParams.success) {
        return mcpError(
          id,
          -32602,
          'Invalid params: Expected { name: string, arguments: object }',
          callParams.error.format(),
        );
      }
      const { name, arguments: rawArgs } = callParams.data;
      const handler = handlers[name];
      if (!handler) {
        return mcpError(id, -32601, `Unknown tool: ${name}`);
      }
      const validated = validateToolArguments(name, rawArgs);
      if (!validated.success) {
        return mcpError(
          id,
          -32602,
          `Invalid arguments for tool: ${name}`,
          validated.error.format(),
        );
      }
      try {
        const result = await handler(validated.data);
        return mcpResult(id, {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        });
      } catch (error) {
        const message =
          error instanceof Error &&
          (error.message.includes('pubkey is required') ||
            error.message.includes('Challenge session not found'))
            ? error.message
            : sanitizeToolError(error, requestId);
        const code =
          error instanceof Error &&
          (error.message.includes('pubkey is required') ||
            error.message.includes('Challenge session not found'))
            ? -32602
            : -32603;
        return mcpError(id, code, message);
      }
    }
    default:
      return mcpError(id, -32601, `Method not found: ${method}`);
  }
}

export async function processStreamableMcpRequest(
  body: unknown,
  clientKey: string,
  handlers: Record<string, ToolHandler>,
  toolDefinitions: unknown[],
): Promise<StreamableMcpOutcome> {
  const requestId = generateRequestId();
  const httpLimit = checkMcpHttpRateLimit(clientKey);
  if (!httpLimit.success) {
    return {
      kind: 'json',
      status: 429,
      requestId,
      json: mcpError(null, -32000, 'Rate limit exceeded'),
    };
  }

  const parsed = JsonRpcRequestSchema.safeParse(body);
  if (!parsed.success) {
    const fallbackId =
      body && typeof body === 'object' && body !== null && 'id' in body
        ? (body as { id: string | number }).id
        : null;
    return {
      kind: 'json',
      status: 400,
      requestId,
      json: mcpError(
        fallbackId,
        -32700,
        'Parse error: Invalid JSON-RPC 2.0 request',
        parsed.error.format(),
      ),
    };
  }

  const { id, method, params } = parsed.data;
  if (id === undefined) {
    return { kind: 'notification', status: 202, requestId, body: null };
  }

  if (method === 'tools/call') {
    const callParams = ToolsCallParamsSchema.safeParse(params);
    const toolName = callParams.success ? callParams.data.name : undefined;
    const toolLimit = checkMcpToolRateLimit(toolName, clientKey);
    if (!toolLimit.success) {
      return {
        kind: 'json',
        status: 429,
        requestId,
        json: mcpError(id, -32000, 'Rate limit exceeded'),
      };
    }
  }

  const json = await dispatchMcpMethod(
    id,
    method,
    params as Record<string, unknown> | undefined,
    handlers,
    requestId,
    toolDefinitions,
  );
  const status = json.error ? (json.error.code === -32603 ? 500 : 400) : 200;
  return { kind: 'json', status, requestId, json };
}

export function parseJsonRpcRequest(body: unknown): JsonRpcRequest | null {
  const parsed = JsonRpcRequestSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}