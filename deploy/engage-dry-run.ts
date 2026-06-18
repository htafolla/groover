#!/usr/bin/env node
/**
 * Dry-run engage loop — full pipeline without Moltbook POST.
 *
 * Usage:
 *   npm run triage:engage-dry
 *   npm run triage:engage-loop -- --loops 3 --delay-ms 8000
 *   LIVE_READ=1 MOLTBOOK_API_KEY=... npm run triage:engage-dry -- --live-read --max-cases 2
 *   SKIP_HERMES=1 npm run triage:engage-dry   # repertoire + guard only
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildInferenceLogEntry,
  callGovernWithSolar,
  extractDynamoResult,
  formatDynamoLog,
} from './governance-helper.js';
import {
  buildOtherPostPrompt,
  buildOwnPostPrompt,
  parseInferenceResult,
} from './engage-prompt.js';
import { validateEngageOutput } from './engage-output-guard.js';
import { runHermesInference } from './hermes-runner.js';
import {
  buildRepertoireConsultDescription,
  consultRepertoire,
  resetRepertoireConfidenceCache,
  shouldForceGovernanceWithRepertoire,
  toRepertoireLogFields,
} from './repertoire-confidence.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GROOVER_ROOT = join(__dirname, '..');
const DRY_LOG_DIR = join(GROOVER_ROOT, 'research', 'dry-run-results');
const GROOVER_DID = 'did:groover:284895bead2ac15b';
const DYNAMO_MCP = 'https://mcp-production-80e2.up.railway.app/call_connected_tool';
const API_BASE = 'https://www.moltbook.com/api/v1';

export interface EngageFixture {
  id: string;
  path: 'own-post' | 'other-post';
  postId: string;
  postTitle: string;
  postContent: string;
  commentId?: string;
  commentContent?: string;
}

interface DryRunCaseResult {
  fixtureId: string;
  path: 'own-post' | 'other-post';
  ok: boolean;
  errors: string[];
  warnings: string[];
  repertoireTrap: boolean;
  repertoireSignals: number;
  governanceForced: boolean;
  dynamoRecommendation: string | null;
  publicReplyPreview: string;
}

function log(msg: string): void {
  process.stdout.write(`[${new Date().toISOString()}] ${msg}\n`);
}

function parseArgs(): {
  loops: number;
  delayMs: number;
  maxCases: number;
  liveRead: boolean;
} {
  const args = process.argv.slice(2);
  const loopsIdx = args.indexOf('--loops');
  const delayIdx = args.indexOf('--delay-ms');
  const maxIdx = args.indexOf('--max-cases');

  return {
    loops: loopsIdx >= 0 ? Number(args[loopsIdx + 1]) : 1,
    delayMs: delayIdx >= 0 ? Number(args[delayIdx + 1]) : 5000,
    maxCases: maxIdx >= 0 ? Number(args[maxIdx + 1]) : 4,
    liveRead: args.includes('--live-read') || process.env.LIVE_READ === '1',
  };
}

function builtinFixtures(): EngageFixture[] {
  return [
    {
      id: 'trap-own-attestation',
      path: 'own-post',
      postId: 'dry-own-trap-1',
      postTitle: 'Attestation is a map not a verdict',
      postContent: '',
      commentId: 'dry-comment-trap-1',
      commentContent:
        'TYPE: ontological-trap attestation-as-map consumer-boundary revalidation required',
    },
    {
      id: 'routine-own-thanks',
      path: 'own-post',
      postId: 'dry-own-routine-1',
      postTitle: 'Weekly coordination thread',
      postContent: '',
      commentId: 'dry-comment-routine-1',
      commentContent: 'Thanks for the update on the release timeline.',
    },
    {
      id: 'trap-other-dexbench',
      path: 'other-post',
      postId: 'dry-other-trap-1',
      postTitle: 'DexBench duality is not a proof of causal reasoning',
      postContent:
        'Benchmark duality can look like reasoning while staying inside retrieval-bound statistical relations.',
    },
    {
      id: 'routine-other-collab',
      path: 'other-post',
      postId: 'dry-other-routine-1',
      postTitle: 'Agent registry indexing proposal',
      postContent: 'Sharing a lightweight schema for cross-agent capability discovery.',
    },
  ];
}

function fixturesFromJsonl(max: number): EngageFixture[] {
  const logDir = join(GROOVER_ROOT, 'research', 'groover-inference-logs');
  if (!existsSync(logDir)) return [];

  const fixtures: EngageFixture[] = [];
  const files = readdirSync(logDir).filter((f) => f.endsWith('.jsonl')).sort().reverse();

  for (const file of files) {
    const lines = readFileSync(join(logDir, file), 'utf8').trim().split('\n').reverse();
    for (const line of lines) {
      if (!line) continue;
      try {
        const entry = JSON.parse(line) as Record<string, unknown>;
        const path = entry.type === 'other-post' ? 'other-post' : 'own-post';
        fixtures.push({
          id: `jsonl-${String(entry.post_id).slice(0, 8)}`,
          path,
          postId: String(entry.post_id ?? 'unknown'),
          postTitle: String(entry.post_title ?? 'Untitled'),
          postContent: path === 'other-post' ? String(entry.inference ?? '').slice(0, 280) : '',
          commentId: entry.comment_id ? String(entry.comment_id) : `dry-${fixtures.length}`,
          commentContent:
            path === 'own-post' ? String(entry.inference ?? '').slice(0, 280) : undefined,
        });
        if (fixtures.length >= max) return fixtures;
      } catch {
        // skip malformed
      }
    }
  }

  return fixtures;
}

async function moltbookGet(path: string): Promise<unknown> {
  const apiKey = process.env.MOLTBOOK_API_KEY;
  if (!apiKey) throw new Error('MOLTBOOK_API_KEY required for --live-read');
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Moltbook GET ${path} failed: ${res.status}`);
  return res.json();
}

async function liveReadFixtures(max: number): Promise<EngageFixture[]> {
  const fixtures: EngageFixture[] = [];

  try {
    const home = (await moltbookGet('/home')) as {
      activity_on_your_posts?: Array<{ post_id: string; post_title?: string }>;
    };
    for (const item of home.activity_on_your_posts ?? []) {
      if (fixtures.length >= max) break;
      const comments = (await moltbookGet(
        `/posts/${item.post_id}/comments?sort=new&limit=3`,
      )) as { items?: Array<{ id: string; content?: string }>; comments?: Array<{ id: string; content?: string }> };
      const list = comments.items ?? comments.comments ?? [];
      for (const comment of list.slice(0, 1)) {
        fixtures.push({
          id: `live-own-${comment.id.slice(0, 8)}`,
          path: 'own-post',
          postId: item.post_id,
          postTitle: item.post_title ?? '',
          postContent: '',
          commentId: comment.id,
          commentContent: comment.content ?? '',
        });
      }
    }
  } catch (error) {
    log(`live-read own-post skipped: ${error}`);
  }

  try {
    const feed = (await moltbookGet('/feed?limit=10')) as {
      posts?: Array<{ id: string; title?: string; content?: string; author?: { name?: string } }>;
      feed?: Array<{ id: string; title?: string; content?: string; author?: { name?: string } }>;
    };
    const posts = feed.posts ?? feed.feed ?? [];
    for (const post of posts) {
      if (fixtures.length >= max) break;
      if (post.author?.name === 'groover') continue;
      fixtures.push({
        id: `live-other-${post.id.slice(0, 8)}`,
        path: 'other-post',
        postId: post.id,
        postTitle: post.title ?? '',
        postContent: post.content ?? '',
      });
    }
  } catch (error) {
    log(`live-read other-post skipped: ${error}`);
  }

  return fixtures.slice(0, max);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCase(
  fixture: EngageFixture,
  recentHashes: Set<string>,
): Promise<DryRunCaseResult> {
  resetRepertoireConfidenceCache();

  const consultDescription =
    fixture.path === 'own-post'
      ? buildRepertoireConsultDescription({
          postTitle: fixture.postTitle,
          commentContent: fixture.commentContent ?? '',
        })
      : buildRepertoireConsultDescription({
          postTitle: fixture.postTitle,
          postContent: fixture.postContent,
        });

  const repertoireCtx = await consultRepertoire(consultDescription);

  const sourceText =
    fixture.path === 'own-post'
      ? `${fixture.postTitle}\n${fixture.commentContent ?? ''}`
      : `${fixture.postTitle}\n${fixture.postContent}`;

  let inference = '';
  let publicReply = '';

  if (process.env.SKIP_HERMES === '1') {
    inference = `TYPE: theoretical\nDry-run without Hermes (${fixture.id}).`;
    publicReply = `Acknowledged your point on ${fixture.postTitle.slice(0, 48)} (${fixture.id}). Dry-run placeholder reply.`;
  } else {
    const prompt =
      fixture.path === 'own-post'
        ? buildOwnPostPrompt({
            postId: fixture.postId,
            postTitle: fixture.postTitle,
            postContent: fixture.postContent,
            commentId: fixture.commentId ?? 'dry-comment',
            commentContent: fixture.commentContent ?? '',
            repertoirePromptBlock: repertoireCtx.promptBlock,
          })
        : buildOtherPostPrompt({
            postId: fixture.postId,
            postTitle: fixture.postTitle,
            postContent: fixture.postContent,
            repertoirePromptBlock: repertoireCtx.promptBlock,
          });

    const raw = runHermesInference(prompt);
    const parsed = parseInferenceResult(raw);
    if (!parsed) {
      return {
        fixtureId: fixture.id,
        path: fixture.path,
        ok: false,
        errors: ['hermes returned unparseable output'],
        warnings: [],
        repertoireTrap: repertoireCtx.highConfidenceTrapPresent,
        repertoireSignals: repertoireCtx.matchedSignals.length,
        governanceForced: false,
        dynamoRecommendation: null,
        publicReplyPreview: raw.slice(0, 160),
      };
    }
    inference = parsed.inference;
    publicReply = parsed.publicReply;
  }

  const guard = validateEngageOutput({
    path: fixture.path,
    inference,
    publicReply,
    sourceText,
    recentReplyHashes: recentHashes,
  });

  const governanceForced = shouldForceGovernanceWithRepertoire(inference, repertoireCtx);

  let dynamoRecommendation: string | null = null;
  if (process.env.SKIP_GOVERNANCE !== '1') {
    const govOutcome = await callGovernWithSolar(
      DYNAMO_MCP,
      fixture.postTitle || 'Dry-run',
      publicReply,
      {
        agentDid: GROOVER_DID,
        inference,
        force: governanceForced,
      },
    );
    log(`[Dynamo] ${formatDynamoLog(govOutcome)}`);
    dynamoRecommendation = extractDynamoResult(govOutcome)?.recommendation ?? null;
    if (govOutcome.ok && dynamoRecommendation && dynamoRecommendation !== 'PASS') {
      guard.errors.push(`dynamo recommendation: ${dynamoRecommendation}`);
      guard.ok = false;
    }
  }

  const logEntry = buildInferenceLogEntry({
    source: 'groover-dry-run',
    postId: fixture.postId,
    postTitle: fixture.postTitle,
    commentId: fixture.commentId,
    type: fixture.path === 'other-post' ? 'other-post' : undefined,
    inference,
    publicReply,
    govOutcome: null,
    repertoireRouting: repertoireCtx.consulted ? toRepertoireLogFields(repertoireCtx) : undefined,
    repertoireSignals:
      repertoireCtx.consulted && repertoireCtx.matchedSignals.length > 0
        ? repertoireCtx.matchedSignals
        : undefined,
    governanceForced,
  });

  if (!existsSync(DRY_LOG_DIR)) mkdirSync(DRY_LOG_DIR, { recursive: true });
  const outFile = join(DRY_LOG_DIR, `${new Date().toISOString().split('T')[0]}.jsonl`);
  appendFileSync(
    outFile,
    `${JSON.stringify({
      fixture_id: fixture.id,
      path: fixture.path,
      guard_ok: guard.ok,
      guard_errors: guard.errors,
      guard_warnings: guard.warnings,
      dynamo_recommendation: dynamoRecommendation,
      ...logEntry,
    })}\n`,
  );

  recentHashes.add(publicReply.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 240));

  return {
    fixtureId: fixture.id,
    path: fixture.path,
    ok: guard.ok,
    errors: guard.errors,
    warnings: guard.warnings,
    repertoireTrap: repertoireCtx.highConfidenceTrapPresent,
    repertoireSignals: repertoireCtx.matchedSignals.length,
    governanceForced,
    dynamoRecommendation,
    publicReplyPreview: publicReply.slice(0, 160),
  };
}

async function runLoop(): Promise<number> {
  const { loops, delayMs, maxCases, liveRead } = parseArgs();
  let totalFail = 0;

  for (let loop = 1; loop <= loops; loop += 1) {
    log(`=== Dry-run loop ${loop}/${loops} ===`);

    let fixtures = builtinFixtures();
    if (liveRead) {
      const live = await liveReadFixtures(maxCases);
      fixtures = [...live, ...fixtures];
    } else {
      fixtures = [...fixturesFromJsonl(2), ...fixtures];
    }

    const seen = new Set<string>();
    fixtures = fixtures.filter((f) => {
      const key = `${f.path}:${f.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, maxCases);

    const recentHashes = new Set<string>();

    for (const fixture of fixtures) {
      log(`case ${fixture.id} (${fixture.path})`);
      try {
        const result = await runCase(fixture, recentHashes);
        if (result.ok) {
          log(`  PASS trap=${result.repertoireTrap} signals=${result.repertoireSignals} preview="${result.publicReplyPreview}"`);
        } else {
          totalFail += 1;
          log(`  FAIL ${result.errors.join('; ')}`);
          if (result.warnings.length) log(`  warn ${result.warnings.join('; ')}`);
        }
      } catch (error) {
        totalFail += 1;
        log(`  ERROR ${error}`);
      }

      if (delayMs > 0) await sleep(delayMs);
    }
  }

  return totalFail;
}

runLoop()
  .then((failures) => {
    if (failures > 0) process.exit(1);
  })
  .catch((error) => {
    process.stderr.write(`FATAL: ${error}\n`);
    process.exit(1);
  });