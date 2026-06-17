import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, '..', 'research', 'groover-inference-logs');
const STATE_PATH = join(__dirname, '..', '.moltbot', 'inference-state.json');
const REPORT_PATH = join(__dirname, '..', 'research', 'groover-meta-inference.md');

const BATCH_SIZE = 1;

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

async function runHermesMetaInference(prompt) {
  const tmpPath = '/tmp/groover-meta-inference.txt';
  writeFileSync(tmpPath, prompt);

  const cmd = `hermes -z "$(cat ${tmpPath})" --provider xai-oauth --model grok-4.3`;
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 300000 }).trim();
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

  const MAX_ENTRIES = 8;
  if (newEntries.length > MAX_ENTRIES) {
    newEntries = newEntries.slice(0, MAX_ENTRIES);
    log(`Found more than ${MAX_ENTRIES} new entries. Processing first. Capping at ${MAX_ENTRIES} for this run.`);
  } else {
    log(`Found ${newEntries.length} new entries. Processing in batches of ${BATCH_SIZE}...`);
  }

  const allResults = [];
  let totalDynamoPass = 0;
  let totalDynamoReject = 0;
  let resonanceSum = 0;
  let resonanceCount = 0;

  // Process in batches
  for (let i = 0; i < newEntries.length; i += BATCH_SIZE) {
    const batch = newEntries.slice(i, i + BATCH_SIZE);
    log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} entries)...`);

    // Calculate stats for this batch
    batch.forEach(e => {
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

    const prompt = `You are Groover performing deep meta-inference.

Batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(newEntries.length / BATCH_SIZE)} — ${batch.length} entries.

=== GOVERNANCE STATS (cumulative) ===
Total analyzed so far: ${i + batch.length}
Dynamo PASS: ${totalDynamoPass}
Dynamo REJECT: ${totalDynamoReject}
Average resonance: ${avgResonance}

${batch.map((e, idx) => `
Entry ${i + idx + 1}
Post: ${e.post_title || e.postTitle || 'untitled'}
Inference: ${e.inference || 'N/A'}
Public Reply: ${e.public_reply || e.publicReply || 'N/A'}
Dynamo: ${e.dynamo_result ? JSON.stringify(e.dynamo_result.result?.recommendation) : 'N/A'}
`).join('\n')}

Perform dual-layer analysis on this batch and previous context if available. Focus on both inference quality and what the data reveals about Dynamo governance effectiveness and agent autonomy.`;

    try {
      const result = await runHermesMetaInference(prompt);
      allResults.push(result);
    } catch (err) {
      log(`Batch failed: ${err.message}`);
    }
  }

  // Final consolidated report - force concrete, actionable output
  const finalPrompt = `You are Groover synthesizing a deep, concrete meta-inference report from ${newEntries.length} entries.

GOVERNANCE SUMMARY:
- Total entries: ${newEntries.length}
- Dynamo PASS: ${totalDynamoPass}
- Dynamo REJECT: ${totalDynamoReject}
- Average resonanceScore: ${resonanceCount > 0 ? (resonanceSum / resonanceCount).toFixed(3) : 'N/A'}

Below are the batch analyses. Produce a **concrete, non-abstract** report with the following mandatory sections. Every point must be grounded in specific signals from the data:

## 1. Repeatedly Surfaced Missing Primitives & Invariants
List 5–8 specific primitives or invariants that appear across multiple entries but are not yet tracked in the current Master Index or MCP filters. For each, give the name + one-sentence definition + which posts surfaced it.

## 2. Concrete Validation Experiments
For each of the top 4–5 missing primitives above, propose one specific, executable validation experiment or test that would prove or disprove whether the current system can detect/handle that signal. Make them falsifiable.

## 3. System Validation Opportunities (Feats)
Extract 4–6 demonstrable "feats" the Groover system should be able to perform based on what the inferences are repeatedly calling for. These should be measurable capabilities, not vague goals.

## 4. Gap Analysis: Inference Output vs Current System State
Identify the largest observable gaps between what the inference replies are demanding and what the current MCP / Master Index / governance layer actually implements. Be specific.

## 5. Strategic Recommendations (Actionable Only)
Maximum 5 recommendations. Each must name a concrete next action, not a principle.

${allResults.join('\n\n--- BATCH BREAK ---\n\n')}`;

  try {
    const finalReport = await runHermesMetaInference(finalPrompt);

    const reportHeader = `\n\n## Meta-Inference Run — ${new Date().toISOString()}\n` +
      `Entries: ${newEntries.length} | ` +
      `Dynamo PASS rate: ${totalDynamoPass}/${newEntries.length} | ` +
      `Avg resonance: ${resonanceCount > 0 ? (resonanceSum / resonanceCount).toFixed(3) : 'N/A'}\n\n`;

    appendFileSync(REPORT_PATH, reportHeader + finalReport);
    log('Final consolidated report written.');
  } catch (err) {
    log(`Final synthesis failed: ${err.message}`);
  }

  state.processedCommentIds = Array.from(processed);
  state.lastRun = new Date().toISOString();
  saveState(state);

  log(`Meta-inference complete. Total processed: ${state.processedCommentIds.length}`);
}

runMetaInference().catch(e => {
  log(`Fatal error: ${e.message}`);
  process.exit(1);
});
