/**
 * AgentUIManifest support for Groover marketplace.
 * SSOT: agentuimanifest Zod schema (replaces forked hand-rolled validator).
 * Backward compat: `chat.initialPrompt` → `chat.systemPrompt` at validation boundary.
 */
import {
  agentUiManifestSchema,
  type AgentUiManifest,
} from 'agentuimanifest';
import type { ZodIssue } from 'zod';
import { frameworkLogger } from '../../xray/src/index.js';

export type { AgentUiManifest };
export { agentUiManifestSchema };

export type DisplayMode = AgentUiManifest['displayMode'];
type FormManifest = Extract<AgentUiManifest, { displayMode: 'form' }>;
export type FieldType = NonNullable<FormManifest['fields']>[number]['fieldType'];
export type ResultFormat = FormManifest['resultFormat'];

/** Map legacy groover field names to SSOT before Zod validation. */
export function normalizeAgentUiManifest(manifest: unknown): unknown {
  if (!manifest || typeof manifest !== 'object') return manifest;
  const m = manifest as Record<string, unknown>;
  if (m.displayMode !== 'chat' || !m.chat || typeof m.chat !== 'object') return manifest;

  const chat = { ...(m.chat as Record<string, unknown>) };
  if ('initialPrompt' in chat && typeof chat.initialPrompt === 'string' && !('systemPrompt' in chat)) {
    chat.systemPrompt = chat.initialPrompt;
    delete chat.initialPrompt;
  }
  return { ...m, chat };
}

export function validateAgentUiManifest(manifest: unknown): {
  valid: boolean;
  errors: string[];
  manifest?: AgentUiManifest;
} {
  const normalized = normalizeAgentUiManifest(manifest);
  const result = agentUiManifestSchema.safeParse(normalized);

  if (result.success) {
    frameworkLogger.log('marketplace', 'ui-manifest-validated', 'success', {
      displayMode: result.data.displayMode,
    });
    return { valid: true, errors: [], manifest: result.data };
  }

  const errors = result.error.issues.map(
    (issue: ZodIssue) => `${issue.path.join('.') || 'root'}: ${issue.message}`,
  );
  frameworkLogger.log('marketplace', 'ui-manifest-validation-failed', 'warning', { errors });
  return { valid: false, errors };
}

export function isAgentUiManifest(value: unknown): value is AgentUiManifest {
  return validateAgentUiManifest(value).valid;
}