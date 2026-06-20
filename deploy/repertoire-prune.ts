#!/usr/bin/env tsx
/**
 * Basic Repertoire Pruning / Hygiene
 * 
 * Demotes or retires low-value signals based on simple heuristics.
 * Run periodically via full-repertoire-enrichment.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';

const BRAIN_PATH = 'research/repertoire-brain/curated_signals.json';

interface Signal {
  name: string;
  priority: string;
  observation_stats?: { observation_count: number; last_seen: string };
  feedback_stats?: { outcome_count: number; success_count: number };
}

function prune() {
  const data = JSON.parse(readFileSync(BRAIN_PATH, 'utf8'));
  const signals: Signal[] = data.signals;
  const now = Date.now();

  let demoted = 0;
  let retired = 0;

  const prunedSignals = signals.map(sig => {
    const obs = sig.observation_stats?.observation_count || 0;
    const successRate = sig.feedback_stats
      ? sig.feedback_stats.success_count / Math.max(1, sig.feedback_stats.outcome_count)
      : 0.5;

    const lastSeen = sig.observation_stats?.last_seen
      ? new Date(sig.observation_stats.last_seen).getTime()
      : 0;
    const daysSince = (now - lastSeen) / (1000 * 60 * 60 * 24);

    // Retire very stale low-observation signals
    if (obs < 3 && daysSince > 30 && sig.priority !== 'critical') {
      retired++;
      return { ...sig, status: 'retired' };
    }

    // Demote medium signals with poor success rate
    if (sig.priority === 'medium' && successRate < 0.3 && obs > 5) {
      demoted++;
      return { ...sig, priority: 'low' as const };
    }

    return sig;
  });

  data.signals = prunedSignals;
  data.last_pruned = new Date().toISOString();

  writeFileSync(BRAIN_PATH, JSON.stringify(data, null, 2));

  console.log(`Pruning complete. Demoted: ${demoted}, Retired: ${retired}`);
  console.log(`Total signals remaining: ${prunedSignals.length}`);
}

prune();