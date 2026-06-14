/**
 * Groover xray logger bridge.
 * Loads or provides frameworkLogger per AGENTS.md and .opencode/plugin/xray-codex-injection.js pattern.
 * All product code MUST use this. Never direct console.* .
 * Structured logs go to logs/framework/groover-activity.log + .opencode/logs .
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface FrameworkLogEntry {
  module: string;
  event: string;
  status: 'success' | 'warning' | 'error' | 'info';
  data?: Record<string, unknown>;
  timestamp?: string;
}

let _frameworkLogger: { log: (module: string, event: string, status: string, data?: Record<string, unknown>) => void } | null = null;

function ensureLogsDir(baseDir: string): string {
  const logsDir = path.join(baseDir, 'logs', 'framework');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  return logsDir;
}

export async function getFrameworkLogger(cwd: string = process.cwd()) {
  if (_frameworkLogger) return _frameworkLogger;

  // Try to load real 0xray frameworkLogger (dist symlink or node_modules as in plugin)
  const candidates = [
    path.join(cwd, 'dist', 'core', 'framework-logger.js'),
    path.join(cwd, 'node_modules', '0xray', 'dist', 'core', 'framework-logger.js'),
    path.join(cwd, '..', 'dist', 'core', 'framework-logger.js'),
  ];

  for (const candidate of candidates) {
    try {
      // Dynamic for ESM
      const mod = await import(candidate);
      if (mod.frameworkLogger) {
        _frameworkLogger = mod.frameworkLogger;
        return _frameworkLogger;
      }
    } catch {
      // continue to fallback
    }
  }

  // Prod-ready fallback: structured file-only append (no console.*)
  const logsDir = ensureLogsDir(cwd);
  const logPath = path.join(logsDir, 'groover-activity.log');

  _frameworkLogger = {
    log(module: string, event: string, status: string, data: Record<string, unknown> = {}) {
      const entry: FrameworkLogEntry = {
        module,
        event,
        status: status as any,
        data,
        timestamp: new Date().toISOString(),
      };
      try {
        fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf-8');
      } catch {
        // silent structured failure - never console
      }
    },
  };

  return _frameworkLogger;
}

export const frameworkLogger = {
  log(module: string, event: string, status: string, data?: Record<string, unknown>) {
    getFrameworkLogger().then(l => l?.log(module, event, status, data)).catch(() => {
      // Last-resort fallback if frameworkLogger init fails: write to os tmpdir to avoid silent data loss
      try { fs.appendFileSync(path.join(os.tmpdir(), 'groover-log-fallback.log'), `[${status}] ${module}:${event} ${JSON.stringify(data)}\n`); } catch {}
    });
  },
};
