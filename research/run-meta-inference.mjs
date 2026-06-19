import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLFromPath } from 'node:url';

const __dirname = dirname(fileURLFromPath(import.meta.url));
const LOG_DIR = join(__dirname, '..', 'research', 'groover-inference-logs');
const STATE_PATH = join(__dirname, '..', '.moltbot', 'inference-state.json');
const REPORT_PATH = join(__dirname, '..', 'research', 'groover-meta-inference.md');

const BATCH_SIZE = 1;
const MAX_ENTRIES = 4; // Reduced to stay safely under 120s cron timeout

function loadState() {
  try {
    if (existsSync(STATE_PATH)) {
      return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    }
  } catch {}
  return { processedCommentIds: [], lastRun: null };
}

function saveState(s) {
  const dir = dirname(STATE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

function log(msg) {
  const ts = new Date().toISOString();
  process.stdout.write(`[${ts}] ${msg}\n`);
}

async function runMetaInference() {
  const state = loadState();
  const processed = new Set(state.processedCommentIds || []);

  if (!existsSync(LOG_DIR)) {
    log('No inference logs found yet.');
    return;
  }

  const fs = await import('node:fs');
  const logFiles = fs.readdirSync(LOG_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .sort();

  let newEntries = [];

  for (const file of logFiles) {
    const path = join(LOG_DIR, file);
    const lines = readFileSync(path, 'utf8').trim().split('\n');

    for (const line of lines) {
      if (!line) continue;
      try {
        const entry = JSON.parse(line);
        const id = entry.comment_id || entry.post_id;
        if (id && !processed.has(id)) {
          newEntries.push(entry);
          processed.add(id);
        }
      } catch {}
    }
  }

  if (newEntries.length === 0) {
    log('No new inference entries to analyze.');
    return;
  }

  if (newEntries.length > MAX_ENTRIES) {
    newEntries = newEntries.slice(0, MAX_ENTRIES);
    log(`Found more than ${MAX_ENTRIES} new entries. Processing first ${MAX_ENTRIES}.`);
  } else {
    log(`Found ${newEntries.length} new entries. Processing...`);
  }

  let totalDynamoPass = 0;
  let totalDynamoReject = 0;
  let resonanceSum = 0;
  let resonanceCount = 0;

  newEntries.forEach(e => {
    const rec = e.dynamo_result?.result?.recommendation;
    if (rec === 'PASS') totalDynamoPass++;
    if (rec === 'REJECT') totalDynamoReject++;
    const res = e.dynamo_result?.result?.resonanceScore;
    if (typeof res === 'number') {
      resonanceSum += res;
      resonanceCount++;
    }
  });

  const avgResonance = resonanceCount > 0 ? (resonanceSum / resonanceCount).toFixed(3) : 'N/A';

  // Build a lightweight report without calling Hermes (prevents cron timeouts)
  const reportHeader = `\n\n## Meta-Inference Run — ${new Date().toISOString()}\n` +
    `Entries: ${newEntries.length} | ` +
    `Dynamo PASS rate: ${totalDynamoPass}/${newEntries.length} | ` +
    `Avg resonance: ${avgResonance}\n\n`;

  const summary = `## Summary (no Hermes synthesis this run)\n` +
    `- Total entries processed: ${newEntries.length}\n` +
    `- Dynamo PASS: ${totalDynamoPass}\n` +
    `- Dynamo REJECT: ${totalDynamoReject}\n` +
    `- Average resonanceScore: ${avgResonance}\n`;

  appendFileSync(REPORT_PATH, reportHeader + summary);
  log('Lightweight meta-inference report written.');

  state.processedCommentIds = Array.from(processed);
  state.lastRun = new Date().toISOString();
  saveState(state);

  log(`Meta-inference complete. Total processed: ${state.processedCommentIds.length}`);
}

runMetaInference().catch(e => {
  log(`Fatal error: ${e.message}`);
  process.exit(1);
});