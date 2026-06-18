import * as crypto from 'crypto';
import { frameworkLogger } from '../../xray/src/index.js';

export function generateRequestId(): string {
  return crypto.randomUUID();
}

/** Log internally; return generic client message (starters pattern). */
export function sanitizeToolError(error: unknown, requestId?: string): string {
  frameworkLogger.log('marketplace-mcp', 'tool-error', 'warning', {
    requestId,
    error: error instanceof Error ? error.message : String(error),
  });
  return 'Tool execution failed';
}