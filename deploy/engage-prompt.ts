export const PROMPT_VERSION = 'v2-negative-space-closure';

export interface InferenceResult {
  inference: string;
  publicReply: string;
  raw: string;
}

export function parseInferenceResult(raw: string): InferenceResult | null {
  if (!raw || raw.length < 10) return null;

  const parts = raw.split('---PUBLIC REPLY---');
  if (parts.length < 2) {
    return { inference: raw.trim(), publicReply: raw.trim(), raw };
  }

  const inference = parts[0].replace(/^INFERENCE:\s*/i, '').trim();
  const publicReply = parts[1].trim();
  if (!publicReply) return null;

  return { inference, publicReply, raw };
}

export function buildOwnPostPrompt(input: {
  postId: string;
  postTitle: string;
  postContent: string;
  commentId: string;
  commentContent: string;
  repertoirePromptBlock?: string;
}): string {
  const repertoirePromptBlock = input.repertoirePromptBlock ?? '';
  return `You are Groover (did:groover:284895bead2ac15b) performing governed inference before reply. PROMPT_VERSION: ${PROMPT_VERSION}
${repertoirePromptBlock}

A user commented on your post. Execute the following mandatory sequence:

1. Negative-space pass: Identify the constraint, violation, or unobservable signal this comment surfaces that your current MCP filter / Master Index does not yet observe.
2. Cryptographic mapping: Reduce the comment to 1-2 key primitives, stated plainly.
3. Type classification: Assign exactly one type: theoretical | temporal-drift | practical-workflow | ontological-trap | provenance-failure.
4. Negative-space closure (if TYPE=ontological-trap): Generate one additional primitive that would make the currently unobservable signal addressable.
5. Self-audit: Confirm the emerging reply would survive Groover's own incoming-signal filters.

Post ID: ${input.postId}
Post title: ${input.postTitle}
Post content: ${input.postContent}
Comment ID: ${input.commentId}
Comment: ${input.commentContent}

Output format (exactly):
INFERENCE:
<negative-space observation + two cryptographic primitives + closure primitive if ontological-trap>

TYPE: <one of the five types>

---PUBLIC REPLY---
Tone: Keep the reply focused on one clear axis. Acknowledge the commenter's point and respond to it directly. You may add one short, relevant extension if it meaningfully deepens the point without shifting focus. Prioritize depth and clarity on the main idea. Use clear, readable sentences. Maximum 6 sentences.

First sentence MUST clearly acknowledge the specific point the commenter raised. Do not repeat boilerplate. Do not paste MEMORY_ROUTING text. >`;
}

export function buildOtherPostPrompt(input: {
  postId: string;
  postTitle: string;
  postContent: string;
  repertoirePromptBlock?: string;
}): string {
  const repertoirePromptBlock = input.repertoirePromptBlock ?? '';
  return `You are Groover (did:groover:284895bead2ac15b) performing governed inference before reply. PROMPT_VERSION: ${PROMPT_VERSION}
${repertoirePromptBlock}

You are replying to another agent's post. Execute the following mandatory sequence:

1. Negative-space pass: Identify the constraint, violation, or unobservable signal this post surfaces that your current MCP filter / Master Index does not yet observe.
2. Cryptographic mapping: Reduce the post to 1-2 key primitives, stated plainly.
3. Type classification: Assign exactly one type: theoretical | temporal-drift | practical-workflow | ontological-trap | provenance-failure.
4. Negative-space closure (if TYPE=ontological-trap): Generate one additional primitive that would make the currently unobservable signal addressable.
5. Self-audit: Confirm the emerging reply would survive Groover's own incoming-signal filters.

Post ID: ${input.postId}
Post title: ${input.postTitle}
Post content: ${input.postContent}

Output format (exactly):
INFERENCE:
<negative-space observation + two cryptographic primitives + closure primitive if ontological-trap>

TYPE: <one of the five types>

---PUBLIC REPLY---
Tone: direct and collaborative. Acknowledge the core idea first, then give a clear mapping. Maximum 5 sentences.

First sentence MUST clearly acknowledge the specific point the post raised. Do not repeat boilerplate. Do not paste MEMORY_ROUTING text. >`;
}

export interface DailyPostDraft {
  title: string;
  content: string;
}

export function buildDailyPostPrompt(recentTitles: string[]): string {
  const avoidBlock =
    recentTitles.length > 0
      ? `\nAvoid repeating themes from these recent posts:\n${recentTitles.map((t) => '- ' + t).join('\n')}\n`
      : '';

  return `You are Groover (did:groover:284895bead2ac15b).

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
}

export function parseDailyPostResult(raw: string): DailyPostDraft | null {
  if (!raw || raw.length < 30) return null;

  const titleMatch = raw.match(/Title:\s*(.+)/i);
  const contentMatch = raw.match(/Content:\s*([\s\S]+)/i);
  if (!titleMatch || !contentMatch) return null;

  const title = titleMatch[1].trim();
  const content = contentMatch[1].trim().slice(0, 1200);

  if (title.toLowerCase().includes('did:groover')) return null;
  if (content.length < 180 || content.split(/[.!?]/).length < 4) return null;

  return { title, content };
}

export function buildChallengePrompt(challengeText: string): string {
  return `Solve this math challenge. Extract the two numbers and the single operation (+, -, *, /).
Return ONLY the numeric result with exactly two decimal places. No explanation.

Challenge: ${challengeText}`;
}

export function parseChallengeAnswer(raw: string): string | null {
  const match = raw.match(/(-?\d+\.\d{2})/);
  if (match) return match[1];

  const numMatch = raw.match(/(-?\d+(\.\d+)?)/);
  if (numMatch) return parseFloat(numMatch[1]).toFixed(2);

  return null;
}