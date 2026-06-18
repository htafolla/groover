#!/usr/bin/env node
/**
 * Backfill enriched metadata on pre-abeafbb Groover inference JSONL.
 *
 * Uses the same matchPrimitivesFromInference + buildInferenceLogEntry logic
 * as deploy/governance-helper.ts so Repertoire strict ingest can import historical lines.
 *
 * Non-destructive: writes to groover-inference-logs-enriched/ by default.
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildInferenceLogEntry,
  type InferenceLogEntry,
} from '../deploy/governance-helper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_SOURCE = join(__dirname, 'groover-inference-logs');
const DEFAULT_OUTPUT = join(__dirname, 'groover-inference-logs-enriched');

interface LegacyLine {
  timestamp?: string;
  post_id?: string;
  post_title?: string;
  comment_id?: string;
  inference?: string;
  public_reply?: string;
  source?: string;
  dynamo_result?: InferenceLogEntry['dynamo_result'];
  matched_primitives?: string[];
  match_confidence?: Record<string, number>;
}

interface Stats {
  total: number;
  alreadyEnriched: number;
  backfilled: number;
  skippedNoInference: number;
  skippedNoMatches: number;
  byFile: Record<string, { in: number; out: number }>;
}

function parseArgs(): { sourceDir: string; outputDir: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  const sourceIdx = args.indexOf('--source');
  const outputIdx = args.indexOf('--output');
  return {
    sourceDir: sourceIdx >= 0 ? args[sourceIdx + 1]! : DEFAULT_SOURCE,
    outputDir: outputIdx >= 0 ? args[outputIdx + 1]! : DEFAULT_OUTPUT,
    dryRun: args.includes('--dry-run'),
  };
}

function isAlreadyEnriched(raw: Record<string, unknown>): boolean {
  if (!Array.isArray(raw.matched_primitives) || raw.matched_primitives.length === 0) {
    return false;
  }
  const confidence = raw.match_confidence;
  if (!confidence || typeof confidence !== 'object') return false;
  return (raw.matched_primitives as string[]).every(
    (name) => typeof (confidence as Record<string, unknown>)[name] === 'number',
  );
}

function backfillLine(raw: LegacyLine): InferenceLogEntry | null {
  const inference = String(raw.inference ?? '').trim();
  if (!inference) return null;

  const postId = raw.post_id ?? 'unknown';
  const entry = buildInferenceLogEntry({
    source: raw.source ?? 'groover-backfill',
    postId,
    postTitle: raw.post_title,
    commentId: raw.comment_id,
    inference,
    publicReply: String(raw.public_reply ?? ''),
    govOutcome: null,
  });

  if (raw.timestamp) entry.timestamp = raw.timestamp;
  if (raw.dynamo_result) entry.dynamo_result = raw.dynamo_result;

  if (entry.matched_primitives.length === 0) return null;

  return entry;
}

function processFile(
  inputPath: string,
  outputPath: string,
  stats: Stats,
  dryRun: boolean,
): void {
  const fileName = inputPath.split('/').pop() ?? inputPath;
  const lines = readFileSync(inputPath, 'utf8').trim().split('\n').filter(Boolean);
  const outLines: string[] = [];

  stats.byFile[fileName] = { in: lines.length, out: 0 };

  for (const line of lines) {
    stats.total++;
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }

    if (isAlreadyEnriched(raw)) {
      stats.alreadyEnriched++;
      outLines.push(line);
      stats.byFile[fileName].out++;
      continue;
    }

    const legacy = raw as LegacyLine;
    if (!legacy.inference) {
      stats.skippedNoInference++;
      continue;
    }

    const enriched = backfillLine(legacy);
    if (!enriched) {
      stats.skippedNoMatches++;
      continue;
    }

    stats.backfilled++;
    outLines.push(JSON.stringify(enriched));
    stats.byFile[fileName].out++;
  }

  if (!dryRun && outLines.length > 0) {
    writeFileSync(outputPath, `${outLines.join('\n')}\n`);
  }
}

function main(): void {
  const { sourceDir, outputDir, dryRun } = parseArgs();
  const stats: Stats = {
    total: 0,
    alreadyEnriched: 0,
    backfilled: 0,
    skippedNoInference: 0,
    skippedNoMatches: 0,
    byFile: {},
  };

  if (!existsSync(sourceDir)) {
    console.error(`Source directory not found: ${sourceDir}`);
    process.exit(1);
  }

  if (!dryRun) {
    mkdirSync(outputDir, { recursive: true });
  }

  const files = readdirSync(sourceDir)
    .filter((name) => name.endsWith('.jsonl'))
    .sort();

  if (files.length === 0) {
    console.error(`No .jsonl files in ${sourceDir}`);
    process.exit(1);
  }

  for (const file of files) {
    processFile(
      join(sourceDir, file),
      join(outputDir, file),
      stats,
      dryRun,
    );
  }

  const importable = stats.alreadyEnriched + stats.backfilled;

  console.log('Groover inference log backfill');
  console.log(`  source:  ${sourceDir}`);
  console.log(`  output:  ${outputDir}`);
  console.log(`  dry-run: ${dryRun}`);
  console.log('');
  console.log(`  total lines:        ${stats.total}`);
  console.log(`  already enriched:   ${stats.alreadyEnriched}`);
  console.log(`  backfilled:         ${stats.backfilled}`);
  console.log(`  skipped no infer:   ${stats.skippedNoInference}`);
  console.log(`  skipped no matches: ${stats.skippedNoMatches}`);
  console.log(`  importable (est):   ${importable}`);
  console.log('');
  console.log('  by file:');
  for (const [file, counts] of Object.entries(stats.byFile)) {
    console.log(`    ${file}: ${counts.in} in → ${counts.out} out`);
  }

  if (importable === 0) {
    console.error('\nNo importable lines produced. Check curated_signals.json path.');
    process.exit(1);
  }
}

main();