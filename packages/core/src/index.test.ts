import { describe, it, expect } from 'vitest';
import { CrossCorrelationEngine } from './index.js';

describe('@groover/core', () => {
  const engine = new CrossCorrelationEngine();

  it('correlateSemantic returns value near 1 for identical strings', async () => {
    const sem = await engine.correlateSemantic('test query one', 'test query one');
    expect(sem).toBeGreaterThanOrEqual(0);
    expect(sem).toBeLessThanOrEqual(1.0000001);
    expect(sem).toBeGreaterThan(0.9);
  });

  it('correlateTemporal returns value between 0 and 1', async () => {
    const temp = await engine.correlateTemporal(123456);
    expect(temp).toBeGreaterThanOrEqual(0);
    expect(temp).toBeLessThanOrEqual(1);
  });

  it('alignGovernance returns value between 0 and 1', async () => {
    const gov = await engine.alignGovernance({ content: 'gov signal', tdf: 999 });
    expect(gov).toBeGreaterThanOrEqual(0);
    expect(gov).toBeLessThanOrEqual(1);
  });

  it('rankWithDynamo returns ranked results with scores', async () => {
    const ranked = await engine.rankWithDynamo([
      { content: 'item1', tdf: 1 },
      { content: 'item2', tdf: 2 },
    ]);
    expect(ranked.length).toBe(2);
    expect(ranked[0].score).toBeGreaterThan(0);
  });
});
