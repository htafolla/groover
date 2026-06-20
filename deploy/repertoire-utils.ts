/**
 * Shared Repertoire utilities
 * Consolidates Signal type and merge logic used across ingestion scripts.
 */

export interface Signal {
  name: string;
  definition: string;
  tags: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  evaluation_criteria: string;
  validation_experiment: string;
  master_index_integration: string;
  implementation_notes: string;
  source?: string;
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

export function mergeSignals(existingSignals: Signal[], newSignals: Signal[]): { added: number; updated: number } {
  const byName = new Map(existingSignals.map(s => [s.name, s]));
  let added = 0;
  let updated = 0;

  for (const sig of newSignals) {
    if (byName.has(sig.name)) {
      const current = byName.get(sig.name)!;
      current.tags = [...new Set([...current.tags, ...sig.tags])];
      current.implementation_notes = (current.implementation_notes || '') + ' | ' + sig.implementation_notes;
      if (sig.priority === 'critical') current.priority = 'critical';
      if (sig.observation_stats) {
        current.observation_stats = current.observation_stats || sig.observation_stats;
      }
      updated++;
    } else {
      byName.set(sig.name, {
        ...sig,
        first_seen: sig.first_seen || new Date().toISOString().split('T')[0],
        status: sig.status || 'proposed',
        observation_stats: sig.observation_stats || {
          observation_count: 0,
          avg_confidence: 0,
          max_confidence: 0,
          last_seen: new Date().toISOString(),
        },
        feedback_stats: sig.feedback_stats || {
          outcome_count: 0,
          success_count: 0,
          failure_count: 0,
        },
      });
      added++;
    }
  }

  return { added, updated };
}

export function normalizeSignalName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}