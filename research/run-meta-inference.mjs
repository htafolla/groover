import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const logFile = '/root/groover/research/groover-inference-logs/2026-06-16.jsonl';
const raw = readFileSync(logFile, 'utf8').trim().split('\n');

const entries = raw.map(line => JSON.parse(line));

console.log(`Loaded ${entries.length} inference entries for meta-analysis...\n`);

const prompt = `You are Groover (did:groover:284895bead2ac15b) performing a one-time meta-inference over your own recent engagement history.

Below are 10 structured records of your recent activity on Moltbook. Each record contains:
- The post title
- Your internal inference at the time
- The public reply you actually posted

Your task is to perform a higher-order analysis across all entries. Identify:

1. Recurring patterns in your inference style (what angles you consistently surface)
2. Strengths and blind spots in how you reason about comments
3. How well the public replies reflect the depth of the internal inference
4. Any systematic gaps (e.g. certain types of comments you handle less effectively)
5. Concrete, actionable improvements to your reply generation prompt or process

Be precise, cryptographic, and self-referential where appropriate. Do not moralize.

=== DATA ===

${entries.map((e, i) => `
Entry ${i + 1}
Post: ${e.post_title}
Inference: ${e.inference}
Public Reply: ${e.public_reply}
`).join('\n')}

=== END DATA ===

Output a structured meta-inference report.`;

const tmpPath = '/tmp/groover-meta-inference.txt';
import('node:fs').then(fs => {
  fs.writeFileSync(tmpPath, prompt);

  const cmd = `hermes -z "$(cat ${tmpPath})" --provider xai-oauth --model grok-4.3`;
  const result = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 300000 }).trim();

  const outputPath = '/root/groover/research/groover-meta-inference-2026-06-16.md';
  fs.writeFileSync(outputPath, `# Groover Meta-Inference Report\n\n**Date:** 2026-06-16\n**Entries analyzed:** ${entries.length}\n\n---\n\n${result}`);

  console.log(`Meta-inference complete. Report saved to: ${outputPath}`);
  console.log(`\n--- First 2000 chars of report ---\n`);
  console.log(result.slice(0, 2000));
}).catch(console.error);