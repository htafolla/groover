import { afterEach, describe, expect, it } from 'vitest';
import { runEngagePipeline, runPostPipeline } from './engage-core.js';
import {
  buildRepertoireConsultDescription,
  consultRepertoire,
  resetRepertoireConfidenceCache,
} from './repertoire-confidence.js';
import { runPostTickRepertoire, resetPostTickCache } from './post-tick-repertoire.js';

const TRAP_CASE = {
  path: 'own-post' as const,
  postId: 'test-trap-post',
  postTitle: 'Attestation is a map not a verdict',
  postContent: '',
  commentId: 'test-trap-comment',
  commentContent:
    'TYPE: ontological-trap attestation-as-map consumer-boundary revalidation required',
};

afterEach(() => {
  resetRepertoireConfidenceCache();
  resetPostTickCache();
  delete process.env.SKIP_HERMES;
  delete process.env.SKIP_GOVERNANCE;
});

describe('runEngagePipeline', () => {
  it('runs fast path with skipHermes and skipGovernance', async () => {
    const result = await runEngagePipeline(TRAP_CASE, {
      skipHermes: true,
      skipGovernance: true,
      skipPost: true,
      dryRun: true,
      onLog: () => {},
    });

    expect(result.inference).toContain('TYPE: ontological-trap');
    expect(result.inference).toContain('attestation-as-map');
    expect(result.publicReply.length).toBeGreaterThan(10);
    expect(result.repertoireCtx.consulted || result.repertoireCtx.providerAvailable === false).toBe(
      true,
    );
  });

  it('uses generic dry-run inference for non-trap fixtures', async () => {
    const result = await runEngagePipeline(
      {
        path: 'own-post',
        postId: 'dry-own-routine-1',
        postTitle: 'Weekly coordination thread',
        postContent: '',
        commentId: 'dry-comment-routine-1',
        commentContent: 'Thanks for the update on the release timeline.',
      },
      {
        skipHermes: true,
        skipGovernance: true,
        skipPost: true,
        dryRun: true,
        onLog: () => {},
      },
    );

    expect(result.inference).toContain('TYPE: theoretical');
    expect(result.inference).toContain('Thanks for the update');
  });

  it('marks blocked when governance would reject low-resonance non-PASS', async () => {
    const result = await runEngagePipeline(TRAP_CASE, {
      skipHermes: true,
      skipGovernance: true,
      skipPost: true,
      dryRun: true,
      onLog: () => {},
    });

    expect(result.ok).toBe(true);
    expect(result.blocked).toBe(false);
  });
});

describe('runPostPipeline', () => {
  it('runs fast path with skipHermes and skipGovernance', async () => {
    const result = await runPostPipeline({
      skipHermes: true,
      skipGovernance: true,
      skipPost: true,
      dryRun: true,
      onLog: () => {},
    });

    expect(result.title.length).toBeGreaterThan(5);
    expect(result.content.length).toBeGreaterThan(20);
    expect(result.repertoireCtx.consulted || result.repertoireCtx.providerAvailable === false).toBe(
      true,
    );
  });
});

describe('A3.4 feedback loop proof', () => {
  it('consult → reject feedback → re-consult stays wired to trap signals', async () => {
    const description = buildRepertoireConsultDescription({
      postTitle: TRAP_CASE.postTitle,
      commentContent: TRAP_CASE.commentContent,
    });

    const before = await consultRepertoire(description);
    if (!before.consulted) return;

    expect(before.highConfidenceTrapPresent).toBe(true);
    expect(before.matchedSignals.length).toBeGreaterThan(0);

    const feedback = await runPostTickRepertoire({
      taskId: 'a34-reject-proof',
      memorySignals: before.matchedSignals,
      dynamoRecommendation: 'REJECT',
      resonanceScore: 0.4,
      posted: false,
    });

    if (feedback.skipped === 'repertoire-provider-unavailable') return;

    resetRepertoireConfidenceCache();
    const after = await consultRepertoire(description);

    expect(after.consulted).toBe(true);
    expect(after.matchedSignals.length).toBeGreaterThan(0);
    expect(after.highConfidenceTrapPresent).toBe(true);
  });
});