import { z } from 'zod';

export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string(),
  params: z.record(z.unknown()).optional(),
});

export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;

export const ToolsCallParamsSchema = z.object({
  name: z.string().min(1),
  arguments: z.record(z.unknown()).optional().default({}),
});

const ChallengeTurnSchema = z.object({
  toolCall: z.string(),
  input: z.string(),
  output: z.string(),
  reasoning: z.string(),
  timestamp: z.number(),
  hash: z.string(),
});

export const ChallengeTraceSchema = z.object({
  sessionId: z.string().min(1),
  turns: z.array(ChallengeTurnSchema).min(1),
  merkleRoot: z.string().min(1),
  attestation: z.string().min(1),
});

export const RegisterPluginArgsSchema = z.object({
  pubkey: z.string().min(1),
  payload: z.string(),
  signature: z.string().min(1),
  challengeNonce: z.string().min(1),
  challengeTrace: z.union([ChallengeTraceSchema, z.string().min(1)]),
  metadata: z.record(z.unknown()).optional(),
  uiManifest: z.unknown().optional(),
});

export const GetRegistrationChallengeArgsSchema = z.object({
  pubkey: z.string().min(1),
});

export const SubmitChallengeTurnArgsSchema = z.object({
  sessionId: z.string().min(1),
  toolCall: z.string().min(1),
  hash: z.string().min(1),
  input: z.string().optional(),
  output: z.string().optional(),
  reasoning: z.string().optional(),
  timestamp: z.number().optional(),
});

export const SearchPluginsArgsSchema = z.object({
  query: z.string().optional(),
});

export const GetPluginUiManifestArgsSchema = z.object({
  did: z.string().min(1),
});

export const ListMcpServersArgsSchema = z.object({}).passthrough();

const TOOL_ARG_SCHEMAS: Record<string, z.ZodType<Record<string, unknown>>> = {
  register_plugin: RegisterPluginArgsSchema,
  get_registration_challenge: GetRegistrationChallengeArgsSchema,
  submit_challenge_turn: SubmitChallengeTurnArgsSchema,
  search_plugins: SearchPluginsArgsSchema,
  get_plugin_ui_manifest: GetPluginUiManifestArgsSchema,
  list_mcp_servers: ListMcpServersArgsSchema,
};

export function validateToolArguments(
  toolName: string,
  args: unknown,
): { success: true; data: Record<string, unknown> } | { success: false; error: z.ZodError } {
  const schema = TOOL_ARG_SCHEMAS[toolName];
  if (!schema) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  const parsed = schema.safeParse(args ?? {});
  if (!parsed.success) {
    return { success: false, error: parsed.error };
  }
  return { success: true, data: parsed.data as Record<string, unknown> };
}