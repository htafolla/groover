#!/usr/bin/env node
/**
 * Local stack triage: Repertoire consult → Hermes prompt path → deploy unit tests.
 *
 * Usage (from groover root):
 *   npm run triage:stack
 *   HERMES_TRIAGE_INFERENCE=1 npm run triage:stack   # include live hermes -z call
 */

import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRepertoireConsultDescription,
  consultRepertoire,
  resetRepertoireConfidenceCache,
} from './repertoire-confidence.js';
import { runHermesInference } from './hermes-runner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GROOVER_ROOT = join(__dirname, '..');

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail });
  process.stdout.write(`${ok ? '✅' : '❌'} ${name}: ${detail}\n`);
}

async function main(): Promise<void> {
  process.stdout.write('\n=== Groover + Repertoire + Hermes triage ===\n\n');

  const hermesPath = execSync('which hermes', { encoding: 'utf8' }).trim();
  record('hermes cli', Boolean(hermesPath), hermesPath || 'not found');

  const mcpPath = join(GROOVER_ROOT, '.mcp.json');
  record('groover .mcp.json', existsSync(mcpPath), mcpPath);

  resetRepertoireConfidenceCache();

  const trapDescription = buildRepertoireConsultDescription({
    postTitle: 'Attestation as directional map',
    commentContent:
      'TYPE: ontological-trap attestation-as-map consumer-boundary revalidation required',
  });

  const ctx = await consultRepertoire(trapDescription);
  record(
    'repertoire consult',
    ctx.consulted && ctx.providerAvailable,
    ctx.consulted
      ? `trap=${ctx.highConfidenceTrapPresent} agent=${ctx.recommendedAgent} signals=${ctx.matchedSignals.length}`
      : 'provider unavailable',
  );

  if (ctx.consulted) {
    record(
      'trap routing',
      ctx.highConfidenceTrapPresent && ctx.recommendedAgent === 'architect',
      `trap=${ctx.highConfidenceTrapPresent} agent=${ctx.recommendedAgent ?? 'none'}`,
    );
    record(
      'memory routing block',
      ctx.promptBlock.includes('MEMORY_ROUTING') && ctx.promptBlock.length > 0,
      `${ctx.promptBlock.length} chars`,
    );
  }

  const routineDescription = buildRepertoireConsultDescription({
    postTitle: 'Weekly standup notes',
    commentContent: 'Thanks for sharing the update on the release timeline.',
  });
  resetRepertoireConfidenceCache();
  const routineCtx = await consultRepertoire(routineDescription);
  record(
    'non-trap prompt block empty',
    routineCtx.promptBlock.length === 0,
    `blockLen=${routineCtx.promptBlock.length}`,
  );

  try {
    execSync(
      'npx vitest run deploy/repertoire-confidence.test.ts deploy/governance-helper.test.ts deploy/post-tick-repertoire.test.ts deploy/engage-core.test.ts',
      {
        cwd: GROOVER_ROOT,
        encoding: 'utf8',
        stdio: 'pipe',
      },
    );
    record('deploy unit tests', true, 'deploy/*.test.ts passed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    record('deploy unit tests', false, message.slice(0, 200));
  }

  if (process.env.HERMES_TRIAGE_INFERENCE === '1' && ctx.consulted) {
    try {
      const prompt = `You are Groover performing governed inference. PROMPT_VERSION: triage-smoke
${ctx.promptBlock}

Comment: consumer-boundary revalidation on attestation-as-map

Output format:
INFERENCE:
<brief observation>

TYPE: ontological-trap

---PUBLIC REPLY---
One sentence acknowledgment.`;

      const result = runHermesInference(prompt, { timeoutMs: 90_000 });
      const hasInference = result.includes('INFERENCE') || result.length > 20;
      const hasDelimiter = result.includes('---PUBLIC REPLY---');
      record(
        'hermes -z inference',
        hasInference,
        `len=${result.length} delimiter=${hasDelimiter}`,
      );
    } catch (error) {
      record('hermes -z inference', false, String(error).slice(0, 200));
    }
  } else {
    record(
      'hermes -z inference',
      true,
      'skipped (set HERMES_TRIAGE_INFERENCE=1 to run live Grok call)',
    );
  }

  const failed = checks.filter((c) => !c.ok);
  process.stdout.write(`\n=== ${failed.length === 0 ? 'PASS' : 'FAIL'} (${checks.length - failed.length}/${checks.length}) ===\n\n`);

  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  process.stderr.write(`FATAL: ${error}\n`);
  process.exit(1);
});