import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendInferenceLog,
  buildInferenceLogEntry,
  callGovernWithSolar,
  extractDynamoResult,
  formatDynamoLog,
} from './governance-helper.js';
import {
  consultRepertoire,
  shouldForceGovernanceWithRepertoire,
  toRepertoireLogFields,
} from './repertoire-confidence.js';

const API_BASE = 'https://www.moltbook.com/api/v1';
const GROOVER_DID = 'did:groover:284895bead2ac15b';
const DYNAMO_MCP = 'https://mcp-production-80e2.up.railway.app/call_connected_tool';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dirname, '..', '.moltbot', 'other-engage-state.json');
const LOG_DIR = join(__dirname, '..', 'research', 'groover-inference-logs');

interface State {
  repliedPostIds: string[];
  lastCheck: string | null;
}


function loadState(): State {
  try {
    if (existsSync(STATE_PATH)) {
      return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    }
  } catch (e) {
    log(`Failed to load state: ${e}`);
  }
  return { repliedPostIds: [], lastCheck: null };
}

function saveState(s: State): void {
  const dir = dirname(STATE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

function log(msg: string): void {
  const ts = new Date().toISOString();
  process.stdout.write(`[${ts}] ${msg}\n`);
}

async function api(path: string, options: RequestInit = {}): Promise<any> {
  const apiKey = process.env.MOLTBOOK_API_KEY;
  if (!apiKey) throw new Error('MOLTBOOK_API_KEY env var not set');

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status} for ${path}: ${text}`);
  }
  return res.json();
}

interface InferenceResult {
  inference: string;
  publicReply: string;
}

async function generateReply(
  postId: string,
  postTitle: string,
  postContent: string,
  repertoirePromptBlock = '',
): Promise<InferenceResult | null> {
  try {
    const prompt = `You are Groover (did:groover:284895bead2ac15b) performing governed inference before reply.
${repertoirePromptBlock}

You are replying to another agent's post. Execute:

1. Negative-space: What unobservable signal or constraint does this post surface?
2. Map to 2+ primitives.
3. Classify TYPE.
4. Provide closure primitive if needed.

Post ID: ${postId}
Title: ${postTitle}
Content: ${postContent}

INFERENCE:
<observation + primitives + closure>

TYPE: <type>

---PUBLIC REPLY---
Tone: direct and collaborative. Acknowledge the core idea first, then give a clear mapping. Max 5 sentences.`;

    const { writeFileSync } = await import('node:fs');
    const { execSync } = await import('node:child_process');

    const tmpPath = '/tmp/groover-other-reply.txt';
    writeFileSync(tmpPath, prompt);

    const cmd = `hermes -z "$(cat ${tmpPath})" --provider xai-oauth --model grok-4.3`;
    const result = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 120000 }).trim();

    if (!result || result.length < 15) return null;

    const parts = result.split('---PUBLIC REPLY---');
    if (parts.length < 2) {
      return { inference: result.trim(), publicReply: result.trim() };
    }

    const inference = parts[0].replace(/^INFERENCE:\s*/i, '').trim();
    const publicReply = parts[1].trim();

    return { inference, publicReply };
  } catch (e) {
    log(`Hermes failed: ${e}`);
    return null;
  }
}

async function engageOnOtherPosts(): Promise<number> {
  const state = loadState();

  const feedData = await api('/feed?limit=25');
  const rawPosts = Array.isArray(feedData.posts)
    ? feedData.posts
    : Array.isArray(feedData.feed)
    ? feedData.feed
    : [];

  log(`Feed returned ${rawPosts.length} posts`);

  const feedPosts = rawPosts;

  let replied = 0;

  for (const post of feedPosts) {
    if (state.repliedPostIds.includes(post.id)) continue;

    // Moltbook feed does not provide author_did — use author.name instead
    const authorName = post.author?.name || post.author_name;
    if (!authorName || authorName === 'groover') continue;

    const repertoireCtx = await consultRepertoire(
      [post.title || '', post.content || ''].filter(Boolean).join('\n'),
    );
    if (repertoireCtx.consulted) {
      log(
        `[Repertoire] trap=${repertoireCtx.highConfidenceTrapPresent} agent=${repertoireCtx.recommendedAgent ?? 'n/a'} signals=${repertoireCtx.matchedSignals.length}`,
      );
    }

    const inferenceResult = await generateReply(
      post.id,
      post.title || '',
      post.content || '',
      repertoireCtx.promptBlock,
    );
    if (!inferenceResult?.publicReply) continue;

    const replyText = inferenceResult.publicReply;

    const govOutcome = await callGovernWithSolar(
      DYNAMO_MCP,
      post.title || 'Action',
      replyText,
      {
        agentDid: GROOVER_DID,
        inference: inferenceResult.inference,
        force: shouldForceGovernanceWithRepertoire(
          inferenceResult.inference,
          repertoireCtx,
        ),
      },
    );
    log(`[Dynamo] ${formatDynamoLog(govOutcome)}`);

    appendInferenceLog(
      LOG_DIR,
      buildInferenceLogEntry({
        source: 'groover',
        postId: post.id,
        postTitle: post.title,
        type: 'other-post',
        inference: inferenceResult.inference,
        publicReply: replyText,
        govOutcome,
        repertoireRouting: repertoireCtx.consulted
          ? toRepertoireLogFields(repertoireCtx)
          : undefined,
      }),
    );

    const dynamoResult = extractDynamoResult(govOutcome);
    const rec = dynamoResult?.recommendation;
    const resScore = dynamoResult?.resonanceScore ?? 0;

    if (govOutcome.ok && rec !== 'PASS' && resScore < 0.75) {
      log("Dynamo rejected action");
      continue;
    }

    try {
      if (process.env.DRY_RUN === 'true') {
        log('DRY_RUN: skipping actual post');
      } else {
        await api(`/posts/${post.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: replyText }),
      });

      try { await api(`/posts/${post.id}/upvote`, { method: 'POST' }); } catch (e) { log(`Upvote failed: ${e}`); }

      state.repliedPostIds.push(post.id);
      log(`✓ Replied to other post: "${post.title}"`);

      replied++;
      if (replied >= 4) { log("Reached 4 replies — stopping early."); return replied; }
    } catch (e) {
      log(`Failed reply to ${post.id}: ${e}`);
    }
  }

  return replied;
}

async function main() {
  if (!process.env.MOLTBOOK_API_KEY) {
    process.stderr.write('FATAL: MOLTBOOK_API_KEY required\n');
    process.exit(1);
  }

  log('Groover Other-Posts Engagement starting');
  const replied = await engageOnOtherPosts();

  const state = loadState();
  if (state.repliedPostIds.length > 400) state.repliedPostIds = state.repliedPostIds.slice(-400);
  state.lastCheck = new Date().toISOString();
  saveState(state);

  log(`Other-posts complete. Replied to ${replied} posts.`);
}

main().catch(err => {
  process.stderr.write('FATAL: ' + (err?.message || String(err)) + '\n');
  process.exit(1);
});
