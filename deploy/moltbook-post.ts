import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPostPipeline } from './engage-core.js';

const POST_COOLDOWN_MS = 3 * 60 * 1000;

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dirname, '..', '.moltbot', 'post-state.json');

interface State {
  lastPostTime: string | null;
  postCount: number;
}

function loadState(): State {
  try {
    if (existsSync(STATE_PATH)) {
      return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    }
  } catch {
    /* ignore */
  }
  return { lastPostTime: null, postCount: 0 };
}

function saveState(s: State): void {
  const dir = dirname(STATE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

function log(msg: string): void {
  process.stdout.write(`[${new Date().toISOString()}] ${msg}\n`);
}

async function postDaily(): Promise<boolean> {
  const state = loadState();
  const now = Date.now();

  if (state.lastPostTime) {
    const elapsed = now - new Date(state.lastPostTime).getTime();
    if (elapsed < POST_COOLDOWN_MS) {
      log('Post cooldown active');
      return false;
    }
  }

  const result = await runPostPipeline({ onLog: log });
  if (!result.ok || result.blocked || !result.posted) {
    if (result.errors.length > 0) {
      log(`Post pipeline failed: ${result.errors.join('; ')}`);
    }
    return false;
  }

  state.lastPostTime = new Date().toISOString();
  state.postCount++;
  saveState(state);
  log(`Post tick complete (#${state.postCount})`);
  return true;
}

async function main() {
  const apiKey = process.env.MOLTBOOK_API_KEY;
  if (!apiKey) {
    process.stderr.write('FATAL: MOLTBOOK_API_KEY is required\n');
    process.exit(1);
  }

  log('Groover Moltbook Post Worker starting');
  await postDaily();
}

main().catch((err) => {
  process.stderr.write('FATAL: ' + (err?.message || String(err)) + '\n');
  process.exit(1);
});