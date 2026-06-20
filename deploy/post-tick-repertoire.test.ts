import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIBLING_REPERTOIRE_ROOT = join(__dirname, '..', '..', 'repertoire');
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  resetPostTickCache,
  runPostTickIngest,
  runPostTickRepertoire,
} from './post-tick-repertoire.js';
import {
  applyRepertoireTestSandbox,
  clearRepertoireTestEnv,
  createRepertoireTestSandbox,
  type RepertoireTestSandbox,
} from './repertoire-test-isolation.js';

const BASE_INPUT = {
  taskId: 'test-post-tick',
  memorySignals: ['attestation-as-map'],
  dynamoRecommendation: 'PASS' as const,
  resonanceScore: 0.9,
  posted: true,
  durationMs: 1200,
};

let sandbox: RepertoireTestSandbox | null = null;
const repertoireAvailable = existsSync(join(SIBLING_REPERTOIRE_ROOT, 'dist/index.js'));

beforeEach(() => {
  if (!repertoireAvailable) return;
  sandbox = createRepertoireTestSandbox(SIBLING_REPERTOIRE_ROOT);
  applyRepertoireTestSandbox(SIBLING_REPERTOIRE_ROOT, sandbox);
  resetPostTickCache();
});

afterEach(() => {
  resetPostTickCache();
  delete process.env.SKIP_REPERTOIRE_FEEDBACK;
  delete process.env.SKIP_REPERTOIRE_INGEST;
  delete process.env.REPERTOIRE_INGEST_SOURCE;
  clearRepertoireTestEnv();
  sandbox?.cleanup();
  sandbox = null;
});

describe('runPostTickRepertoire', () => {
  it('skips when SKIP_REPERTOIRE_FEEDBACK is set', async () => {
    process.env.SKIP_REPERTOIRE_FEEDBACK = '1';
    const result = await runPostTickRepertoire(BASE_INPUT);
    expect(result).toEqual({ ok: true, skipped: 'SKIP_REPERTOIRE_FEEDBACK' });
  });

  it('skips when no memory signals', async () => {
    const result = await runPostTickRepertoire({
      ...BASE_INPUT,
      memorySignals: [],
    });
    expect(result).toEqual({ ok: true, skipped: 'no-memory-signals' });
  });

  it('ingests feedback when repertoire provider is available', async () => {
    if (!repertoireAvailable || !sandbox) return;

    const productionSignals = join(
      SIBLING_REPERTOIRE_ROOT,
      'research/repertoire-brain/curated_signals.json',
    );
    const productionBefore = readFileSync(productionSignals, 'utf8');
    const result = await runPostTickRepertoire(BASE_INPUT);
    if (result.skipped === 'repertoire-provider-unavailable') {
      expect(result.ok).toBe(false);
      return;
    }
    expect(result.ok).toBe(true);
    expect(result.skipped).toBeUndefined();
    expect(readFileSync(productionSignals, 'utf8')).toBe(productionBefore);
  });

  it('marks success false when post blocked but high resonance', async () => {
    if (!repertoireAvailable) return;
    const result = await runPostTickRepertoire({
      ...BASE_INPUT,
      posted: false,
      dynamoRecommendation: 'REJECT',
      resonanceScore: 0.9,
    });
    if (result.skipped === 'repertoire-provider-unavailable') return;
    expect(result.ok).toBe(true);
  });
});

describe('runPostTickIngest', () => {
  it('skips when SKIP_REPERTOIRE_INGEST is set', async () => {
    process.env.SKIP_REPERTOIRE_INGEST = '1';
    const result = await runPostTickIngest('/tmp/any');
    expect(result).toEqual({ ok: true, skipped: 'SKIP_REPERTOIRE_INGEST' });
  });

  it('skips when no source directory is provided', async () => {
    const result = await runPostTickIngest();
    expect(result).toEqual({ ok: true, skipped: 'no-ingest-source' });
  });

  it('imports enriched JSONL idempotently when repertoire is available', async () => {
    if (!repertoireAvailable || !sandbox) return;

    const sourceDir = join(sandbox.root, 'source');
    mkdirSync(sourceDir, { recursive: true });

    const uniqueId = `comment-a31-${Date.now()}`;
    const enrichedLine = JSON.stringify({
      timestamp: '2026-06-18T12:00:00.000Z',
      source: 'groover-test',
      post_id: 'post-a31',
      comment_id: uniqueId,
      inference:
        'TYPE: ontological-trap attestation-as-map consumer-boundary revalidation required',
      public_reply: 'Test reply for A3.1 ingest.',
      matched_primitives: ['attestation-as-map'],
      match_confidence: { 'attestation-as-map': 0.92 },
      repertoire_signals: ['attestation-as-map'],
      governance_forced: true,
      dynamo_result: { result: { recommendation: 'PASS', resonanceScore: 0.9 }, matchedPrimitives: [] },
    });

    writeFileSync(join(sourceDir, '2026-06-18.jsonl'), `${enrichedLine}\n`);

    const first = await runPostTickIngest(sourceDir);
    if (first.skipped === 'repertoire-service-unavailable') return;

    expect(first.ok).toBe(true);
    expect(first.imported).toBe(1);

    const targetFile = join(sandbox.logDir, '2026-06-18.jsonl');
    const beforeLines = readFileSync(targetFile, 'utf8').trim().split('\n').length;

    const second = await runPostTickIngest(sourceDir);
    expect(second.ok).toBe(true);
    expect(second.imported).toBe(0);

    const afterLines = readFileSync(targetFile, 'utf8').trim().split('\n').length;
    expect(afterLines).toBe(beforeLines);

    const productionLog = join(
      SIBLING_REPERTOIRE_ROOT,
      'logs/groover-inference/2026-06-18.jsonl',
    );
    if (existsSync(productionLog)) {
      expect(readFileSync(productionLog, 'utf8')).not.toContain(uniqueId);
    }
  });
});