/**
 * R-02: Scheduled Repertoire enrichment for Groover production.
 * Ingest enriched JSONL → promote → meta-inference → prune → brain SSOT.
 *
 * Cron: groover-meta-inference (every 180m) via hermes-cron.manifest.json
 *
 * Usage:
 *   DRY_RUN=true npx tsx deploy/repertoire-enrichment.ts
 *   npx tsx deploy/repertoire-enrichment.ts --commit
 */

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { loadPlatformEnv } from './load-platform-env.js';
import {
  defaultIngestSourceDir,
  repertoireServicePaths,
} from './repertoire-service-config.js';

loadPlatformEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const GROOVER_ROOT = join(__dirname, '..');
const require = createRequire(import.meta.url);

const SIBLING_REPERTOIRE_ROOT = join(GROOVER_ROOT, '..', 'repertoire');
const LOCAL_NODE_MODULES_ROOT = join(GROOVER_ROOT, 'node_modules', '@0xray', 'repertoire');

function providerExistsAt(root: string): boolean {
  return existsSync(join(root, 'dist/index.js'));
}

function resolveRepertoireRoot(): string | null {
  if (process.env.REPERTOIRE_ROOT && providerExistsAt(process.env.REPERTOIRE_ROOT)) {
    return process.env.REPERTOIRE_ROOT;
  }
  for (const candidate of [SIBLING_REPERTOIRE_ROOT, LOCAL_NODE_MODULES_ROOT]) {
    if (providerExistsAt(candidate)) return candidate;
  }
  try {
    const pkgJson = require.resolve('@0xray/repertoire/package.json');
    const root = dirname(pkgJson);
    if (providerExistsAt(root)) return root;
  } catch {
    // not installed
  }
  return null;
}

function log(msg: string): void {
  process.stdout.write(`[${new Date().toISOString()}] ${msg}\n`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun =
    process.env.DRY_RUN === 'true' || argv.includes('--dry-run');
  const commit = argv.includes('--commit') || (!dryRun && !argv.includes('--dry-run'));
  const skipMeta =
    process.env.SKIP_META_INFERENCE === '1' || argv.includes('--skip-meta-inference');
  const skipPrune = process.env.SKIP_PRUNE === '1' || argv.includes('--skip-prune');

  if (!dryRun && !commit) {
    process.stderr.write(
      'Usage: npx tsx deploy/repertoire-enrichment.ts [--dry-run|--commit]\n',
    );
    process.exit(1);
  }

  const repertoireRoot = resolveRepertoireRoot();
  if (!repertoireRoot) {
    process.stderr.write('FATAL: @0xray/repertoire not found\n');
    process.exit(1);
  }

  const mod = await import(pathToFileURL(join(repertoireRoot, 'dist/index.js')).href);
  const paths = repertoireServicePaths(GROOVER_ROOT);
  const ingestSource = defaultIngestSourceDir(GROOVER_ROOT);

  const manager = new mod.CuratedSignalsManager(paths.signalsPath);
  const before = manager.load();
  const beforeCount = before.signals.length;

  const service = new mod.RepertoireService({
    dataDir: paths.dataDir,
    signalsPath: paths.signalsPath,
    logDir: paths.logDir,
    feedbackDir: paths.feedbackDir,
    statePath: join(paths.dataDir, 'inference-state.json'),
  });

  const ingester = new mod.GrooverLogIngester({
    sourceDir: ingestSource,
    targetDir: paths.logDir,
    signalsManager: manager,
    dryRun,
  });

  log(
    `[R-02] mode=${dryRun ? 'dry-run' : 'commit'} source=${ingestSource} brain=${paths.signalsPath}`,
  );

  const ingest = ingester.ingest();
  log(
    `[R-02] ingest imported=${ingest.imported} skipped=${ingest.skipped} promoted=${ingest.promoted.length}`,
  );

  let metaInference: Record<string, unknown> | null = null;
  if (commit && !dryRun && !skipMeta) {
    const report = await service.runMetaInference();
    if (report) {
      metaInference = {
        entriesProcessed: report.entriesProcessed,
        dynamoPass: report.dynamoStats.pass,
        dynamoReject: report.dynamoStats.reject,
      };
      log(`[R-02] meta-inference entries=${report.entriesProcessed}`);
    } else {
      log('[R-02] meta-inference: no new entries');
    }
  }

  let pruneRemoved = 0;
  let pruneKept: number | null = null;
  if (!skipPrune) {
    const pruneResult = mod.pruneSignals(manager, { dryRun });
    pruneRemoved = pruneResult.removed.length;
    pruneKept = pruneResult.kept;
    log(`[R-02] prune removed=${pruneRemoved} kept=${pruneKept} dry=${pruneResult.dryRun}`);
  }

  const afterCount = manager.load().signals.length;
  const report = {
    timestamp: new Date().toISOString(),
    mode: dryRun ? 'dry-run' : 'commit',
    ingest_source: ingestSource,
    signals_path: paths.signalsPath,
    imported: ingest.imported,
    skipped: ingest.skipped,
    promoted: ingest.promoted,
    signal_count_before: beforeCount,
    signal_count_after: afterCount,
    meta_inference: metaInference,
    prune_removed: pruneRemoved,
    prune_kept: pruneKept,
  };

  const outDir = join(GROOVER_ROOT, 'logs', 'repertoire');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, `enrich-${dryRun ? 'dry' : 'commit'}-${Date.now()}.json`),
    JSON.stringify(report, null, 2),
  );
  appendFileSync(join(outDir, 'enrich.jsonl'), `${JSON.stringify(report)}\n`);

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`FATAL: ${message}\n`);
  process.exit(1);
});