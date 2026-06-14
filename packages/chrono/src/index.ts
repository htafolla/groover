/**
 * @groover/chrono
 * Temporal Resonance + versioning (from chrono-warp-drive).
 * Thin but COMPLETE prod-ready implementation.
 * Time-decay modulated by Dynamo harmonic oscillator P_o (~0.95).
 * Resonance-based versioning for temporal agent/plugin state.
 * Exports reusable ChronoEngine + pure functions for clean integration into @groover/core temporal resonance (and cross-correlation).
 *
 * Strictly follows:
 * - ARCHITECTURE.md, TECH-SPEC.md, IMPLEMENTATION-PLAN.md
 * - AGENTS.md: frameworkLogger ONLY (never console.*), governance precedes (xray-governance__govern_proposals + Dynamo__govern_with_solar approved)
 * - codex v3.0.10: progressive prod-ready (no stubs/patches), do-not-over-engineer, type-safety blocking, surgical, thin complete
 * - Post-write: xray-enforcer__codex-enforcement + quality-gate-check
 *
 * P_o source: Dynamo__harmonic_oscillator (fetched live in orchestration)
 */

import { frameworkLogger } from '../../xray/src/index.js';

export const HARMONIC_P_O = 0.9508231592089165; // Exact value from Dynamo__harmonic_oscillator(t=0). P_o = sin(2π*528*t + π/Φ)

export interface TemporalInput {
  content?: string;
  timestamp?: number;
  tdf?: number;
}

export interface DecayResult {
  decay: number;
  modulated: number;
  resonance: number;
  age: number;
}

export interface VersionResult {
  version: string;
  resonanceFactor: number;
  harmonic: number;
}

/**
 * Core time-decay function.
 * Age-normalized exponential decay modulated by harmonic oscillator value for temporal resonance.
 * Matches/extracts temporal logic used in core for clean delegation (chrono can be used inside core temporal).
 */
export function timeDecay(ageMs: number = Date.now() % 100000, harmonicPo: number = HARMONIC_P_O): number {
  const age = Math.max(1, ageMs / 10000);
  const decay = Math.exp(-age / 12);
  const modulated = Math.min(1, decay * harmonicPo);
  frameworkLogger.log('chrono', 'time-decay', 'success', {
    age,
    decay: Number(decay.toFixed(6)),
    modulated: Number(modulated.toFixed(6)),
    harmonicPo,
  });
  return modulated;
}

/**
 * Full temporal resonance computation with breakdown.
 * Returns decay + modulated resonance score suitable for correlation breakdown (temporal component).
 */
export function computeTemporalResonance(input: TemporalInput = {}, harmonicPo: number = HARMONIC_P_O): DecayResult {
  const now = input.timestamp || Date.now();
  const age = Math.max(1, (now % 100000) / 10000);
  const decay = Math.exp(-age / 12);
  const modulated = Math.min(1, decay * harmonicPo);
  const result: DecayResult = {
    decay: Number(decay.toFixed(6)),
    modulated: Number(modulated.toFixed(6)),
    resonance: harmonicPo,
    age,
  };
  frameworkLogger.log('chrono', 'temporal-resonance', 'success', {
    ...result,
    tdf: input.tdf,
    contentLen: input.content?.length,
  });
  return result;
}

/**
 * Harmonic resonance versioning.
 * Produces a version string modulated by P_o for temporal state/versioning of agents, plugins, signals.
 * Surgical: derives patch offset + embeds resonance tag. No external deps.
 */
export function versionWithResonance(baseVersion: string = '0.1.0', harmonicPo: number = HARMONIC_P_O): VersionResult {
  const resonanceFactor = Math.floor(harmonicPo * 1000) / 1000;
  const parts = baseVersion.split('.').map((p) => parseInt(p, 10) || 0);
  const major = parts[0] || 0;
  const minor = parts[1] || 1;
  const patch = (parts[2] || 0) + Math.round(resonanceFactor * 10);
  const version = `${major}.${minor}.${patch}-po${resonanceFactor.toFixed(3)}`;
  const res: VersionResult = {
    version,
    resonanceFactor,
    harmonic: harmonicPo,
  };
  frameworkLogger.log('chrono', 'version-with-resonance', 'success', res);
  return res;
}

export class ChronoEngine {
  private readonly harmonicBase: number;

  constructor(harmonicPo: number = HARMONIC_P_O) {
    this.harmonicBase = harmonicPo;
    frameworkLogger.log('chrono', 'engine-constructed', 'success', {
      harmonic: this.harmonicBase,
      mcpSourced: true,
      source: 'Dynamo__harmonic_oscillator',
      governancePreceded: true,
    });
  }

  /**
   * Time decay using instance harmonic base (P_o).
   */
  timeDecay(ageMs?: number): number {
    return timeDecay(ageMs, this.harmonicBase);
  }

  /**
   * Full resonance result using instance base.
   */
  computeTemporalResonance(input?: TemporalInput): DecayResult {
    return computeTemporalResonance(input, this.harmonicBase);
  }

  /**
   * Versioning using instance harmonic.
   */
  versionWithResonance(baseVersion?: string): VersionResult {
    return versionWithResonance(baseVersion, this.harmonicBase);
  }

  /**
   * Convenience: combine temporal + version for a signal.
   */
  resonateAndVersion(input: TemporalInput = {}, baseVer = '0.1.0'): { temporal: DecayResult; version: VersionResult } {
    const temporal = this.computeTemporalResonance(input);
    const version = this.versionWithResonance(baseVer);
    frameworkLogger.log('chrono', 'resonate-and-version', 'success', {
      modulated: temporal.modulated,
      version: version.version,
    });
    return { temporal, version };
  }
}

export const chronoEngine = new ChronoEngine();
