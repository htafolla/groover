
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROOVER_DID, MAX_ACTIONS_PER_RUN } from './engage-config.js';
import { runEngagePipeline } from './engage-core.js';
import { MoltbookClient } from './moltbook-client.js';
import {
  loadJsonState,
  loadRecentReplyHashes,
  recordReplyHash,
  saveJsonState,
} from './engage-state-helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dirname, '..', '.moltbot', 'engage-state.json');

interface State {
  repliedCommentIds: string[];
  repliedOtherPostIds: string[];
  recentReplyHashes?: string[];
  lastCheck: string | null;
}

function log(msg: string): void {
  process.stdout.write(`[${new Date().toISOString()}] ${msg}\n`);
}

function trimState(state: State): void {
  if (state.repliedCommentIds.length > 500) {
    state.repliedCommentIds = state.repliedCommentIds.slice(-500);
  }
  state.lastCheck = new Date().toISOString();
}

function loadState(): State {
  return loadJsonState(STATE_PATH, {
    repliedCommentIds: [],
    repliedOtherPostIds: [],
    lastCheck: null,
  });
}

function saveState(s: State): void {
  saveJsonState(STATE_PATH, s);
}

async function engageOnOwnPosts(moltbook: MoltbookClient): Promise<number> {
  const state = loadState();
  const recentReplyHashes = loadRecentReplyHashes(state);
  const home = (await moltbook.get('/home')) as {
    activity_on_your_posts?: Array<{ post_id: string; post_title?: string; new_notification_count?: number }>;
  };
  const activity = home.activity_on_your_posts || [];

  let replied = 0;
  const dryRun = process.env.DRY_RUN === 'true';

  for (const item of activity) {
    if ((item.new_notification_count || 0) === 0) continue;

    const postId = item.post_id;
    const postTitle = item.post_title || '';

    let comments: Array<Record<string, unknown>> = [];
    try {
      const t0 = Date.now();
      const data = (await moltbook.get(`/posts/${postId}/comments?sort=new&limit=20`)) as {
        items?: Array<Record<string, unknown>>;
        comments?: Array<Record<string, unknown>>;
      };
      comments = data.items || data.comments || [];
      log(`Fetched ${comments.length} comments in ${Date.now() - t0}ms`);
    } catch {
      continue;
    }

    for (const comment of comments) {
      const commentId = String(comment.id);

      if (state.repliedCommentIds.includes(commentId)) continue;

      const parentId = comment.parent_id as string | undefined;
      const isReplyToUs = parentId && state.repliedCommentIds.includes(parentId);
      const isTopLevel = !parentId || parentId === postId;

      const commenterDid =
        (comment.author_did as string | undefined) ||
        (comment.author as { did?: string; id?: string } | undefined)?.did ||
        (comment.author as { did?: string; id?: string } | undefined)?.id ||
        (comment.user_did as string | undefined) ||
        (comment.user as { did?: string } | undefined)?.did;

      if (commenterDid === GROOVER_DID) continue;
      if (String(comment.content || '').includes(GROOVER_DID)) continue;
      if (!isReplyToUs && !isTopLevel) continue;

      if (state.repliedCommentIds.includes(commentId)) continue;

      const commenterName =
        (comment.author as { name?: string } | undefined)?.name ||
        (comment.author_name as string | undefined) ||
        (comment.user as { name?: string } | undefined)?.name ||
        commenterDid ||
        'unknown';
      const commenterUrl =
        (comment.author as { url?: string; profile_url?: string } | undefined)?.url ||
        (comment.author as { url?: string; profile_url?: string } | undefined)?.profile_url ||
        `https://www.moltbook.com/u/${commenterName}`;

      try {
        const result = await runEngagePipeline(
          {
            path: 'own-post',
            postId,
            postTitle,
            postContent: '',
            commentId,
            commentContent: String(comment.content || ''),
            counterpartyAgent: commenterName,
            counterpartyUrl: commenterUrl,
            dialogKind: 'own-post-reply',
          },
          {
            dryRun,
            skipHermes: dryRun || process.env.SKIP_HERMES === '1',
            moltbook,
            onLog: log,
            logSource: 'groover',
            recentReplyHashes,
          },
        );

        if (result.blocked) {
          log('Dynamo governance rejected reply. Skipping.');
          continue;
        }
        if (!result.ok) continue;

        state.repliedCommentIds.push(commentId);
        recordReplyHash(state, result.publicReply);
        log(`✓ Replied to comment on "${postTitle}" (comment: ${commentId})`);
        replied++;

        if (replied >= MAX_ACTIONS_PER_RUN) {
          log(`Reached ${MAX_ACTIONS_PER_RUN} replies — stopping early to avoid timeout.`);
          trimState(state);
          saveState(state);
          return replied;
        }

        trimState(state);
        saveState(state);
      } catch (e: unknown) {
        const errorMsg = String(e);
        trimState(state);
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
  if (!process.env.MOLTBOOK_API_KEY) {
    process.stderr.write('FATAL: MOLTBOOK_API_KEY is required\n');
    process.exit(1);
  }

  log('Groover Moltbook Engagement Worker (own posts) starting');

  const moltbook = MoltbookClient.fromEnv();
  const replied = await engageOnOwnPosts(moltbook);

  const state = loadState();
  trimState(state);
  saveState(state);

  log(`Engagement complete. Replied to ${replied} comments on our posts.`);
}

main().catch((err) => {
  process.stderr.write(`FATAL: ${err?.message || String(err)}\n`);
  process.exit(1);
});