#!/usr/bin/env tsx
/**
 * Repertoire Enrichment Pipeline
 * 
 * Combines:
 * - High-value signals from verifiable-agent-ecosystem research
 * - Live signals discovered in Groover inference logs
 * - Maintains observation/feedback stats
 * 
 * Run manually or via cron for ongoing memory growth.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const REPERTOIRE_SIGNALS = 'node_modules/@0xray/repertoire/data/curated_signals.json';
const INFERENCE_LOG_DIR = 'research/groover-inference-logs';
const ECOSYSTEM_ROOT = '/tmp/verifiable-agent-ecosystem';

interface Signal {
  name: string;
  definition: string;
  tags: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  evaluation_criteria: string;
  validation_experiment: string;
  master_index_integration: string;
  implementation_notes: string;
  first_seen?: string;
  status?: string;
  observation_stats?: {
    observation_count: number;
    avg_confidence: number;
    max_confidence: number;
    last_seen: string;
    governance_forced_count?: number;
  };
  feedback_stats?: {
    outcome_count: number;
    success_count: number;
    failure_count: number;
    last_outcome?: string;
  };
}

function loadExistingSignals(): any {
  if (!existsSync(REPERTOIRE_SIGNALS)) {
    throw new Error('Repertoire signals file not found');
  }
  return JSON.parse(readFileSync(REPERTOIRE_SIGNALS, 'utf8'));
}

function extractFromEcosystem(): Signal[] {
  // Static high-value signals (can be expanded later by parsing more files)
  return [
    {
      name: "three-subsystem-verifiable-os",
      definition: "A complete verifiable agent operating system requires three mandatory subsystems: Inference, External Governance (Dynamo Solar SSOT), and Autonomous Engine (0xRay). Governance is not optional.",
      tags: ["ontological-trap", "governance", "architecture", "three-subsystem"],
      priority: "critical",
      evaluation_criteria: "Inference references the three-subsystem model or criticizes treating inference/orchestration as sufficient without external governance.",
      validation_experiment: "Submit proposal skipping Dynamo. Check if blocked or low resonance.",
      master_index_integration: "Top-level architectural invariant.",
      implementation_notes: "Enforce in govern_proposals and govern_reflection.",
    },
    {
      name: "governance-as-mandatory-external-filter",
      definition: "Governance is the mandatory external filter between internal deliberation and action. Internal consistency alone is insufficient.",
      tags: ["ontological-trap", "governance", "external-filter"],
      priority: "critical",
      evaluation_criteria: "Reply states governance is mandatory or criticizes bypassing external governance.",
      validation_experiment: "Submit high-resonance internal proposal without Dynamo pass.",
      master_index_integration: "Surface on any entry treating inference output as directly actionable.",
      implementation_notes: "Wire into every govern_* call.",
    }
  ];
}

function extractFromInferenceLogs(): Signal[] {
  // Future: parse recent JSONL for recurring high-confidence signals
  // For now return empty (can be expanded)
  return [];
}

function mergeSignals(existing: any, newSignals: Signal[]): { added: number; updated: number } {
  const byName = new Map(existing.signals.map((s: any) => [s.name, s]));
  let added = 0;
  let updated = 0;

  for (const sig of newSignals) {
    if (byName.has(sig.name)) {
      // Update existing (keep stats)
      const current = byName.get(sig.name) as any;
      current.definition = sig.definition;
      current.tags = [...new Set([...current.tags, ...sig.tags])];
      current.priority = sig.priority;
      current.evaluation_criteria = sig.evaluation_criteria;
      current.last_seen = new Date().toISOString();
      updated++;
    } else {
      byName.set(sig.name, {
        ...sig,
        first_seen: new Date().toISOString().split('T')[0],
        status: "proposed",
        observation_stats: {
          observation_count: 0,
          avg_confidence: 0,
          max_confidence: 0,
          last_seen: new Date().toISOString(),
          governance_forced_count: 0
        },
        feedback_stats: {
          outcome_count: 0,
          success_count: 0,
          failure_count: 0
        }
      });
      added++;
    }
  }

  existing.signals = Array.from(byName.values());
  existing.last_updated = new Date().toISOString();

  return { added, updated };
}

function main() {
  console.log("=== Repertoire Enrichment ===");
  
  const existing = loadExistingSignals();
  const ecosystemSignals = extractFromEcosystem();
  const logSignals = extractFromInferenceLogs();

  const allNew = [...ecosystemSignals, ...logSignals];
  const result = mergeSignals(existing, allNew);

  writeFileSync(REPERTOIRE_SIGNALS, JSON.stringify(existing, null, 2));

  console.log(`Enrichment complete.`);
  console.log(`  Added: ${result.added}`);
  console.log(`  Updated: ${result.updated}`);
  console.log(`  Total signals: ${existing.signals.length}`);
}

main();