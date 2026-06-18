/**
 * Unified engage pipeline — consult → infer → guard → govern → act → feedback.
 * Used by live workers and dry-run triage.
 */

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
  callGovernWithSolar,
  extractDynamoResult,
  formatDynamoLog,
  shouldBlockDynamoAction,
  type GovernanceCallOutcome,
} from './governance-helper.js';
import {
  buildOtherPostPrompt,
  buildOwnPostPrompt,
  parseInferenceResult,
} from './engage-prompt.js';
import { validateEngageOutput } from './engage-output-guard.js';
import { runHermesInference } from './hermes-runner.js';
import { MoltbookClient } from './moltbook-client.js';
import { runPostTickRepertoire } from './post-tick-repertoire.js';
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
    inference = `TYPE: theoretical\nDry-run without Hermes (${engageCase.postId}).`;
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

  if (!options.skipGovernance) {
    govOutcome = await callGovernWithSolar(
      DYNAMO_MCP,
      engageCase.postTitle || 'Engagement',
      publicReply,
      {
        agentDid: GROOVER_DID,
        inference,
        force: governanceForced,
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
      appendInferenceLog(
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
    appendInferenceLog(
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

  appendInferenceLog(
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