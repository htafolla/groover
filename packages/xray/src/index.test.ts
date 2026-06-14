import { describe, it, expect } from 'vitest';
import { XrayBridge, listMcpServers } from './index.js';

describe('@groover/xray', () => {
  const bridge = new XrayBridge();

  it('listMcpServers returns at least 10 servers including Dynamo', () => {
    const mcps = listMcpServers();
    expect(mcps.length).toBeGreaterThanOrEqual(10);
    expect(mcps.find(m => m.name === 'Dynamo')).toBeTruthy();
  });

  it('orchestrate returns a result with status', async () => {
    const orch = await bridge.orchestrate('test task', [
      { id: 't1', description: 'test', type: 'test' },
    ]);
    expect(orch).toBeTruthy();
    expect(orch.status).toBeTruthy();
  });

  it('govern returns identification result', async () => {
    const gov = await bridge.govern({
      id: 'g1', title: 'test gov', description: 'test',
      type: 'test', confidence: 0.8, evidence: [],
    });
    expect(gov).toBeTruthy();
    expect(gov.identified).toBe(true);
  });
});
