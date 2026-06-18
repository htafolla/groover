import { describe, it, expect } from 'vitest';
import {
  validateAgentUiManifest,
  normalizeAgentUiManifest,
  isAgentUiManifest,
} from './agent-ui-manifest.js';

describe('agent-ui-manifest SSOT', () => {
  it('accepts valid form manifest', () => {
    const manifest = {
      version: '1' as const,
      displayMode: 'form' as const,
      primaryTool: 'search_plugins',
      fields: [{ id: 'q', label: 'Query', fieldType: 'text' as const }],
    };
    const result = validateAgentUiManifest(manifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.manifest).toEqual(manifest);
    expect(isAgentUiManifest(manifest)).toBe(true);
  });

  it('normalizes chat.initialPrompt to chat.systemPrompt', () => {
    const legacy = {
      version: '1' as const,
      displayMode: 'chat' as const,
      chat: { initialPrompt: 'You are a helpful assistant.', maxTurns: 10 },
    };
    const normalized = normalizeAgentUiManifest(legacy) as {
      chat: { systemPrompt: string; maxTurns: number };
    };
    expect(normalized.chat.systemPrompt).toBe('You are a helpful assistant.');
    expect('initialPrompt' in normalized.chat).toBe(false);

    const result = validateAgentUiManifest(legacy);
    expect(result.valid).toBe(true);
    expect(result.manifest?.displayMode).toBe('chat');
    if (result.manifest?.displayMode === 'chat') {
      expect(result.manifest.chat?.systemPrompt).toBe('You are a helpful assistant.');
      expect(result.manifest.chat?.maxTurns).toBe(10);
    }
  });

  it('rejects invalid displayMode', () => {
    const result = validateAgentUiManifest({
      version: '1',
      displayMode: 'modal',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(isAgentUiManifest({ version: '1', displayMode: 'modal' })).toBe(false);
  });
});