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