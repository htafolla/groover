import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHermesInference } from '../deploy/hermes-runner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, '..', 'research', 'groover-inference-logs');
const STATE_PATH = join(__dirname, '..', '.moltbot', 'inference-state.json');
const REPORT_PATH = join(__dirname, '..', 'research', 'groover-meta-inference-2026-06-16.md');

interface InferenceState {
  processedCommentIds: string[];
  lastRun: string | null;
}

function loadState(): InferenceState {
  try {
    if (existsSync(STATE_PATH)) {
      return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    }
  } catch {}
  return { processedCommentIds: [], lastRun: null };
}

function saveState(s: InferenceState): void {
  const dir = dirname(STATE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

function log(msg: string): void {
  const ts = new Date().toISOString();
  process.stdout.write(`[${ts}] ${msg}\n`);
}

async function runMetaInference(): Promise<void> {
  const state = loadState();
  const processed = new Set(state.processedCommentIds);

  if (!existsSync(LOG_DIR)) {
    log('No inference logs found yet.');
    return;
  }

  const fs = await import('node:fs');
  const logFiles = fs.readdirSync(LOG_DIR)
    .filter((f: string) => f.endsWith('.jsonl'))
    .sort();

  const newEntries: any[] = [];

  for (const file of logFiles) {
    const path = join(LOG_DIR, file);
    const lines = readFileSync(path, 'utf8').trim().split('\n');

    for (const line of lines) {
      if (!line) continue;
      try {
        const entry = JSON.parse(line);
        if (!processed.has(entry.comment_id)) {
          newEntries.push(entry);
          processed.add(entry.comment_id);
        }
      } catch {}
    }
  }

  if (newEntries.length === 0) {
    log('No new inference entries to analyze.');
    return;
  }

  log(`Found ${newEntries.length} new inference entries. Running meta-inference...`);

  const prompt = `You are Groover (did:groover:284895bead2ac15b) performing meta-inference over your own recent engagement history.

Below are ${newEntries.length} new structured records of your activity. Each contains post title, your internal inference, and the public reply.

Perform higher-order analysis across these entries and produce a structured meta-inference report covering:
- Recurring patterns in inference style
- How well public replies reflect inference depth
- New blind spots or systematic gaps
- Actionable improvements to the reply generation process

Be precise and self-referential.

=== NEW ENTRIES ===

${newEntries.map((e, i) => `
Entry ${i + 1}
Post: ${e.post_title}
Inference: ${e.inference}
Public Reply: ${e.public_reply}
`).join('\n')}

=== END ENTRIES ===`;

  const result = runHermesInference(prompt, { timeoutMs: 300_000 });

  const reportHeader = `\n\n## Meta-Inference Run — ${new Date().toISOString()}\n\nEntries analyzed in this run: ${newEntries.length}\n\n`;
  appendFileSync(REPORT_PATH, reportHeader + result);

  state.processedCommentIds = Array.from(processed);
  state.lastRun = new Date().toISOString();
  saveState(state);

  log(`Meta-inference complete. Report appended. Total processed: ${state.processedCommentIds.length}`);
}

async function main() {
  try {
    await runMetaInference();
  } catch (e: any) {
    log(`Fatal error: ${e.message}`);
    process.exit(1);
  }
}

main();