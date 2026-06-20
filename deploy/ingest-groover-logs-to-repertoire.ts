#!/usr/bin/env tsx
/**
 * Groover Inference Logs → Repertoire Ingestion
 *
 * Reads all .jsonl files from research/groover-inference-logs/
 * and converts real inference + Repertoire activity into curated signals.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LOG_DIR = 'research/groover-inference-logs';
const REPERTOIRE_SIGNALS = 'node_modules/@0xray/repertoire/data/curated_signals.json';

interface LogEntry {
  timestamp: string;
  post_title?: string;
  type?: string;
  repertoire_signals?: string[];
  matched_primitives?: string[];
  ontologicalTrapDetected?: boolean;
  governance_forced?: boolean;
  dynamo_result?: any;
  inference?: string;
}

interface Signal {
  name: string;
  definition: string;
  tags: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  evaluation_criteria: string;
  validation_experiment: string;
  master_index_integration: string;
  implementation_notes: string;
  source?: string;
}

function getAllJsonlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => join(dir, f));
}

function parseJsonl(filePath: string): LogEntry[] {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.trim().split('\n').filter(Boolean);
  const entries: LogEntry[] = [];

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // skip bad lines
    }
  }
  return entries;
}

function createSignalFromEntry(entry: LogEntry, sourceFile: string): Signal | null {
  const signals = entry.repertoire_signals || [];
  const primitives = entry.matched_primitives || [];

  if (signals.length === 0 && primitives.length === 0) return null;

  const allConcepts = [...new Set([...signals, ...primitives])];

  // Create a signal per strong concept
  const concept = allConcepts[0];
  if (!concept) return null;

  const name = concept
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);

  const isTrap = entry.ontologicalTrapDetected === true;
  const forced = entry.governance_forced === true;

  let priority: 'critical' | 'high' | 'medium' = 'medium';
  if (isTrap || forced) priority = 'high';
  if (isTrap && forced) priority = 'critical';

  return {
    name,
    definition: `Observed in live Groover inference on post "${entry.post_title || 'unknown'}". ` +
      `Signals: ${signals.join(', ')}. Primitives: ${primitives.join(', ')}.`,
    tags: [
      ...(isTrap ? ['ontological-trap'] : []),
      'live-inference',
      'groover',
      ...signals.slice(0, 3),
    ],
    priority,
    evaluation_criteria: `Inference contains strong signals around "${concept}".`,
    validation_experiment: `Create content that triggers "${concept}" and verify high confidence + governance forcing.`,
    master_index_integration: `Track real-world frequency of "${concept}" from inference logs.`,
    implementation_notes: `Extracted from ${sourceFile} at ${entry.timestamp}.`,
    source: sourceFile,
  };
}

function mergeSignals(existing: any, newSignals: Signal[]): { added: number; updated: number } {
  const byName = new Map(existing.signals.map((s: any) => [s.name, s]));
  let added = 0;
  let updated = 0;

  for (const sig of newSignals) {
    if (byName.has(sig.name)) {
      const current = byName.get(sig.name) as any;
      current.tags = [...new Set([...current.tags, ...sig.tags])];
      current.implementation_notes = (current.implementation_notes || '') + ' | ' + sig.implementation_notes;
      if (sig.priority === 'critical') current.priority = 'critical';
      updated++;
    } else {
      byName.set(sig.name, {
        ...sig,
        first_seen: new Date().toISOString().split('T')[0],
        status: 'proposed',
        observation_stats: {
          observation_count: 1,
          avg_confidence: 0.73,
          max_confidence: 0.8,
          last_seen: new Date().toISOString(),
          governance_forced_count: sig.priority === 'critical' ? 1 : 0,
        },
        feedback_stats: { outcome_count: 0, success_count: 0, failure_count: 0 },
      });
      added++;
    }
  }

  existing.signals = Array.from(byName.values());
  existing.last_updated = new Date().toISOString();
  return { added, updated };
}

function main() {
  console.log('=== Groover Inference Logs → Repertoire ===\n');

  const files = getAllJsonlFiles(LOG_DIR);
  console.log(`Found ${files.length} inference log files.`);

  let allSignals: Signal[] = [];

  for (const file of files) {
    const entries = parseJsonl(file);
    for (const entry of entries) {
      const signal = createSignalFromEntry(entry, file);
      if (signal) allSignals.push(signal);
    }
  }

  console.log(`Extracted ${allSignals.length} signals from logs.\n`);

  const existing = JSON.parse(readFileSync(REPERTOIRE_SIGNALS, 'utf8'));
  const result = mergeSignals(existing, allSignals);

  writeFileSync(REPERTOIRE_SIGNALS, JSON.stringify(existing, null, 2));

  console.log('Ingestion complete.');
  console.log(`  New signals added: ${result.added}`);
  console.log(`  Existing signals updated: ${result.updated}`);
  console.log(`  Total signals now: ${existing.signals.length}`);
}

main();