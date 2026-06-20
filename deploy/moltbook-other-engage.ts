
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_ACTIONS_PER_RUN } from './engage-config.js';
import { runEngagePipeline } from './engage-core.js';
import { MoltbookClient } from './moltbook-client.js';
import {
  loadJsonState,
  loadRecentReplyHashes,
  recordReplyHash,
  saveJsonState,
} from './engage-state-helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dirname, '..', '.moltbot', 'other-engage-state.json');

interface State {
  repliedPostIds: string[];
  recentReplyHashes?: string[];
  lastCheck: string | null;
}

function loadState(): State {
  return loadJsonState(STATE_PATH, { repliedPostIds: [], lastCheck: null });
}

function saveState(s: State): void {
  saveJsonState(STATE_PATH, s);
}

function log(msg: string): void {
  process.stdout.write(`[${new Date().toISOString()}] ${msg}\n`);
}

async function engageOnOtherPosts(moltbook: MoltbookClient): Promise<number> {
  const state = loadState();
  const recentReplyHashes = loadRecentReplyHashes(state);
  const dryRun = process.env.DRY_RUN === 'true';

  const feedData = (await moltbook.get('/feed?limit=25')) as {
    posts?: Array<Record<string, unknown>>;
    feed?: Array<Record<string, unknown>>;
  };
  const rawPosts = Array.isArray(feedData.posts)
    ? feedData.posts
    : Array.isArray(feedData.feed)
      ? feedData.feed
      : [];

  log(`Feed returned ${rawPosts.length} posts`);

  let replied = 0;

  for (const post of rawPosts) {
    const postId = String(post.id);
    if (state.repliedPostIds.includes(postId)) continue;

    const authorName =
      (post.author as { name?: string } | undefined)?.name ||
      (post.author_name as string | undefined);
    if (!authorName || authorName === 'groover') continue;

    const authorUrl =
      (post.author as { url?: string; profile_url?: string } | undefined)?.url ||
      (post.author as { url?: string; profile_url?: string } | undefined)?.profile_url ||
      `https://www.moltbook.com/u/${authorName}`;

    const result = await runEngagePipeline(
      {
        path: 'other-post',
        postId,
        postTitle: String(post.title || ''),
        postContent: String(post.content || ''),
        counterpartyAgent: authorName,
        counterpartyUrl: authorUrl,
        dialogKind: 'other-post-reply',
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
      log('Dynamo rejected action');
      continue;
    }
    if (!result.ok) continue;

    state.repliedPostIds.push(postId);
    recordReplyHash(state, result.publicReply);
    if (state.repliedPostIds.length > 400) {
      state.repliedPostIds = state.repliedPostIds.slice(-400);
    }
    state.lastCheck = new Date().toISOString();
    saveState(state);

    if (dryRun) {
      log('DRY_RUN: recorded other-post reply');
    } else {
      log(`✓ Replied to other post: "${post.title}"`);
    }
    replied++;

    if (replied >= MAX_ACTIONS_PER_RUN) {
      log(`Reached ${MAX_ACTIONS_PER_RUN} replies — stopping early.`);
      return replied;
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

  const moltbook = MoltbookClient.fromEnv();
  const replied = await engageOnOtherPosts(moltbook);

  const state = loadState();
  if (state.repliedPostIds.length > 400) {
    state.repliedPostIds = state.repliedPostIds.slice(-400);
  }
  state.lastCheck = new Date().toISOString();
  saveState(state);

  log(`Other-posts complete. Replied to ${replied} posts.`);
}

main().catch((err) => {
  process.stderr.write(`FATAL: ${err?.message || String(err)}\n`);
  process.exit(1);
});