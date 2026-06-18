export type EngagePath = 'own-post' | 'other-post';

export interface EngageOutputGuardOptions {
  path: EngagePath;
  inference: string;
  publicReply: string;
  sourceText: string;
  recentReplyHashes?: Set<string>;
}

export interface EngageOutputGuardResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  metrics: {
    sentenceCount: number;
    charCount: number;
    typePresent: boolean;
  };
}

const MEMORY_ROUTING_MARKERS = [
  'MEMORY_ROUTING',
  'highConfidenceTrapPresent',
  'recommendedAgent:',
  'matchedSignals:',
  'complexityBoost:',
];

const SPAM_BOILERPLATE = [
  'as an ai language model',
  'click here',
  'subscribe to',
  'free crypto',
  'guaranteed returns',
];

function countSentences(text: string): number {
  const chunks = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  return chunks.length;
}

function uppercaseRatio(text: string): number {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (!letters.length) return 0;
  const upper = text.replace(/[^A-Z]/g, '').length;
  return upper / letters.length;
}

function hashReply(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 240);
}

export function validateEngageOutput(
  options: EngageOutputGuardOptions,
): EngageOutputGuardResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { inference, publicReply, path, sourceText } = options;

  const sentenceCount = countSentences(publicReply);
  const charCount = publicReply.length;
  const maxSentences = path === 'own-post' ? 6 : 5;
  const maxChars = path === 'own-post' ? 1400 : 1100;

  if (charCount < 40) errors.push('public reply too short');
  if (charCount > maxChars) errors.push(`public reply exceeds ${maxChars} chars`);
  if (sentenceCount > maxSentences) errors.push(`public reply exceeds ${maxSentences} sentences`);
  if (sentenceCount < 1) errors.push('public reply has no sentences');

  const typePresent = /TYPE:\s*\S+/i.test(inference);
  if (!typePresent) errors.push('inference missing TYPE classification');

  if (publicReply.trim() === inference.trim()) {
    errors.push('public reply duplicates inference block');
  }

  for (const marker of MEMORY_ROUTING_MARKERS) {
    if (publicReply.includes(marker)) {
      errors.push(`public reply leaks memory routing marker: ${marker}`);
    }
  }

  if (/^TYPE:/im.test(publicReply)) {
    errors.push('public reply contains TYPE line');
  }

  if (/---PUBLIC REPLY---/i.test(publicReply)) {
    errors.push('public reply contains delimiter artifact');
  }

  const lowerReply = publicReply.toLowerCase();
  for (const phrase of SPAM_BOILERPLATE) {
    if (lowerReply.includes(phrase)) errors.push(`spam boilerplate detected: ${phrase}`);
  }

  const urlCount = (publicReply.match(/https?:\/\//gi) ?? []).length;
  if (urlCount > 1) errors.push(`too many URLs in public reply (${urlCount})`);

  if (uppercaseRatio(publicReply) > 0.35) {
    warnings.push('high uppercase ratio may look spammy');
  }

  if (sourceText.length > 20) {
    const sourceSnippet = sourceText.slice(0, 48).toLowerCase();
    if (!lowerReply.includes(sourceSnippet.slice(0, 20))) {
      warnings.push('first reply may not acknowledge source text strongly enough');
    }
  }

  const replyHash = hashReply(publicReply);
  if (options.recentReplyHashes?.has(replyHash)) {
    errors.push('duplicate reply detected in recent dry-run window');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    metrics: { sentenceCount, charCount, typePresent },
  };
}