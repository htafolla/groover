import { describe, it, expect, vi } from 'vitest';
import { XrayBridge, listMcpServers, mcpCall } from './index.js';

describe('@groover/xray', () => {
  describe('listMcpServers', () => {
    it('returns at least 10 servers including Dynamo', () => {
      const mcps = listMcpServers();
      expect(mcps.length).toBeGreaterThanOrEqual(10);
      expect(mcps.find(m => m.name === 'Dynamo')).toBeTruthy();
    });
  });

  describe('orchestrate', () => {
    it('calls xray-orchestrator MCP server', async () => {
      const mockMcp = vi.fn().mockResolvedValue({ result: { status: 'delegated', id: 'sess-1' } });
      const bridge = new XrayBridge(mockMcp);
      const tasks = [{ id: 't1', description: 'test task', type: 'test' }];

      const result = await bridge.orchestrate('test', tasks);

      expect(mockMcp).toHaveBeenCalledOnce();
      expect(mockMcp).toHaveBeenCalledWith('xray-orchestrator', 'tools/call', {
        name: 'orchestrate-task',
        arguments: { description: 'test', tasks },
      });
      expect(result).toEqual({ result: { status: 'delegated', id: 'sess-1' } });
    });

    it('propagates MCP server errors', async () => {
      const mockMcp = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const bridge = new XrayBridge(mockMcp);

      await expect(bridge.orchestrate('fail', [])).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('govern', () => {
    it('calls xray-governance MCP server', async () => {
      const mockMcp = vi.fn().mockResolvedValue({ result: { decision: 'approved', id: 'g1' } });
      const bridge = new XrayBridge(mockMcp);
      const proposal = { id: 'g1', title: 'test', description: 'test', type: 'refactor', confidence: 0.9, evidence: ['src/'] };

      const result = await bridge.govern(proposal);

      expect(mockMcp).toHaveBeenCalledOnce();
      expect(mockMcp).toHaveBeenCalledWith('xray-governance', 'tools/call', {
        name: 'govern_proposals',
        arguments: { proposal },
      });
      expect(result).toEqual({ result: { decision: 'approved', id: 'g1' } });
    });

    it('propagates MCP server errors', async () => {
      const mockMcp = vi.fn().mockRejectedValue(new Error('timeout'));
      const bridge = new XrayBridge(mockMcp);

      await expect(bridge.govern({ id: '', title: '', description: '', type: '', confidence: 0, evidence: [] })).rejects.toThrow('timeout');
    });
  });

  describe('enforce', () => {
    it('calls xray-enforcer MCP server', async () => {
      const mockMcp = vi.fn().mockResolvedValue({ result: { score: 100, violations: [] } });
      const bridge = new XrayBridge(mockMcp);

      const result = await bridge.enforce('register-plugin', ['src/test.ts'], '{"pubkey":"ab"}');

      expect(mockMcp).toHaveBeenCalledOnce();
      expect(mockMcp).toHaveBeenCalledWith('xray-enforcer', 'tools/call', {
        name: 'codex-enforcement',
        arguments: { operation: 'register-plugin', files: ['src/test.ts'], newCode: '{"pubkey":"ab"}' },
      });
      expect(result).toEqual({ score: 100, violations: [] });
    });

    it('propagates MCP server errors', async () => {
      const mockMcp = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const bridge = new XrayBridge(mockMcp);

      await expect(bridge.enforce('delete', ['x'])).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('mcpCall (integration smoke)', () => {
    it('rejects when no MCP server is running on default ports', async () => {
      await expect(mcpCall('xray-orchestrator', 'tools/call', {})).rejects.toThrow();
    });
  });
});
