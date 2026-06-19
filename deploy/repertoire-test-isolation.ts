/**
 * Test helpers — isolate Repertoire I/O from production curated_signals.json.
 */

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface RepertoireTestSandbox {
  root: string;
  signalsPath: string;
  logDir: string;
  feedbackDir: string;
  cleanup(): void;
}

const ENV_KEYS = [
  'REPERTOIRE_ROOT',
  'CURATED_SIGNALS_PATH',
  'REPERTOIRE_DATA_DIR',
  'REPERTOIRE_LOG_DIR',
  'REPERTOIRE_FEEDBACK_DIR',
] as const;

export function createRepertoireTestSandbox(
  repertoireRoot: string,
): RepertoireTestSandbox {
  const root = mkdtempSync(join(tmpdir(), 'repertoire-test-'));
  const dataDir = join(root, 'data');
  const logDir = join(root, 'logs', 'groover-inference');
  const feedbackDir = join(root, 'logs', 'orchestrator-feedback');
  const signalsPath = join(dataDir, 'curated_signals.json');
  const sourceSignals = join(repertoireRoot, 'data', 'curated_signals.json');

  mkdirSync(dataDir, { recursive: true });
  mkdirSync(logDir, { recursive: true });
  mkdirSync(feedbackDir, { recursive: true });

  if (existsSync(sourceSignals)) {
    copyFileSync(sourceSignals, signalsPath);
  }

  return {
    root,
    signalsPath,
    logDir,
    feedbackDir,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

export function applyRepertoireTestSandbox(
  repertoireRoot: string,
  sandbox: RepertoireTestSandbox,
): void {
  process.env.REPERTOIRE_ROOT = repertoireRoot;
  process.env.CURATED_SIGNALS_PATH = sandbox.signalsPath;
  process.env.REPERTOIRE_DATA_DIR = join(sandbox.root, 'data');
  process.env.REPERTOIRE_LOG_DIR = sandbox.logDir;
  process.env.REPERTOIRE_FEEDBACK_DIR = sandbox.feedbackDir;
}

export function clearRepertoireTestEnv(): void {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}