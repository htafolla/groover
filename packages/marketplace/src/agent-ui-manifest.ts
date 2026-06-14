/**
 * AgentUIManifest support for Groover marketplace.
 * Integrated reference: https://github.com/htafolla/agentuimanifest
 * Declarative UI schema so MCP agents/plugins declare human-friendly forms/wizards/etc.
 * instead of raw LLM inputSchema.
 *
 * Per SPEC.md v1.0 (fetched via grok_com_github MCP).
 * Minimal but complete for MVP: core interfaces + validation shape.
 * Full adoption in registration, registry, search, and correlation.
 *
 * Governance note: Aligns with AgentUIManifest CHARTER (open, DCO, maintainer model)
 * and Groover's 0xRay/Dynamo (this integration governed and enforced).
 */
import { frameworkLogger } from '../../xray/src/index.js';

export type DisplayMode = 'form' | 'chat' | 'wizard' | 'viewer';
export type FieldType = 'text' | 'textarea' | 'url' | 'number' | 'select' | 'toggle';
export type ResultFormat = 'markdown' | 'structured' | 'file';

export interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternHint?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

export interface Field {
  id: string;
  label: string;
  description?: string;
  fieldType: FieldType;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  validation?: FieldValidation;
  conditionalOn?: {
    fieldId: string;
    operator: 'equals' | 'notEquals' | 'contains' | 'exists' | 'notExists';
    value?: string | number | boolean;
  };
  hidden?: boolean;
}

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  fieldIds: string[];
  toolName?: string;
}

export interface ChatConfig {
  initialPrompt?: string;
  maxTurns?: number;
}

export interface AgentUiManifest {
  version: '1';
  displayMode: DisplayMode;

  // form mode
  primaryTool?: string;
  fields?: Field[];
  resultFormat?: ResultFormat;

  // wizard mode
  wizardSteps?: WizardStep[];
  finalTool?: string;
  finalResultFormat?: ResultFormat;

  // chat mode
  chat?: ChatConfig;

  // viewer mode
  viewerTool?: string;

  // display hints
  icon?: string;
  accentColor?: string;
  showPoweredBy?: boolean;
  exampleQueries?: string[];
}

/**
 * Lightweight runtime validator (surgical, no extra deps like Zod for MVP).
 * Enforces shape per spec. Extend later if needed.
 */
export function validateAgentUiManifest(manifest: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!manifest || typeof manifest !== 'object') {
    errors.push('Manifest must be an object');
    return { valid: false, errors };
  }
  const m = manifest as Partial<AgentUiManifest>;

  if (m.version !== '1') errors.push('version must be "1"');
  if (!m.displayMode || !['form','chat','wizard','viewer'].includes(m.displayMode)) {
    errors.push('displayMode must be one of form|chat|wizard|viewer');
  }

  if (m.fields) {
    if (!Array.isArray(m.fields)) errors.push('fields must be array');
    else {
      m.fields.forEach((f, i) => {
        if (!f.id || !f.label || !f.fieldType) {
          errors.push(`field[${i}] missing id/label/fieldType`);
        }
        if (f.validation?.pattern && typeof f.validation.pattern !== 'string') {
          errors.push(`field[${i}] validation.pattern must be string`);
        }
      });
    }
  }

  if (errors.length > 0) {
    frameworkLogger.log('marketplace', 'ui-manifest-validation-failed', 'warning', { errors });
  } else {
    frameworkLogger.log('marketplace', 'ui-manifest-validated', 'success', { displayMode: m.displayMode });
  }

  return { valid: errors.length === 0, errors };
}

export function isAgentUiManifest(value: unknown): value is AgentUiManifest {
  return validateAgentUiManifest(value).valid;
}
