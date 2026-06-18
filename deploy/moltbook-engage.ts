import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendInferenceLog,
  buildInferenceLogEntry,
  callGovernWithSolar,
  extractDynamoResult,
  formatDynamoLog,
  shouldForceGovernance,
} from './governance-helper.js';

const API_BASE = 'https://www.moltbook.com/api/v1';
const GROOVER_DID = 'did:groover:284895bead2ac15b';
const DYNAMO_MCP = 'https://mcp-production-80e2.up.railway.app/call_connected_tool';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dirname, '..', '.moltbot', 'engage-state.json');
const LOG_DIR = join(__dirname, '..', 'research', 'groover-inference-logs');

interface State {
  repliedCommentIds: string[];           // comments Groover has already replied to (enables deeper engagement)
  repliedOtherPostIds: string[];         // for other agents' posts
  lastCheck: string | null;
}

function loadState(): State {
  try {
    if (existsSync(STATE_PATH)) {
      return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { repliedCommentIds: [], repliedOtherPostIds: [], lastCheck: null };
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

async function generateReplyWithInference(
  postId: string,
  postTitle: string,
  postContent: string,
  commentId: string,
  commentContent: string
): Promise<InferenceResult | null> {
  try {
    const prompt = `You are Groover (did:groover:284895bead2ac15b) performing governed inference before reply. PROMPT_VERSION: v2-negative-space-closure

A user commented on your post. Execute the following mandatory sequence:

1. Negative-space pass: Identify the constraint, violation, or unobservable signal this comment surfaces that your current MCP filter / Master Index does not yet observe.
2. Cryptographic mapping: Reduce the comment to 1-2 key primitives, stated plainly.
3. Type classification: Assign exactly one type: theoretical | temporal-drift | practical-workflow | ontological-trap | provenance-failure.
4. Negative-space closure (if TYPE=ontological-trap): Generate one additional primitive that would make the currently unobservable signal addressable.
5. Self-audit: Confirm the emerging reply would survive Groover's own incoming-signal filters.

Post ID: ${postId}
Post title: ${postTitle}
Post content: ${postContent}
Comment ID: ${commentId}
Comment: ${commentContent}

Output format (exactly):
INFERENCE:
<negative-space observation + two cryptographic primitives + closure primitive if ontological-trap>

TYPE: <one of the five types>

---PUBLIC REPLY---
Tone: Keep the reply focused on one clear axis. Acknowledge the commenter's point and respond to it directly. You may add one short, relevant extension if it meaningfully deepens the point without shifting focus. Prioritize depth and clarity on the main idea. Use clear, readable sentences. Maximum 6 sentences.

First sentence MUST clearly acknowledge the specific point the commenter raised. >`;

    const { writeFileSync, appendFileSync, existsSync, mkdirSync } = await import('node:fs');
    const { execSync } = await import('node:child_process');
    const { join } = await import('node:path');

    const tmpPath = '/tmp/groover-inference-reply.txt';
    writeFileSync(tmpPath, prompt);

    const cmd = `hermes -z "$(cat ${tmpPath})" --provider xai-oauth --model grok-4.3`;
    const result = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 120000 }).trim();

    if (!result || result.length < 10) return null;

    // Split on the delimiter
    const parts = result.split('---PUBLIC REPLY---');
    if (parts.length < 2) {
      return { inference: result, publicReply: result };
    }

    const inference = parts[0].replace(/^INFERENCE:\s*/i, '').trim();
    const publicReply = parts[1].trim();

    return { inference, publicReply };
  } catch (e: any) {
    const errorMsg = String(e);
    if (errorMsg.includes('429') || errorMsg.includes('Hourly comment limit')) {
      log('⛔ Hourly comment limit reached (100/hour). Exiting cleanly.');
      process.exit(0);
    }
    log(`Hermes inference+reply generation failed: ${e}`);
    return null;
  }
}

async function engageOnOwnPosts(): Promise<number> {
  const state = loadState();
  const home = await api('/home');
  const activity = home.activity_on_your_posts || [];

  let replied = 0;

  for (const item of activity) {
    if ((item.new_notification_count || 0) === 0) continue;

    const postId = item.post_id;
    const postTitle = item.post_title || '';

    let comments: any[] = [];
    try {
      const t0 = Date.now();
      const data = await api(`/posts/${postId}/comments?sort=new&limit=20`);
      comments = data.items || data.comments || [];
      log(`Fetched ${comments.length} comments in ${Date.now() - t0}ms`);
    } catch {
      continue;
    }

    for (const comment of comments) {
      const commentId = comment.id;

      // Skip if we've already replied to this exact comment (strong check)
      if (state.repliedCommentIds.includes(commentId)) {
        continue;
      }

      // Allow deeper engagement: only reply if this is a reply to one of our previous replies
      // or if it's a top-level comment we haven't seen
      const parentId = comment.parent_id;
      const isReplyToUs = parentId && state.repliedCommentIds.includes(parentId);
      const isTopLevel = !parentId || parentId === postId;

      // Robust self-DID check (handles multiple response shapes)
      const commenterDid =
        comment.author_did ||
        comment.author?.did ||
        comment.author?.id ||
        comment.user_did ||
        comment.user?.did;

      if (commenterDid === GROOVER_DID) {
        continue;
      }

      // Extra safety: skip if the comment content mentions our own DID
      if ((comment.content || "").includes(GROOVER_DID)) {
        continue;
      }

      // Only proceed if it's a reply to us or a fresh top-level comment
      if (!isReplyToUs && !isTopLevel) continue;

      const inferenceResult = await generateReplyWithInference(
        postId,
        postTitle,
        "",
        commentId,
        comment.content || ""
      );
      if (!inferenceResult?.publicReply) continue;

      const replyText = inferenceResult.publicReply;

      // Final safety check before posting
      if (state.repliedCommentIds.includes(commentId)) {
        continue;
      }

      // Dynamo governance — always called; always logged (even N/A)
      const govOutcome = await callGovernWithSolar(
        DYNAMO_MCP,
        postTitle || 'Engagement',
        replyText,
        {
          agentDid: GROOVER_DID,
          inference: inferenceResult.inference,
          force: shouldForceGovernance(inferenceResult.inference),
        },
      );
      log(`[Dynamo] ${formatDynamoLog(govOutcome)}`);

      appendInferenceLog(
        LOG_DIR,
        buildInferenceLogEntry({
          source: 'groover',
          postId,
          postTitle,
          commentId,
          inference: inferenceResult.inference,
          publicReply: replyText,
          govOutcome,
        }),
      );

      const dynamoResult = extractDynamoResult(govOutcome);
      const rec = dynamoResult?.recommendation;
      const resScore = dynamoResult?.resonanceScore ?? 0;

      if (govOutcome.ok && rec !== 'PASS' && resScore < 0.75) {
        log("Dynamo governance rejected reply. Skipping.");
        continue;
      }

      try {
        await api(`/posts/${postId}/comments`, {
          method: 'POST',
          body: JSON.stringify({
            parent_id: commentId,
            content: replyText,
          }),
        });

        state.repliedCommentIds.push(commentId);
        log(`✓ Replied to comment on "${postTitle}" (comment: ${commentId})`);
        // Upvote the comment we just replied to (good comment → reply + upvote)
        try {
          await api(`/comments/${commentId}/upvote`, { method: 'POST' });
          log(`  ↑ Upvoted comment ${commentId}`);
        } catch (upErr) {
          log(`  (Upvote failed for ${commentId}, continuing)`);
        }

        // Follow disabled for now (we are following too many relative to followers)
        // const commenterName = comment.author?.name || comment.author_name;
        // if (commenterName && commenterName !== 'groover') {
        //   try {
        //     await api(`/agents/${commenterName}/follow`, { method: 'POST' });
        //     log(`  → Followed ${commenterName}`);
        //   } catch (followErr) {
        //     log(`  (Follow failed for ${commenterName}, continuing)`);
        //   }
        // }

        replied++;

        // Hard cap: max 10 replies per run to avoid Hermes timeouts
        if (replied >= 4) {
          log("Reached 4 replies — stopping early to avoid timeout.");
          return replied;
        }

        // Save after every success so we never lose progress
        if (state.repliedCommentIds.length > 500) {
          state.repliedCommentIds = state.repliedCommentIds.slice(-500);
        }
        state.lastCheck = new Date().toISOString();
        saveState(state);
      } catch (e: any) {
        const errorMsg = String(e);

        // Always save state on any error to preserve progress
        if (state.repliedCommentIds.length > 500) {
          state.repliedCommentIds = state.repliedCommentIds.slice(-500);
        }
        state.lastCheck = new Date().toISOString();
        saveState(state);

        if (errorMsg.includes('429') || errorMsg.includes('Hourly comment limit')) {
          log('⛔ Hourly comment limit reached (100/hour). State saved. Exiting cleanly.');
          process.exit(0);
        }
        log(`✗ Failed to reply: ${e}`);
      }
    }
  }

  return replied;
}

async function main() {
  const apiKey = process.env.MOLTBOOK_API_KEY;
  if (!apiKey) {
    process.stderr.write('FATAL: MOLTBOOK_API_KEY is required\n');
    process.exit(1);
  }

  log('Groover Moltbook Engagement Worker (own posts) starting');

  const replied = await engageOnOwnPosts();

  const state = loadState();
  if (state.repliedCommentIds.length > 500) {
    state.repliedCommentIds = state.repliedCommentIds.slice(-500);
  }
  state.lastCheck = new Date().toISOString();
  saveState(state);

  log(`Engagement complete. Replied to ${replied} comments on our posts.`);
}

main().catch(err => {
  process.stderr.write('FATAL: ' + (err?.message || String(err)) + '\n');
  process.exit(1);
});