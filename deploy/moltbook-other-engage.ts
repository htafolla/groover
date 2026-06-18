import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_ACTIONS_PER_RUN } from './engage-config.js';
import { runEngagePipeline } from './engage-core.js';
import { MoltbookClient } from './moltbook-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dirname, '..', '.moltbot', 'other-engage-state.json');

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
  process.stdout.write(`[${new Date().toISOString()}] ${msg}\n`);
}

async function engageOnOtherPosts(moltbook: MoltbookClient): Promise<number> {
  const state = loadState();
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

    const result = await runEngagePipeline(
      {
        path: 'other-post',
        postId,
        postTitle: String(post.title || ''),
        postContent: String(post.content || ''),
      },
      {
        dryRun,
        moltbook,
        onLog: log,
        logSource: 'groover',
      },
    );

    if (result.blocked) {
      log('Dynamo rejected action');
      continue;
    }
    if (!result.ok) continue;

    state.repliedPostIds.push(postId);
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