/** Mill-safe consumer defaults. Not the 45/42 exo dump. */

export const DEFAULT_FEATURES = {
  suit_temperament: {
    profile: 'auto',
    host_defaults: {
      grok: 'frontier',
      hermes: 'guided',
      opencode: 'guided',
      openclaw: 'guided',
      generic: 'guided',
    },
  },
  multi_agent_orchestration: {
    enabled: true,
    lead_dev_mode: true,
    no_new_surface: true,
    per_suite_test_triage: true,
  },
  memory_routing: {
    enabled: false,
  },
} as const;

export const DEFAULT_CONFIG = {
  token_management: {
    maxPromptTokens: 20000,
    warningThreshold: 15000,
    contextPruning: {
      enabled: true,
      aggressivePruning: true,
      preserveCriticalContext: true,
    },
  },
  cache_settings: {
    enabled: true,
    max_size_mb: 25,
    ttl_seconds: 120,
  },
} as const;

export function prettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function parseObjectJson(
  raw: string,
  label: string,
): {ok: true; value: Record<string, unknown> | null} | {ok: false; detail: string} {
  const trimmed = raw.trim();
  if (!trimmed) return {ok: true, value: null};
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {ok: false, detail: `${label} must be a JSON object`};
    }
    return {ok: true, value: parsed as Record<string, unknown>};
  } catch {
    return {ok: false, detail: `${label} is not valid JSON`};
  }
}

export type FactoryConfig = {
  inventory: Record<string, unknown>;
  features: Record<string, unknown> | null;
  config: Record<string, unknown> | null;
  codex: Record<string, unknown> | null;
};
