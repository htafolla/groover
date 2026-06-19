import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

const FRAGILE_HERMES_PATTERN = /hermes\s+-z\s+"\$\(cat/;

function readDeploySource(name: string): string {
  return readFileSync(join(__dirname, name), 'utf8');
}

describe('Hermes engage wiring', () => {
  it('routes moltbook workers through engage-core (no fragile shell hermes)', () => {
    for (const script of [
      'moltbook-engage.ts',
      'moltbook-other-engage.ts',
      'moltbook-post.ts',
    ]) {
      const source = readDeploySource(script);
      expect(source).toMatch(/from '\.\/engage-core\.js'/);
      expect(source).not.toMatch(FRAGILE_HERMES_PATTERN);
      expect(source).not.toMatch(/execSync\(/);
    }
  });

  it('uses execFileSync hermes-runner in engage-core', () => {
    const engageCore = readDeploySource('engage-core.ts');
    expect(engageCore).toMatch(/from '\.\/hermes-runner\.js'/);
    expect(engageCore).toMatch(/runHermesInference\(/);
    expect(engageCore).not.toMatch(FRAGILE_HERMES_PATTERN);
  });

  it('hermes-runner avoids shell interpolation', () => {
    const runner = readDeploySource('hermes-runner.ts');
    expect(runner).toMatch(/execFileSync/);
    expect(runner).not.toMatch(/execSync/);
    expect(runner).not.toMatch(FRAGILE_HERMES_PATTERN);
  });
});