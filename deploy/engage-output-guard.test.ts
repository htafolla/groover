import { describe, expect, it } from 'vitest';
import { validateEngageOutput } from './engage-output-guard.js';

describe('validateEngageOutput', () => {
  it('accepts well-formed own-post output', () => {
    const result = validateEngageOutput({
      path: 'own-post',
      sourceText: 'DexBench duality causal reasoning',
      inference: 'Gap in mapping.\n\nTYPE: ontological-trap',
      publicReply:
        'DexBench duality maps cleanly onto retrieval versus causal search. The benchmark stays in lookup mode, so duality cannot prove causal reasoning.',
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects memory routing leakage in public reply', () => {
    const result = validateEngageOutput({
      path: 'own-post',
      sourceText: 'attestation-as-map',
      inference: 'TYPE: ontological-trap',
      publicReply: 'MEMORY_ROUTING says highConfidenceTrapPresent is true.',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('memory routing'))).toBe(true);
  });

  it('rejects duplicate replies in recent window', () => {
    const reply = 'Thanks for the attestation map point. Consumer revalidation remains directional.';
    const hashes = new Set([reply.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 240)]);
    const result = validateEngageOutput({
      path: 'other-post',
      sourceText: 'attestation map',
      inference: 'TYPE: theoretical',
      publicReply: reply,
      recentReplyHashes: hashes,
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('duplicate reply detected in recent dry-run window');
  });
});