/**
 * In-memory rate limiter (starters mcp-http-nextjs pattern).
 * Single Railway instance: in-memory is sufficient for P0.9.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  identifier: string,
  options: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + options.windowMs;
    store.set(identifier, { count: 1, resetAt });
    return {
      success: true,
      limit: options.maxRequests,
      remaining: options.maxRequests - 1,
      resetAt,
    };
  }

  if (entry.count >= options.maxRequests) {
    return {
      success: false,
      limit: options.maxRequests,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  entry.count += 1;
  return {
    success: true,
    limit: options.maxRequests,
    remaining: options.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/** Test helper — clear all buckets. */
export function resetRateLimitStore(): void {
  store.clear();
}

const MCP_GENERAL = { maxRequests: 30, windowMs: 60_000 };
const CHALLENGE_START = { maxRequests: 10, windowMs: 60_000 };
const REGISTER_PLUGIN = { maxRequests: 5, windowMs: 3_600_000 };

export function checkMcpToolRateLimit(toolName: string | undefined, clientKey: string): RateLimitResult {
  const key = clientKey || 'unknown';
  if (toolName === 'register_plugin') {
    return rateLimit(`register:${key}`, REGISTER_PLUGIN);
  }
  if (toolName === 'get_registration_challenge') {
    return rateLimit(`challenge:${key}`, CHALLENGE_START);
  }
  return rateLimit(`mcp:${key}`, MCP_GENERAL);
}

export function checkMcpHttpRateLimit(clientKey: string): RateLimitResult {
  return rateLimit(`mcp:http:${clientKey || 'unknown'}`, MCP_GENERAL);
}