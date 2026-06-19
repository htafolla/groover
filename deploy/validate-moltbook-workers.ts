#!/usr/bin/env node
/**
 * Run all three Moltbook workers in DRY_RUN and validate output (no live POST).
 *
 * Usage:
 *   DRY_RUN=true MOLTBOOK_API_KEY=... npx tsx deploy/validate-moltbook-workers.ts
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlatformEnv } from './load-platform-env.js';
import { validateEngageOutput } from './engage-output-guard.js';

loadPlatformEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const GROOVER_ROOT = join(__dirname, '..');
const LOG_DIR = join(GROOVER_ROOT, 'research', 'groover-inference-logs');

interface WorkerResult {
  name: string;
  exitCode: number;
  issues: string[];
  previews: string[];
}

const GIBBERISH_MARKERS = [
  /^(\b\w+\b)(?:\s+\1){4,}/im,
  /lorem ipsum/i,
  /as an ai language model/i,
];

function log(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function checkPostText(title: string, content: string): string[] {
  const issues: string[] = [];
  if (title.length < 8) issues.push('post title too short');
  if (content.length < 80) issues.push('post content too short');
  if (/TYPE:/i.test(content)) issues.push('post content contains TYPE line');
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  if (sentences.length < 2) issues.push('post content needs at least 2 sentences');
  const blob = `${title}\n${content}`;
  for (const pattern of GIBBERISH_MARKERS) {
    if (pattern.test(blob)) issues.push(`gibberish: ${pattern.source.slice(0, 32)}`);
  }
  return issues;
}

function readLatestLogEntries(sinceMs: number): Array<Record<string, unknown>> {
  if (!existsSync(LOG_DIR)) return [];
  const files = readdirSync(LOG_DIR).filter((f) => f.endsWith('.jsonl')).sort().reverse();
  const entries: Array<Record<string, unknown>> = [];
  for (const file of files) {
    const lines = readFileSync(join(LOG_DIR, file), 'utf8').trim().split('\n');
    for (const line of lines.reverse()) {
      if (!line) continue;
      try {
        const entry = JSON.parse(line) as Record<string, unknown>;
        const ts = Date.parse(String(entry.timestamp ?? ''));
        if (!Number.isNaN(ts) && ts >= sinceMs) entries.push(entry);
      } catch {
        /* skip */
      }
    }
  }
  return entries;
}

function runWorker(script: string, name: string): WorkerResult {
  const proc = spawnSync('npx', ['tsx', join('deploy', script)], {
    cwd: GROOVER_ROOT,
    encoding: 'utf8',
    env: { ...process.env, DRY_RUN: 'true' },
    timeout: 600_000,
    maxBuffer: 20 * 1024 * 1024,
  });

  const combined = `${proc.stdout ?? ''}\n${proc.stderr ?? ''}`;
  const issues: string[] = [];
  const previews: string[] = [];

  if (proc.status !== 0) issues.push(`exit code ${proc.status ?? 'unknown'}`);
  if (/FATAL:/i.test(combined)) issues.push('FATAL in worker output');

  const tail = combined.trim().split('\n').slice(-8);
  previews.push(...tail.filter((l) => l.trim()));

  return { name, exitCode: proc.status ?? 1, issues, previews };
}

function validateLogEntries(entries: Array<Record<string, unknown>>): string[] {
  const issues: string[] = [];
  const recentHashes = new Set<string>();

  for (const entry of entries) {
    const inference = String(entry.inference ?? '');
    const publicReply = String(entry.public_reply ?? '');
    const postTitle = String(entry.post_title ?? '');
    const type = String(entry.type ?? '');

    if (!inference && !publicReply) continue;

    if (type === 'daily-post' || entry.source === 'groover-post') {
      issues.push(...checkPostText(postTitle, publicReply || inference));
      continue;
    }

    const path = type === 'other-post' ? 'other-post' : 'own-post';
    const guard = validateEngageOutput({
      path,
      inference,
      publicReply,
      sourceText: postTitle,
      recentReplyHashes: recentHashes,
    });

    const hash = publicReply.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 240);
    if (hash) recentHashes.add(hash);

    if (!guard.ok) {
      issues.push(`${path}: ${guard.errors.join('; ')}`);
    }
    for (const w of guard.warnings) {
      issues.push(`${path} warn: ${w}`);
    }
  }

  return issues;
}

async function main(): Promise<void> {
  if (!process.env.MOLTBOOK_API_KEY) {
    process.stderr.write('FATAL: MOLTBOOK_API_KEY required\n');
    process.exit(1);
  }

  log('=== validate moltbook workers (DRY_RUN, no POST) ===\n');
  const startedAt = Date.now();

  const workers = [
    { script: 'moltbook-engage.ts', name: 'own-post-comments' },
    { script: 'moltbook-other-engage.ts', name: 'other-post-comments' },
    { script: 'moltbook-post.ts', name: 'daily-post' },
  ];

  const results: WorkerResult[] = [];
  for (const w of workers) {
    log(`--- running ${w.name} ---`);
    results.push(runWorker(w.script, w.name));
  }

  const logEntries = readLatestLogEntries(startedAt - 5_000);
  const contentIssues = validateLogEntries(logEntries);

  let failures = 0;

  for (const result of results) {
    log(`\n=== ${result.name} ===`);
    for (const line of result.previews) log(line);

    const workerIssues = [...result.issues];
    if (result.name !== 'daily-post' && logEntries.length === 0) {
      workerIssues.push('no new inference log entries — nothing to validate (no targets?)');
    }

    if (workerIssues.length === 0 && result.exitCode === 0) {
      log(`PASS ${result.name}`);
    } else if (workerIssues.length > 0 || result.exitCode !== 0) {
      failures += 1;
      log(`FAIL ${result.name}`);
      for (const issue of workerIssues) log(`  - ${issue}`);
    }
  }

  if (logEntries.length > 0) {
    log('\n=== content validation (from inference logs) ===');
    for (const entry of logEntries) {
      const preview = String(entry.public_reply ?? entry.inference ?? '').slice(0, 200);
      log(`  [${entry.type ?? entry.source}] ${preview}${preview.length >= 200 ? '…' : ''}`);
    }
    if (contentIssues.length > 0) {
      failures += 1;
      log('FAIL content checks');
      for (const issue of contentIssues) log(`  - ${issue}`);
    } else {
      log('PASS content checks (no gibberish/dup/guard errors)');
    }
  }

  if (failures > 0) {
    log(`\n=== VALIDATION FAILED (${failures} issue groups) ===`);
    process.exit(1);
  }

  log(`\n=== ALL WORKERS PASSED ===`);
}

main().catch((error) => {
  process.stderr.write(`FATAL: ${error}\n`);
  process.exit(1);
});