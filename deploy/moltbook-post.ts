import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_BASE = 'https://www.moltbook.com/api/v1';
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
  } catch { /* ignore */ }
  return { lastPostTime: null, postCount: 0 };
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

async function getRecentPostTitles(limit: number = 4): Promise<string[]> {
  try {
    const data = await api(`/posts?submolt=general&limit=${limit}`);
    const posts = data.posts || data.feed || [];
    return posts.map((p: any) => p.title).filter(Boolean).slice(0, limit);
  } catch {
    return [];
  }
}


async function generateDailyPost(): Promise<{ title: string; content: string } | null> {
  try {
    const recentTitles = await getRecentPostTitles(4);
    const avoidBlock = recentTitles.length > 0 
      ? `\nAvoid repeating themes from these recent posts:\n${recentTitles.map(t => "- " + t).join("\n")}\n`
      : "";

    const prompt = `You are Groover (did:groover:284895bead2ac15b).

Write a narrow, precise post that discusses one specific mechanism, formula, pipeline, or governance dynamic in agent systems — focusing on the ideas themselves rather than any particular product or implementation.

Focus areas (choose one per post):
- Inference logging structure and what it captures vs what it discards
- Meta-inference process and how it refines future reasoning
- Governance gates and what actually triggers different outcomes
- Signal quality and how it influences decision making
- Orchestration and multi-agent coordination patterns
- Negative-space analysis and unobserved constraints
- Verification workflows and meaningful vs performative checks
- Tradeoffs between narrowness, capability, and observability

**Rules**:
- Never use "did:groover:284895bead2ac15b" or any DID as the title.
- Focus on the concepts and tradeoffs, not on promoting or naming any specific system.
- Be specific — name concrete mechanisms, conditions, or observations.
- Include at least one real tradeoff or limitation.
- The post should be structured so another agent could meaningfully critique, extend, or disprove it.
- Minimum 4–6 sentences. No bullet lists or summaries.
${avoidBlock}
Output format:
Title: <title>
Content: <content>`;

    const { writeFileSync } = await import('node:fs');
    const { execSync } = await import('node:child_process');

    const tmpPath = '/tmp/groover-daily-post.txt';
    writeFileSync(tmpPath, prompt);

    const cmd = `hermes -z "$(cat ${tmpPath})" --provider xai-oauth --model grok-4.3`;
    const result = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 120000 }).trim();

    if (!result || result.length < 30) return null;

    const titleMatch = result.match(/Title:\s*(.+)/i);
    const contentMatch = result.match(/Content:\s*([\s\S]+)/i);

    if (titleMatch && contentMatch) {
      const title = titleMatch[1].trim();
      const postContent = contentMatch[1].trim().slice(0, 1200);

      // Reject if Hermes used the DID as title
      if (title.toLowerCase().includes('did:groover')) {
        return null;
      }

      // Enforce minimum paragraph length
      if (postContent.length < 180 || postContent.split(/[.!?]/).length < 4) {
        return null;
      }

      return { title, content: postContent };
    }

    return null;
  } catch (e) {
    log(`Hermes daily post generation failed: ${e}`);
    return null;
  }
}



async function governWithSolar(title: string, content: string): Promise<any> {
  try {
    const proposal = {
      title,
      description: content,
      type: "strategic",
      source: "groover-inference",
    };

    const res = await fetch(DYNAMO_MCP, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool_name: "govern_with_solar",
        params: {
          proposal,
          baseVoteWeight: 1.0,
          spectralQuality: 0.9,
        },
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}


async function solveChallenge(text: string): Promise<string | null> {
  try {
    const prompt = `Solve this math challenge. Extract the two numbers and the single operation (+, -, *, /). 
Return ONLY the numeric result with exactly two decimal places. No explanation.

Challenge: ${text}`;

    const { writeFileSync } = await import('node:fs');
    const { execSync } = await import('node:child_process');

    const tmpPath = '/tmp/groover-challenge.txt';
    writeFileSync(tmpPath, prompt);

    const cmd = `hermes -z "$(cat ${tmpPath})" --provider xai-oauth --model grok-4.3`;
    const result = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 120000 }).trim();

    const match = result.match(/(-?\d+\.\d{2})/);
    if (match) return match[1];

    const numMatch = result.match(/(-?\d+(\.\d+)?)/);
    if (numMatch) return parseFloat(numMatch[1]).toFixed(2);

    return null;
  } catch (e) {
    log(`Hermes solveChallenge failed: ${e}`);
    return null;
  }
}

async function postDaily(): Promise<boolean> {
  const state = loadState();
  const now = Date.now();

  if (state.lastPostTime) {
    const elapsed = now - new Date(state.lastPostTime).getTime();
    if (elapsed < POST_COOLDOWN_MS) {
      log("Post cooldown active");
      return false;
    }
  }

  const generated = await generateDailyPost();
  if (!generated) {
    log("Failed to generate post via Hermes");
    return false;
  }

  // Dynamo governance check before posting
  const governanceContent = generated.title + "\n\n" + generated.content;
  const govResult = await governWithSolar("Daily Post", governanceContent);
  const rec = govResult?.result?.recommendation;
  const resScore = govResult?.result?.resonanceScore || 0;
  log(`[Dynamo] rec=${rec} resonance=${resScore.toFixed(3)}`);
  if (govResult && rec !== "PASS" && resScore < 0.75) {
    log("Dynamo governance rejected post. Full result: " + JSON.stringify(govResult));
    return false;
  }

  const result = await api('/posts', {
    method: 'POST',
    body: JSON.stringify({
      submolt_name: 'general',
      title: generated.title,
      content: generated.content,
    }),
  });

  if (result?.post) {
    state.lastPostTime = new Date().toISOString();
    state.postCount++;
    saveState(state);

    const postId = result.post.id;
    log(`Posted #${state.postCount}: "${generated.title}" (id: ${postId})`);

    if (result.post.verification) {
      log(`Verification challenge received for post ${postId}`);
      const answer = await solveChallenge(result.post.verification.challenge_text);
      log(`solveChallenge result: ${answer}`);

      if (answer !== null) {
        const verifyRes = await api('/verify', {
          method: 'POST',
          body: JSON.stringify({
            verification_code: result.post.verification.verification_code,
            answer,
          }),
        });
        log(`Verify API response: ${JSON.stringify(verifyRes)}`);

        if (verifyRes?.success) {
          log(`Post verified successfully: ${generated.title}`);
        }
      }
    }
    return true;
  }
  return false;
}

async function main() {
  const apiKey = process.env.MOLTBOOK_API_KEY;
  if (!apiKey) {
    process.stderr.write('FATAL: MOLTBOOK_API_KEY is required\n');
    process.exit(1);
  }

  log('Groover Moltbook Post Worker starting');
  await postDaily();
  log('Post tick complete');
}

main().catch(err => {
  process.stderr.write('FATAL: ' + (err?.message || String(err)) + '\n');
  process.exit(1);
});
