import { z } from 'zod';

const versionSchema = z.literal('1');

const fieldTypeSchema = z.enum([
  'text',
  'textarea',
  'url',
  'number',
  'select',
  'toggle',
]);

const fieldValidationSchema = z.object({
  required: z.boolean().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  pattern: z.string().optional(),
  patternHint: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  options: z.array(z.string()).optional(),
});

const conditionalOnSchema = z.object({
  fieldId: z.string(),
  operator: z.enum(['equals', 'notEquals', 'contains', 'exists', 'notExists']),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

const fieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  fieldType: fieldTypeSchema,
  placeholder: z.string().optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  validation: fieldValidationSchema.optional(),
  conditionalOn: conditionalOnSchema.optional(),
  hidden: z.boolean().optional(),
});

const chatConfigSchema = z.object({
  systemPrompt: z.string(),
  temperature: z.number().optional(),
  maxTurns: z.number().optional(),
  toolChoice: z.string().optional(),
});

const wizardStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  fieldIds: z.array(z.string()),
  toolName: z.string(),
});

const resultFormatSchema = z.enum(['markdown', 'structured', 'file']);

const sharedManifestFields = {
  version: versionSchema,
  icon: z.string().optional(),
  accentColor: z.string().optional(),
  showPoweredBy: z.boolean().optional(),
  exampleQueries: z.array(z.string()).optional(),
};

export const agentUiManifestSchema = z.discriminatedUnion('displayMode', [
  z.object({
    ...sharedManifestFields,
    displayMode: z.literal('form'),
    primaryTool: z.string().optional(),
    fields: z.array(fieldSchema).optional(),
    resultFormat: resultFormatSchema.optional(),
  }),
  z.object({
    ...sharedManifestFields,
    displayMode: z.literal('chat'),
    chat: chatConfigSchema.optional(),
  }),
  z.object({
    ...sharedManifestFields,
    displayMode: z.literal('wizard'),
    wizardSteps: z.array(wizardStepSchema).optional(),
    finalTool: z.string().optional(),
    finalResultFormat: resultFormatSchema.optional(),
    fields: z.array(fieldSchema).optional(),
  }),
  z.object({
    ...sharedManifestFields,
    displayMode: z.literal('viewer'),
    viewerTool: z.string().optional(),
  }),
]);

export type AgentUiManifest = z.infer<typeof agentUiManifestSchema>;