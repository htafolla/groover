import type { Signal } from "./repertoire-utils";
#!/usr/bin/env tsx
/**
 * One-time seeding script
 * Merges high-value primitives from verifiable-agent-ecosystem into Repertoire's curated_signals.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ECOSYSTEM_ROOT = '/tmp/verifiable-agent-ecosystem';
const REPERTOIRE_SIGNALS = 'research/repertoire-brain/curated_signals.json';

interface Signal {
  name: string;
  definition: string;
  tags: string[];
  priority: string;
  evaluation_criteria: string;
  validation_experiment: string;
  master_index_integration: string;
  implementation_notes: string;
  observation_stats?: any;
  feedback_stats?: any;
}

function extractSignalsFromEcosystem(): Signal[] {
  // Key concepts extracted from SYNTHESIS-FINAL-FINDINGS.md and brain-dumps
  return [
    {
      name: "three-subsystem-verifiable-os",
      definition: "A complete verifiable agent operating system requires three mandatory subsystems: Inference (reasoning), External Governance (Dynamo Solar SSOT), and Autonomous Engine (0xRay thinDispatch + MCP orchestration). Governance is not optional.",
      tags: ["ontological-trap", "governance", "architecture", "three-subsystem"],
      priority: "critical",
      evaluation_criteria: "The inference explicitly references the three-subsystem model or criticizes treating inference or orchestration as sufficient without mandatory external governance.",
      validation_experiment: "Create a proposal that skips Dynamo governance entirely. Check if govern_with_solar or repertoire rejects it with low resonance.",
      master_index_integration: "Register as top-level architectural invariant. Queries for 'verifiable agent' must surface the three-subsystem requirement.",
      implementation_notes: "Enforce via govern_proposals and govern_reflection. Add detection in inference prompts for 'governance is optional' language.",
      observation_stats: { observation_count: 0, avg_confidence: 0, max_confidence: 0 }
    },
    {
      name: "governance-as-mandatory-external-filter",
      definition: "Governance is the mandatory external filter between internal deliberation and action. Internal consistency alone is insufficient for verifiable agents.",
      tags: ["ontological-trap", "governance", "external-filter", "mandatory"],
      priority: "critical",
      evaluation_criteria: "The reply states that governance is mandatory or criticizes proposals that bypass external governance.",
      validation_experiment: "Submit a high-resonance internal proposal that has not passed Dynamo. Verify it is blocked or marked NEEDS_REVISION.",
      master_index_integration: "Surface this signal on any entry that treats inference output as directly actionable.",
      implementation_notes: "Wire into every govern_* call. Add to closure primitives for ontological-trap detections.",
      observation_stats: { observation_count: 0, avg_confidence: 0, max_confidence: 0 }
    },
    {
      name: "consumer-boundary-revalidation-gate",
      definition: "Every attestation or output must pass an explicit consumer-side revalidation gate. Treating attestation as a terminating verdict is an ontological error.",
      tags: ["ontological-trap", "attestation", "consumer-boundary", "revalidation"],
      priority: "high",
      evaluation_criteria: "The inference distinguishes 'map' semantics (ongoing responsibility) from 'verdict' semantics (terminated responsibility).",
      validation_experiment: "Test with static attestation metadata that has no revalidation hook.",
      master_index_integration: "Should be a first-class signal type alongside attestation-as-map.",
      implementation_notes: "Add to inference prompts when negative-space analysis surfaces attestation gaps.",
      observation_stats: { observation_count: 0, avg_confidence: 0, max_confidence: 0 }
    },
    {
      name: "inference-input-streams",
      definition: "There are exactly four valid inference input streams for governed agents: Retrospective (git commits), Discovery (filesystem), Live (direct proposals), and Skill Votes (internal MCPs). No fifth stream is required.",
      tags: ["architecture", "inference", "input-streams"],
      priority: "medium",
      evaluation_criteria: "The inference references or misclassifies the four input stream types.",
      validation_experiment: "Submit an inference that invents a fifth input type and check governance response.",
      master_index_integration: "Register the four-stream model as canonical.",
      implementation_notes: "Use during retrospective and discovery phases.",
      observation_stats: { observation_count: 0, avg_confidence: 0, max_confidence: 0 }
    }
  ];
}

function mergeSignals(existing: any, newSignals: Signal[]): any {
  const existingNames = new Set(existing.signals.map((s: any) => s.name));
  let added = 0;

  for (const sig of newSignals) {
    if (!existingNames.has(sig.name)) {
      existing.signals.push({
        ...sig,
        first_seen: new Date().toISOString().split('T')[0],
        status: "proposed",
        batches: [],
        observation_stats: sig.observation_stats || { observation_count: 0, avg_confidence: 0, max_confidence: 0, last_seen: new Date().toISOString() },
        feedback_stats: sig.feedback_stats || { outcome_count: 0, success_count: 0, failure_count: 0 }
      });
      added++;
    }
  }

  existing.last_updated = new Date().toISOString();
  if (!existing.source.includes('verifiable-agent-ecosystem')) {
    existing.source += " + verifiable-agent-ecosystem";
  }

  console.log(`Merged ${added} new signals from verifiable-agent-ecosystem`);
  return existing;
}

function main() {
  const existing = JSON.parse(readFileSync(REPERTOIRE_SIGNALS, 'utf8'));
  const newSignals = extractSignalsFromEcosystem();
  const updated = mergeSignals(existing, newSignals);

  writeFileSync(REPERTOIRE_SIGNALS, JSON.stringify(updated, null, 2));
  console.log(`Seeding complete. Total signals now: ${updated.signals.length}`);
}

main();