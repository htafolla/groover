/**
 * Central Repertoire path resolution for groover deploy scripts.
 * Override production paths in tests via CURATED_SIGNALS_PATH / REPERTOIRE_* env vars.
 */

import { join } from 'node:path';

export interface RepertoireServicePaths {
  dataDir: string;
  signalsPath: string;
  logDir: string;
  feedbackDir: string;
}

export function repertoireServicePaths(root: string): RepertoireServicePaths {
  // Prefer persistent brain location over node_modules
  const defaultDataDir = join(__dirname, "..", "..", "research", "repertoire-brain");

  const dataDir = process.env.REPERTOIRE_DATA_DIR ?? defaultDataDir;
  return {
    dataDir,
    signalsPath:
      process.env.CURATED_SIGNALS_PATH ?? join(dataDir, "curated_signals.json"),
    logDir:
      process.env.REPERTOIRE_LOG_DIR ?? join(root, "logs", "groover-inference"),
    feedbackDir:
      process.env.REPERTOIRE_FEEDBACK_DIR ??
      join(root, "logs", "orchestrator-feedback"),
  };
}