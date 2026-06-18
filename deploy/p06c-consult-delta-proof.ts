#!/usr/bin/env node
/**
 * P0.6c — consult delta proof: ingest + feedback moves Repertoire stats.
 * No Moltbook API required.
 */

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
import { loadPlatformEnv } from './load-platform-env.js';
import {
  buildRepertoireConsultDescription,
  consultRepertoire,
  resetRepertoireConfidenceCache,
} from './repertoire-confidence.js';
import { runPostTickIngest, runPostTickRepertoire, resetPostTickCache } from './post-tick-repertoire.js';

loadPlatformEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const TRAP_TITLE = 'Attestation is a map not a verdict';
const TRAP_COMMENT =
  'Attestation functions as a trust map; consumer must revalidate at the boundary.';

function out(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function err(msg: string): void {
  process.stderr.write(`${msg}\n`);
}

interface SignalStats {
  observation_count: number | null;
  avg_confidence: number | null;
  feedback_outcomes: number | null;
}

function resolveRepertoireRoot(): string | null {
  const sibling = join(__dirname, '..', '..', 'repertoire');
  const localPkg = join(__dirname, '..', 'node_modules', '@0xray', 'repertoire');
  const candidates = [
    process.env.REPERTOIRE_ROOT,
    sibling,
    localPkg,
  ].filter((value): value is string => Boolean(value));

  for (const root of candidates) {
    if (existsSync(join(root, 'dist/index.js'))) return root;
  }

  try {
    const pkgJson = require.resolve('@0xray/repertoire/package.json');
    const root = dirname(pkgJson);
    if (existsSync(join(root, 'dist/index.js'))) return root;
  } catch {
    // not installed
  }
  return null;
}

async function loadSignalStats(signalName: string): Promise<SignalStats | null> {
  const root = resolveRepertoireRoot();
  if (!root) return null;

  try {
    const mod = await import(pathToFileURL(join(root, 'dist/index.js')).href);
    const service = new mod.RepertoireService({
      dataDir: join(root, 'data'),
      signalsPath: join(root, 'data/curated_signals.json'),
      logDir: join(root, 'logs/groover-inference'),
      feedbackDir: join(root, 'logs/orchestrator-feedback'),
    });
    const signal = service.signalsManager.getByName(signalName);
    if (!signal) return null;
    return {
      observation_count: signal.observation_stats?.observation_count ?? null,
      avg_confidence: signal.observation_stats?.avg_confidence ?? null,
      feedback_outcomes: signal.feedback_stats?.outcome_count ?? null,
    };
  } catch {
    return null;
  }
}

async function main(): Promise<number> {
  const signalName = 'attestation-as-map';
  const description = buildRepertoireConsultDescription({
    postTitle: TRAP_TITLE,
    commentContent: TRAP_COMMENT,
  });

  const statsBefore = await loadSignalStats(signalName);
  const consultBefore = await consultRepertoire(description);

  if (!consultBefore.consulted) {
    err('P0.6c ABORT: Repertoire consult unavailable — set REPERTOIRE_ROOT and build dist');
    return 1;
  }

  const proofId = `p06c-proof-${Date.now()}`;
  const ingestDir = join(__dirname, '..', 'research', 'p06c-ingest-staging');
  mkdirSync(ingestDir, { recursive: true });
  const line = {
    timestamp: new Date().toISOString(),
    source: 'groover',
    post_id: 'p06c-proof',
    comment_id: proofId,
    inference: 'TYPE: ontological-trap\nattestation-as-map consumer-boundary revalidation required',
    public_reply: 'P0.6c consult delta proof line.',
    matched_primitives: [signalName],
    match_confidence: { [signalName]: 0.94 },
    governance_forced: true,
    dynamo_result: {
      result: { recommendation: 'PASS', resonanceScore: 0.88 },
      matchedPrimitives: [signalName],
    },
  };
  writeFileSync(join(ingestDir, 'p06c-proof.jsonl'), `${JSON.stringify(line)}\n`);

  const ingest = await runPostTickIngest(ingestDir);
  const feedback = await runPostTickRepertoire({
    taskId: proofId,
    memorySignals: consultBefore.matchedSignals.length > 0
      ? consultBefore.matchedSignals
      : [signalName],
    dynamoRecommendation: 'NEEDS_REVISION',
    resonanceScore: 0.72,
    posted: false,
  });

  resetRepertoireConfidenceCache();
  resetPostTickCache();

  const statsAfter = await loadSignalStats(signalName);
  const consultAfter = await consultRepertoire(description);

  const obsMoved =
    statsBefore != null &&
    statsAfter != null &&
    (statsAfter.observation_count ?? 0) > (statsBefore.observation_count ?? 0);
  const fbMoved =
    statsBefore != null &&
    statsAfter != null &&
    (statsAfter.feedback_outcomes ?? 0) > (statsBefore.feedback_outcomes ?? 0);
  const avgMoved =
    statsBefore != null &&
    statsAfter != null &&
    statsBefore.avg_confidence != null &&
    statsAfter.avg_confidence != null &&
    Math.abs(statsAfter.avg_confidence - statsBefore.avg_confidence) > 1e-9;

  const report = {
    status: obsMoved || fbMoved || avgMoved ? 'PASS' : 'FAIL',
    signal: signalName,
    consult: {
      before: {
        trap: consultBefore.highConfidenceTrapPresent,
        signals: consultBefore.matchedSignals.length,
        avgConfidence: consultBefore.avgConfidence,
      },
      after: {
        trap: consultAfter.highConfidenceTrapPresent,
        signals: consultAfter.matchedSignals.length,
        avgConfidence: consultAfter.avgConfidence,
      },
    },
    stats: { before: statsBefore, after: statsAfter },
    ingest: { imported: ingest.imported, skipped: ingest.skippedLines },
    feedback: { ok: feedback.ok, skipped: feedback.skipped, updated: feedback.updatedSignals },
    deltas: { observation_count: obsMoved, feedback_outcomes: fbMoved, avg_confidence: avgMoved },
  };

  out(JSON.stringify(report, null, 2));
  return report.status === 'PASS' ? 0 : 1;
}

main().then((code) => process.exit(code)).catch((e) => {
  err(String(e));
  process.exit(1);
});