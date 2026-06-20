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
  const brainDir =
    process.env.REPERTOIRE_DATA_DIR ?? join(root, 'research', 'repertoire-brain');
  return {
    dataDir: brainDir,
    signalsPath:
      process.env.CURATED_SIGNALS_PATH ??
      join(brainDir, 'curated_signals.json'),
    logDir:
      process.env.REPERTOIRE_LOG_DIR ?? join(root, 'logs', 'groover-inference'),
    feedbackDir:
      process.env.REPERTOIRE_FEEDBACK_DIR ??
      join(root, 'logs', 'orchestrator-feedback'),
  };
}

/** Default JSONL source for scheduled enrichment (engage output). */
export function defaultIngestSourceDir(root: string): string {
  return (
    process.env.REPERTOIRE_INGEST_SOURCE ??
    join(root, 'research', 'groover-inference-logs')
  );
}