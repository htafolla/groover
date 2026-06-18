/**
 * Minimal Streamable HTTP MCP client for remote xray-governance (Railway).
 * Handles initialize → session id → tools/call flow.
 */

export interface McpStreamableClientOptions {
  baseUrl: string;
  mcpPath?: string;
  apiKey?: string;
  timeoutMs?: number;
}

export class McpStreamableClient {
  private readonly url: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private sessionId: string | null = null;

  constructor(options: McpStreamableClientOptions) {
    const path = options.mcpPath ?? '/mcp';
    this.url = `${options.baseUrl.replace(/\/$/, '')}${path}`;
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
    if (this.apiKey) headers['x-api-key'] = this.apiKey;
    if (this.sessionId) headers['mcp-session-id'] = this.sessionId;
    return headers;
  }

  private async post(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const res = await fetch(this.url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const sessionHeader = res.headers.get('mcp-session-id');
    if (sessionHeader) this.sessionId = sessionHeader;

    const contentType = res.headers.get('content-type') ?? '';
    const raw = await res.text();

    if (!res.ok) {
      throw new Error(`MCP ${method} HTTP ${res.status}: ${raw.slice(0, 300)}`);
    }

    if (contentType.includes('text/event-stream')) {
      const dataLine = raw
        .split('\n')
        .find((line) => line.startsWith('data: '));
      if (!dataLine) {
        throw new Error(`MCP ${method}: no SSE data line in response`);
      }
      return JSON.parse(dataLine.slice(6)) as Record<string, unknown>;
    }

    return JSON.parse(raw) as Record<string, unknown>;
  }

  async ensureSession(): Promise<void> {
    if (this.sessionId) return;
    const body = await this.post('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'groover-deploy', version: '0.1.0-mvp' },
    });
    if (body.error) {
      throw new Error(`MCP initialize failed: ${JSON.stringify(body.error)}`);
    }
    if (!this.sessionId) {
      throw new Error('MCP initialize succeeded but no mcp-session-id header returned');
    }
  }

  async callTool(name: string, arguments_: Record<string, unknown>): Promise<unknown> {
    await this.ensureSession();
    const body = await this.post('tools/call', { name, arguments: arguments_ });
    if (body.error) {
      throw new Error(`MCP tools/call ${name} failed: ${JSON.stringify(body.error)}`);
    }
    const result = body.result as {
      content?: Array<{ type?: string; text?: string }>;
    } | undefined;
    const text = result?.content?.find((c) => c.type === 'text' || c.text)?.text;
    if (!text) return result;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}