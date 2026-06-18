/**
 * Shared Moltbook API client for field workers.
 */

import { API_BASE } from './engage-config.js';

export class MoltbookClient {
  constructor(
    private readonly apiKey: string,
    private readonly apiBase: string = API_BASE,
  ) {}

  static fromEnv(): MoltbookClient {
    const apiKey = process.env.MOLTBOOK_API_KEY;
    if (!apiKey) throw new Error('MOLTBOOK_API_KEY env var not set');
    return new MoltbookClient(apiKey);
  }

  async request(path: string, options: RequestInit = {}): Promise<unknown> {
    const url = path.startsWith('http') ? path : `${this.apiBase}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status} for ${path}: ${text}`);
    }
    return res.json();
  }

  async get(path: string): Promise<unknown> {
    return this.request(path);
  }

  async post(path: string, body: unknown): Promise<unknown> {
    return this.request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
}