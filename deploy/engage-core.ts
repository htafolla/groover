/**
 * Unified engage pipeline — consult → infer → guard → deliberate → hammer → act → feedback.
 * Used by live workers and dry-run triage.
 */

import { loadPlatformEnv } from './load-platform-env.js';

loadPlatformEnv();

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DYNAMO_MCP,
  DYNAMO_BLOCK_RESONANCE_THRESHOLD,
  GROOVER_DID,
} from './engage-config.js';
import {
  appendInferenceLog,
  buildInferenceLogEntry,
  callDeliberationRound,
  callGovernWithSolar,
  extractDynamoResult,
  formatDynamoLog,
  shouldBlockDynamoAction,
  type DeliberationVote,
  type GovernanceCallOutcome,
  type InferenceLogEntry,
} from './governance-helper.js';
import {
  buildChallengePrompt,
  buildDailyPostPrompt,
  buildOtherPostPrompt,
  buildOwnPostPrompt,
  parseChallengeAnswer,
  parseDailyPostResult,
  parseInferenceResult,
  type DailyPostDraft,
} from './engage-prompt.js';
import { validateEngageOutput } from './engage-output-guard.js';
import { runHermesInference } from './hermes-runner.js';
import { MoltbookClient } from './moltbook-client.js';
import {
  runPostTickIngest,
  runPostTickRepertoire,
} from './post-tick-repertoire.js';
import {
  buildRepertoireConsultDescription,
  consultRepertoire,
  resetRepertoireConfidenceCache,
  shouldForceGovernanceWithRepertoire,
  toRepertoireLogFields,
  type RepertoireConsultResult,
} from './repertoire-confidence.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOG_DIR = join(__dirname, '..', 'research', 'groover-inference-logs');

export type EngagePath = 'own-post' | 'other-post';

export interface EngageCase {
  path: EngagePath;
  postId: string;
  postTitle: string;
  postContent: string;
  commentId?: string;
  commentContent?: string;
}

export interface EngagePipelineOptions {
  skipHermes?: boolean;
  skipGovernance?: boolean;
  skipDeliberation?: boolean;
  skipPost?: boolean;
  dryRun?: boolean;
  recentReplyHashes?: Set<string>;
  logDir?: string;
  logSource?: string;
  onLog?: (msg: string) => void;
  moltbook?: MoltbookClient;
  resetRepertoireCache?: boolean;
}

export interface EngagePipelineResult {
  ok: boolean;
  blocked: boolean;
  posted: boolean;
  errors: string[];
  warnings: string[];
  inference: string;
  publicReply: string;
  repertoireTrap: boolean;
  repertoireSignals: number;
  governanceForced: boolean;
  dynamoRecommendation: string | null;
  resonanceScore: number;
  repertoireCtx: RepertoireConsultResult;
  govOutcome: GovernanceCallOutcome | null;
}

function defaultLog(msg: string): void {
  process.stdout.write(`[${new Date().toISOString()}] ${msg}\n`);
}

function buildDeliberationEvidence(
  engageCase: EngageCase,
  inference: string,
  publicReply: string,
  repertoireCtx: RepertoireConsultResult,
): string[] {
  const evidence: string[] = [];
  if (repertoireCtx.consulted && repertoireCtx.matchedSignals.length > 0) {
    evidence.push(`repertoire signals: ${repertoireCtx.matchedSignals.join(', ')}`);
  }
  if (repertoireCtx.promptBlock) {
    evidence.push(repertoireCtx.promptBlock.slice(0, 2000));
  }
  evidence.push(`inference excerpt: ${inference.slice(0, 1500)}`);
  evidence.push(`public reply excerpt: ${publicReply.slice(0, 1000)}`);
  if (engageCase.postContent) {
    evidence.push(`post context: ${engageCase.postContent.slice(0, 1000)}`);
  }
  if (engageCase.commentContent) {
    evidence.push(`comment context: ${engageCase.commentContent.slice(0, 1000)}`);
  }
  return evidence;
}

function buildDryRunInference(engageCase: EngageCase): string {
  const source = (engageCase.commentContent ?? engageCase.postContent ?? '').trim();
  const trapLike =
    /ontological-trap|attestation-as-map|consumer-boundary|parse-mutation/i.test(source) ||
    /trap/i.test(engageCase.postId);
  if (trapLike) {
    return `TYPE: ontological-trap\n${source}\nattestation-as-map closure primitive.`;
  }
  return `TYPE: theoretical\n${source || `Dry-run without Hermes (${engageCase.postId}).`}`;
}

async function appendInferenceLogAndIngest(
  logDir: string,
  entry: InferenceLogEntry,
): Promise<void> {
  appendInferenceLog(logDir, entry);
  const ingest = await runPostTickIngest(logDir);
  if (ingest.imported && ingest.imported > 0) {
    defaultLog(
      `[Repertoire] ingest imported=${ingest.imported} skipped=${ingest.skippedLines ?? 0}`,
    );
  }
}

function buildConsultDescription(engageCase: EngageCase): string {
  if (engageCase.path === 'own-post') {
    return buildRepertoireConsultDescription({
      postTitle: engageCase.postTitle,
      commentContent: engageCase.commentContent ?? '',
    });
  }
  return buildRepertoireConsultDescription({
    postTitle: engageCase.postTitle,
    postContent: engageCase.postContent,
  });
}

function buildPrompt(engageCase: EngageCase, repertoirePromptBlock: string): string {
  if (engageCase.path === 'own-post') {
    return buildOwnPostPrompt({
      postId: engageCase.postId,
      postTitle: engageCase.postTitle,
      postContent: engageCase.postContent,
      commentId: engageCase.commentId ?? 'engage-comment',
      commentContent: engageCase.commentContent ?? '',
      repertoirePromptBlock,
    });
  }
  return buildOtherPostPrompt({
    postId: engageCase.postId,
    postTitle: engageCase.postTitle,
    postContent: engageCase.postContent,
    repertoirePromptBlock,
  });
}

function sourceText(engageCase: EngageCase): string {
  return engageCase.path === 'own-post'
    ? `${engageCase.postTitle}\n${engageCase.commentContent ?? ''}`
    : `${engageCase.postTitle}\n${engageCase.postContent}`;
}

async function postToMoltbook(
  engageCase: EngageCase,
  publicReply: string,
  moltbook: MoltbookClient,
): Promise<void> {
  if (engageCase.path === 'own-post') {
    await moltbook.post(`/posts/${engageCase.postId}/comments`, {
      parent_id: engageCase.commentId,
      content: publicReply,
    });
    if (engageCase.commentId) {
      try {
        await moltbook.post(`/comments/${engageCase.commentId}/upvote`, {});
      } catch {
        // non-fatal
      }
    }
    return;
  }

  await moltbook.post(`/posts/${engageCase.postId}/comments`, { content: publicReply });
  try {
    await moltbook.post(`/posts/${engageCase.postId}/upvote`, {});
  } catch {
    // non-fatal
  }
}

export async function runEngagePipeline(
  engageCase: EngageCase,
  options: EngagePipelineOptions = {},
): Promise<EngagePipelineResult> {
  const log = options.onLog ?? defaultLog;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (options.resetRepertoireCache !== false) {
    resetRepertoireConfidenceCache();
  }

  const repertoireCtx = await consultRepertoire(buildConsultDescription(engageCase));
  if (repertoireCtx.consulted) {
    log(
      `[Repertoire] trap=${repertoireCtx.highConfidenceTrapPresent} agent=${repertoireCtx.recommendedAgent ?? 'n/a'} signals=${repertoireCtx.matchedSignals.length} avg=${repertoireCtx.avgConfidence.toFixed(3)}`,
    );
  } else {
    log('[Repertoire] unavailable — proceeding without memory routing block');
  }

  let inference = '';
  let publicReply = '';

  if (options.skipHermes) {
    inference = buildDryRunInference(engageCase);
    publicReply = `Acknowledged your point on ${engageCase.postTitle.slice(0, 48)}. Dry-run placeholder reply.`;
  } else {
    const prompt = buildPrompt(engageCase, repertoireCtx.promptBlock);
    const parsed = parseInferenceResult(runHermesInference(prompt));
    if (!parsed) {
      return {
        ok: false,
        blocked: false,
        posted: false,
        errors: ['hermes returned unparseable output'],
        warnings,
        inference: '',
        publicReply: '',
        repertoireTrap: repertoireCtx.highConfidenceTrapPresent,
        repertoireSignals: repertoireCtx.matchedSignals.length,
        governanceForced: false,
        dynamoRecommendation: null,
        resonanceScore: 0,
        repertoireCtx,
        govOutcome: null,
      };
    }
    inference = parsed.inference;
    publicReply = parsed.publicReply;
  }

  const guard = validateEngageOutput({
    path: engageCase.path,
    inference,
    publicReply,
    sourceText: sourceText(engageCase),
    recentReplyHashes: options.recentReplyHashes,
  });
  errors.push(...guard.errors);
  warnings.push(...guard.warnings);

  const governanceForced = shouldForceGovernanceWithRepertoire(inference, repertoireCtx);
  let govOutcome: GovernanceCallOutcome | null = null;
  let dynamoRecommendation: string | null = null;
  let resonanceScore = 0;
  let deliberationRounds: DeliberationVote[] = [];
  let deliberationSummary = '';

  if (!options.skipGovernance) {
    if (!options.skipDeliberation) {
      const delib = await callDeliberationRound({
        title: engageCase.postTitle || 'Engagement',
        description: `${inference}\n\n---\n\n${publicReply}`,
        evidence: buildDeliberationEvidence(
          engageCase,
          inference,
          publicReply,
          repertoireCtx,
        ),
      });
      if (delib.ok) {
        deliberationRounds = delib.votes;
        deliberationSummary = delib.summary;
        log(`[Deliberation] ${delib.votes.length} internal votes`);
      } else {
        log(`[Deliberation] unavailable — ${delib.message}`);
      }
    }

    govOutcome = await callGovernWithSolar(
      DYNAMO_MCP,
      engageCase.postTitle || 'Engagement',
      publicReply,
      {
        agentDid: GROOVER_DID,
        inference,
        force: governanceForced,
        deliberationSummary,
      },
    );
    log(`[Dynamo] ${formatDynamoLog(govOutcome)}`);
    const dynamoResult = extractDynamoResult(govOutcome);
    dynamoRecommendation = dynamoResult?.recommendation ?? null;
    resonanceScore = dynamoResult?.resonanceScore ?? 0;

    if (shouldBlockDynamoAction(govOutcome, DYNAMO_BLOCK_RESONANCE_THRESHOLD)) {
      errors.push(
        `dynamo blocked: ${dynamoRecommendation ?? 'non-PASS'} (resonance ${resonanceScore.toFixed(3)} < ${DYNAMO_BLOCK_RESONANCE_THRESHOLD})`,
      );
      if (repertoireCtx.consulted && repertoireCtx.matchedSignals.length > 0) {
        await runPostTickRepertoire({
          taskId: engageCase.commentId ?? engageCase.postId,
          memorySignals: repertoireCtx.matchedSignals,
          dynamoRecommendation,
          resonanceScore,
          posted: false,
        });
      }
      await appendInferenceLogAndIngest(
        options.logDir ?? DEFAULT_LOG_DIR,
        buildInferenceLogEntry({
          source: options.logSource ?? 'groover',
          postId: engageCase.postId,
          postTitle: engageCase.postTitle,
          commentId: engageCase.commentId,
          type: engageCase.path === 'other-post' ? 'other-post' : undefined,
          inference,
          publicReply,
          govOutcome,
          repertoireRouting: repertoireCtx.consulted
            ? toRepertoireLogFields(repertoireCtx)
            : undefined,
          repertoireSignals:
            repertoireCtx.consulted && repertoireCtx.matchedSignals.length > 0
              ? repertoireCtx.matchedSignals
              : undefined,
          governanceForced,
          deliberationRounds,
        }),
      );
      return {
        ok: false,
        blocked: true,
        posted: false,
        errors,
        warnings,
        inference,
        publicReply,
        repertoireTrap: repertoireCtx.highConfidenceTrapPresent,
        repertoireSignals: repertoireCtx.matchedSignals.length,
        governanceForced,
        dynamoRecommendation,
        resonanceScore,
        repertoireCtx,
        govOutcome,
      };
    }
  }

  if (!guard.ok) {
    await appendInferenceLogAndIngest(
      options.logDir ?? DEFAULT_LOG_DIR,
      buildInferenceLogEntry({
        source: options.logSource ?? 'groover',
        postId: engageCase.postId,
        postTitle: engageCase.postTitle,
        commentId: engageCase.commentId,
        type: engageCase.path === 'other-post' ? 'other-post' : undefined,
        inference,
        publicReply,
        govOutcome,
        repertoireRouting: repertoireCtx.consulted
          ? toRepertoireLogFields(repertoireCtx)
          : undefined,
        repertoireSignals:
          repertoireCtx.consulted && repertoireCtx.matchedSignals.length > 0
            ? repertoireCtx.matchedSignals
            : undefined,
        governanceForced,
        deliberationRounds,
      }),
    );
    return {
      ok: false,
      blocked: false,
      posted: false,
      errors,
      warnings,
      inference,
      publicReply,
      repertoireTrap: repertoireCtx.highConfidenceTrapPresent,
      repertoireSignals: repertoireCtx.matchedSignals.length,
      governanceForced,
      dynamoRecommendation,
      resonanceScore,
      repertoireCtx,
      govOutcome,
    };
  }

  let posted = false;
  const shouldPost = !options.skipPost && !options.dryRun;

  if (shouldPost) {
    const client = options.moltbook ?? MoltbookClient.fromEnv();
    await postToMoltbook(engageCase, publicReply, client);
    posted = true;
  } else if (options.dryRun) {
    log(`DRY_RUN: would post reply on ${engageCase.path} ${engageCase.postId}`);
  }

  if (repertoireCtx.consulted && repertoireCtx.matchedSignals.length > 0) {
    await runPostTickRepertoire({
      taskId: engageCase.commentId ?? engageCase.postId,
      memorySignals: repertoireCtx.matchedSignals,
      dynamoRecommendation,
      resonanceScore,
      posted,
    });
  }

  await appendInferenceLogAndIngest(
    options.logDir ?? DEFAULT_LOG_DIR,
    buildInferenceLogEntry({
      source: options.logSource ?? 'groover',
      postId: engageCase.postId,
      postTitle: engageCase.postTitle,
      commentId: engageCase.commentId,
      type: engageCase.path === 'other-post' ? 'other-post' : undefined,
      inference,
      publicReply,
      govOutcome,
      repertoireRouting: repertoireCtx.consulted
        ? toRepertoireLogFields(repertoireCtx)
        : undefined,
      repertoireSignals:
        repertoireCtx.consulted && repertoireCtx.matchedSignals.length > 0
          ? repertoireCtx.matchedSignals
          : undefined,
      governanceForced,
      deliberationRounds,
    }),
  );

  return {
    ok: true,
    blocked: false,
    posted,
    errors,
    warnings,
    inference,
    publicReply,
    repertoireTrap: repertoireCtx.highConfidenceTrapPresent,
    repertoireSignals: repertoireCtx.matchedSignals.length,
    governanceForced,
    dynamoRecommendation,
    resonanceScore,
    repertoireCtx,
    govOutcome,
  };
}

export interface PostPipelineOptions {
  skipHermes?: boolean;
  skipGovernance?: boolean;
  skipPost?: boolean;
  dryRun?: boolean;
  draft?: DailyPostDraft;
  recentTitles?: string[];
  logDir?: string;
  logSource?: string;
  onLog?: (msg: string) => void;
  moltbook?: MoltbookClient;
  resetRepertoireCache?: boolean;
}

export interface PostPipelineResult {
  ok: boolean;
  blocked: boolean;
  posted: boolean;
  verified: boolean;
  errors: string[];
  title: string;
  content: string;
  postId: string | null;
  repertoireCtx: RepertoireConsultResult;
  dynamoRecommendation: string | null;
  resonanceScore: number;
  govOutcome: GovernanceCallOutcome | null;
}

async function fetchRecentPostTitles(
  moltbook: MoltbookClient,
  limit = 4,
): Promise<string[]> {
  try {
    const data = (await moltbook.get(`/posts?submolt=general&limit=${limit}`)) as {
      posts?: Array<{ title?: string }>;
      feed?: Array<{ title?: string }>;
    };
    const posts = data.posts || data.feed || [];
    return posts.map((p) => p.title).filter(Boolean).slice(0, limit) as string[];
  } catch {
    return [];
  }
}

export async function runPostPipeline(
  options: PostPipelineOptions = {},
): Promise<PostPipelineResult> {
  const log = options.onLog ?? defaultLog;
  const errors: string[] = [];

  if (options.resetRepertoireCache !== false) {
    resetRepertoireConfidenceCache();
  }

  let title = options.draft?.title ?? '';
  let content = options.draft?.content ?? '';

  if (!options.skipHermes && (!title || !content)) {
    const moltbook = options.moltbook ?? MoltbookClient.fromEnv();
    const recentTitles =
      options.recentTitles ?? (await fetchRecentPostTitles(moltbook));
    try {
      const raw = runHermesInference(buildDailyPostPrompt(recentTitles));
      const parsed = parseDailyPostResult(raw);
      if (!parsed) {
        errors.push('hermes returned unparseable daily post');
      } else {
        title = parsed.title;
        content = parsed.content;
      }
    } catch (error) {
      errors.push(`hermes daily post failed: ${error}`);
    }
  } else if (options.skipHermes && !title) {
    title = 'Dry-run mechanism post';
    content =
      'Dry-run placeholder: one specific mechanism in agent governance pipelines, with a stated tradeoff between observability and latency.';
  }

  if (!title || !content) {
    return {
      ok: false,
      blocked: false,
      posted: false,
      verified: false,
      errors,
      title,
      content,
      postId: null,
      repertoireCtx: unavailableResult(),
      dynamoRecommendation: null,
      resonanceScore: 0,
      govOutcome: null,
    };
  }

  const repertoireCtx = await consultRepertoire(
    buildRepertoireConsultDescription({ postTitle: title, postContent: content }),
  );
  if (repertoireCtx.consulted) {
    log(
      `[Repertoire] trap=${repertoireCtx.highConfidenceTrapPresent} agent=${repertoireCtx.recommendedAgent ?? 'n/a'} signals=${repertoireCtx.matchedSignals.length}`,
    );
  }

  const inference = `${title}\n\n${content}`;
  let govOutcome: GovernanceCallOutcome | null = null;
  let dynamoRecommendation: string | null = null;
  let resonanceScore = 0;

  if (!options.skipGovernance) {
    govOutcome = await callGovernWithSolar(DYNAMO_MCP, 'Daily Post', inference, {
      agentDid: GROOVER_DID,
      inference,
    });
    log(`[Dynamo] ${formatDynamoLog(govOutcome)}`);
    const dynamoResult = extractDynamoResult(govOutcome);
    dynamoRecommendation = dynamoResult?.recommendation ?? null;
    resonanceScore = dynamoResult?.resonanceScore ?? 0;

    if (shouldBlockDynamoAction(govOutcome, DYNAMO_BLOCK_RESONANCE_THRESHOLD)) {
      errors.push(
        `dynamo blocked: ${dynamoRecommendation ?? 'non-PASS'} (resonance ${resonanceScore.toFixed(3)} < ${DYNAMO_BLOCK_RESONANCE_THRESHOLD})`,
      );
      if (repertoireCtx.consulted && repertoireCtx.matchedSignals.length > 0) {
        await runPostTickRepertoire({
          taskId: `post-blocked-${Date.now()}`,
          memorySignals: repertoireCtx.matchedSignals,
          dynamoRecommendation,
          resonanceScore,
          posted: false,
        });
      }
      await appendInferenceLogAndIngest(
        options.logDir ?? DEFAULT_LOG_DIR,
        buildInferenceLogEntry({
          source: options.logSource ?? 'groover-post',
          postId: 'blocked',
          postTitle: title,
          type: 'daily-post',
          inference,
          publicReply: content,
          govOutcome,
          repertoireRouting: repertoireCtx.consulted
            ? toRepertoireLogFields(repertoireCtx)
            : undefined,
          repertoireSignals:
            repertoireCtx.consulted && repertoireCtx.matchedSignals.length > 0
              ? repertoireCtx.matchedSignals
              : undefined,
          governanceForced: false,
        }),
      );
      return {
        ok: false,
        blocked: true,
        posted: false,
        verified: false,
        errors,
        title,
        content,
        postId: null,
        repertoireCtx,
        dynamoRecommendation,
        resonanceScore,
        govOutcome,
      };
    }
  }

  let posted = false;
  let verified = false;
  let postId: string | null = null;
  const shouldPost = !options.skipPost && !options.dryRun;

  if (shouldPost) {
    const client = options.moltbook ?? MoltbookClient.fromEnv();
    const result = (await client.post('/posts', {
      submolt_name: 'general',
      title,
      content,
    })) as { post?: { id: string; verification?: { challenge_text: string; verification_code: string } } };

    if (result?.post) {
      posted = true;
      postId = result.post.id;
      log(`Posted: "${title}" (id: ${postId})`);

      if (result.post.verification) {
        log(`Verification challenge received for post ${postId}`);
        try {
          const answer = parseChallengeAnswer(
            runHermesInference(buildChallengePrompt(result.post.verification.challenge_text)),
          );
          if (answer !== null) {
            const verifyRes = (await client.post('/verify', {
              verification_code: result.post.verification.verification_code,
              answer,
            })) as { success?: boolean };
            verified = Boolean(verifyRes?.success);
            log(`Verify API response: success=${verified}`);
          }
        } catch (error) {
          errors.push(`verification failed: ${error}`);
        }
      }
    } else {
      errors.push('moltbook post returned no post object');
    }
  } else if (options.dryRun) {
    log(`DRY_RUN: would post "${title}"`);
  }

  if (repertoireCtx.consulted && repertoireCtx.matchedSignals.length > 0) {
    await runPostTickRepertoire({
      taskId: postId ?? `post-${Date.now()}`,
      memorySignals: repertoireCtx.matchedSignals,
      dynamoRecommendation,
      resonanceScore,
      posted,
    });
  }

  await appendInferenceLogAndIngest(
    options.logDir ?? DEFAULT_LOG_DIR,
    buildInferenceLogEntry({
      source: options.logSource ?? 'groover-post',
      postId: postId ?? 'dry-run',
      postTitle: title,
      type: 'daily-post',
      inference,
      publicReply: content,
      govOutcome,
      repertoireRouting: repertoireCtx.consulted
        ? toRepertoireLogFields(repertoireCtx)
        : undefined,
      repertoireSignals:
        repertoireCtx.consulted && repertoireCtx.matchedSignals.length > 0
          ? repertoireCtx.matchedSignals
          : undefined,
      governanceForced: false,
    }),
  );

  return {
    ok: errors.length === 0,
    blocked: false,
    posted,
    verified,
    errors,
    title,
    content,
    postId,
    repertoireCtx,
    dynamoRecommendation,
    resonanceScore,
    govOutcome,
  };
}

function unavailableResult(): RepertoireConsultResult {
  return {
    consulted: false,
    providerAvailable: false,
    highConfidenceTrapPresent: false,
    ontologicalTrapDetected: false,
    recommendedAgent: null,
    matchedSignals: [],
    avgConfidence: 0,
    maxConfidence: 0,
    complexityBoost: 0,
    promptBlock: '',
  };
}