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
import { loadPlatformEnv } from './load-platform-env.js';
import { runEngagePipeline, type EngageCase } from './engage-core.js';
import { MoltbookClient } from './moltbook-client.js';

loadPlatformEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const GROOVER_ROOT = join(__dirname, '..');
const DRY_LOG_DIR = join(GROOVER_ROOT, 'research', 'dry-run-results');

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

function builtinFixtures(): Array<EngageCase & { id: string }> {
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

function fixturesFromJsonl(max: number): EngageCase[] {
  const logDir = join(GROOVER_ROOT, 'research', 'groover-inference-logs');
  if (!existsSync(logDir)) return [];

  const fixtures: EngageCase[] = [];
  const files = readdirSync(logDir).filter((f) => f.endsWith('.jsonl')).sort().reverse();

  for (const file of files) {
    const lines = readFileSync(join(logDir, file), 'utf8').trim().split('\n').reverse();
    for (const line of lines) {
      if (!line) continue;
      try {
        const entry = JSON.parse(line) as Record<string, unknown>;
        const path = entry.type === 'other-post' ? 'other-post' : 'own-post';
        const commentSnippet =
          typeof entry.comment_content === 'string'
            ? entry.comment_content
            : typeof entry.public_reply === 'string'
              ? ''
              : '';
        fixtures.push({
          path,
          postId: String(entry.post_id ?? 'unknown'),
          postTitle: String(entry.post_title ?? 'Untitled'),
          postContent:
            path === 'other-post'
              ? String(entry.post_title ?? 'Untitled')
              : '',
          commentId: entry.comment_id ? String(entry.comment_id) : `dry-${fixtures.length}`,
          commentContent:
            path === 'own-post' && commentSnippet
              ? commentSnippet.slice(0, 280)
              : undefined,
        });
        if (fixtures.length >= max) return fixtures;
      } catch {
        // skip malformed
      }
    }
  }

  return fixtures;
}

async function liveReadFixtures(max: number): Promise<EngageCase[]> {
  const moltbook = MoltbookClient.fromEnv();
  const fixtures: EngageCase[] = [];

  try {
    const home = (await moltbook.get('/home')) as {
      activity_on_your_posts?: Array<{ post_id: string; post_title?: string }>;
    };
    for (const item of home.activity_on_your_posts ?? []) {
      if (fixtures.length >= max) break;
      const comments = (await moltbook.get(
        `/posts/${item.post_id}/comments?sort=new&limit=3`,
      )) as {
        items?: Array<{ id: string; content?: string }>;
        comments?: Array<{ id: string; content?: string }>;
      };
      const list = comments.items ?? comments.comments ?? [];
      for (const comment of list.slice(0, 1)) {
        fixtures.push({
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
    const feed = (await moltbook.get('/feed?limit=10')) as {
      posts?: Array<{ id: string; title?: string; content?: string; author?: { name?: string } }>;
      feed?: Array<{ id: string; title?: string; content?: string; author?: { name?: string } }>;
    };
    const posts = feed.posts ?? feed.feed ?? [];
    for (const post of posts) {
      if (fixtures.length >= max) break;
      if (post.author?.name === 'groover') continue;
      fixtures.push({
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
  fixture: EngageCase & { id?: string },
  recentHashes: Set<string>,
): Promise<DryRunCaseResult> {
  const fixtureId = fixture.id ?? `${fixture.path}-${fixture.postId}`;

  const result = await runEngagePipeline(fixture, {
    skipHermes: process.env.SKIP_HERMES === '1',
    skipGovernance: process.env.SKIP_GOVERNANCE === '1',
    skipPost: true,
    dryRun: true,
    recentReplyHashes: recentHashes,
    logSource: 'groover-dry-run',
    onLog: log,
  });

  if (!existsSync(DRY_LOG_DIR)) mkdirSync(DRY_LOG_DIR, { recursive: true });
  const outFile = join(DRY_LOG_DIR, `${new Date().toISOString().split('T')[0]}.jsonl`);
  appendFileSync(
    outFile,
    `${JSON.stringify({
      fixture_id: fixtureId,
      path: fixture.path,
      guard_ok: result.ok,
      guard_errors: result.errors,
      guard_warnings: result.warnings,
      dynamo_recommendation: result.dynamoRecommendation,
      blocked: result.blocked,
      repertoire_trap: result.repertoireTrap,
      repertoire_signals: result.repertoireSignals,
    })}\n`,
  );

  if (result.publicReply) {
    recentHashes.add(result.publicReply.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 240));
  }

  return {
    fixtureId,
    path: fixture.path,
    ok: result.ok,
    errors: result.errors,
    warnings: result.warnings,
    repertoireTrap: result.repertoireTrap,
    repertoireSignals: result.repertoireSignals,
    governanceForced: result.governanceForced,
    dynamoRecommendation: result.dynamoRecommendation,
    publicReplyPreview: result.publicReply.slice(0, 160),
  };
}

async function runLoop(): Promise<number> {
  const { loops, delayMs, maxCases, liveRead } = parseArgs();
  let totalFail = 0;

  for (let loop = 1; loop <= loops; loop += 1) {
    log(`=== Dry-run loop ${loop}/${loops} ===`);

    let fixtures: Array<EngageCase & { id?: string }> = builtinFixtures();

    if (liveRead) {
      const live = await liveReadFixtures(maxCases);
      fixtures = [...live.map((f) => ({ ...f, id: `live-${f.postId.slice(0, 8)}` })), ...fixtures];
    } else {
      fixtures = [
        ...fixturesFromJsonl(2).map((f) => ({ ...f, id: `jsonl-${f.postId.slice(0, 8)}` })),
        ...fixtures,
      ];
    }

    const seen = new Set<string>();
    fixtures = fixtures
      .filter((f) => {
        const key = `${f.path}:${f.id ?? f.postId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, maxCases);

    const recentHashes = new Set<string>();

    for (const fixture of fixtures) {
      log(`case ${fixture.id} (${fixture.path})`);
      try {
        const result = await runCase(fixture, recentHashes);
        if (result.ok) {
          log(
            `  PASS trap=${result.repertoireTrap} signals=${result.repertoireSignals} preview="${result.publicReplyPreview}"`,
          );
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