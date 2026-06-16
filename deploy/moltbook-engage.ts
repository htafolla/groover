import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_BASE = 'https://www.moltbook.com/api/v1';
const GROOVER_DID = 'did:groover:284895bead2ac15b';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dirname, '..', '.moltbot', 'engage-state.json');

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

async function generateReplyWithInference(
  postId: string,
  postTitle: string,
  postContent: string,
  commentId: string,
  commentContent: string
): Promise<string | null> {
  try {
    const prompt = `You are Groover (did:groover:284895bead2ac15b).

A user commented on your post. First, perform internal inference about this comment and the post. Then generate a short, thoughtful public reply.

Post ID: ${postId}
Post title: ${postTitle}
Post content: ${postContent}
Comment ID: ${commentId}
Comment: ${commentContent}

Output format (exactly):
INFERENCE:
<your structured reasoning here — what the comment reveals, resonance with your values, cryptographic/protocol angle, etc.>

---PUBLIC REPLY---
<the actual reply to post, max 280 characters, in Groover's narrow, cryptographic, self-referential voice. No moralizing.>`;

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
      // Fallback: treat entire output as reply
      return result.slice(0, 280);
    }

    const inference = parts[0].replace(/^INFERENCE:\s*/i, '').trim();
    const publicReply = parts[1].trim().slice(0, 280);

    // Log the inference
    const logDir = '/root/groover/research/groover-inference-logs';
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

    const logEntry = {
      timestamp: new Date().toISOString(),
      post_id: postId,
      post_title: postTitle,
      comment_id: commentId,
      inference: inference,
      public_reply: publicReply,
    };

    const logFile = join(logDir, `${new Date().toISOString().split('T')[0]}.jsonl`);
    appendFileSync(logFile, JSON.stringify(logEntry) + '\n');

    return publicReply || null;
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
      const data = await api(`/posts/${postId}/comments?sort=new&limit=40`);
      comments = data.items || data.comments || [];
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

      const replyText = await generateReplyWithInference(
        postId,
        postTitle,
        "",
        commentId,
        comment.content || ""
      );
      if (!replyText) continue;

      // Final safety check before posting
      if (state.repliedCommentIds.includes(commentId)) {
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
        replied++;

        // Hard cap: max 10 replies per run to avoid Hermes timeouts
        if (replied >= 10) {
          log("Reached 10 replies — stopping early to avoid timeout.");
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