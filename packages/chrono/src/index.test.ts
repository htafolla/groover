import { describe, it, expect } from 'vitest';
import { timeDecay, computeTemporalResonance, versionWithResonance, ChronoEngine, HARMONIC_P_O } from './index.js';

describe('@groover/chrono', () => {
  it('timeDecay returns expected decay for given interval', () => {
    const decay = timeDecay(10000);
    expect(decay).toBeGreaterThan(0.8);
    expect(decay).toBeLessThanOrEqual(1);
  });

  it('computeTemporalResonance returns modulated value > 0', () => {
    const res = computeTemporalResonance({ content: 'test', tdf: 123 });
    expect(res.modulated).toBeGreaterThan(0);
  });

  it('versionWithResonance includes po in version string', () => {
    const ver = versionWithResonance('1.0.0');
    expect(ver.version).toContain('po');
  });

  it('ChronoEngine resonanteAndVersion matches HARMONIC_P_O', () => {
    const engine = new ChronoEngine();
    const engRes = engine.resonateAndVersion();
    expect(engRes.temporal.resonance).toBe(HARMONIC_P_O);
  });
});
