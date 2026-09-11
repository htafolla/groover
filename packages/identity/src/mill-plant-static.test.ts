import {execFileSync} from 'node:child_process';
import {readdirSync, readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';

const websiteStatic = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../website/static',
);
const plantDir = path.join(websiteStatic, 'mill-plant');
const tgzPath = path.join(websiteStatic, 'mill-plant.tgz');

describe('mill-plant download (factory tgz)', () => {
  it('static plant is mill+inspect only', () => {
    expect(readdirSync(path.join(plantDir, 'skills')).sort()).toEqual([
      'inspect',
      'mill',
    ]);
    expect(readdirSync(path.join(plantDir, 'agents')).sort()).toEqual([
      'inspect.yml',
      'mill.yml',
    ]);
    expect(existsSync(path.join(plantDir, 'skills/mill/SKILL.md'))).toBe(true);
    expect(existsSync(path.join(plantDir, 'skills/inspect/SKILL.md'))).toBe(true);
    expect(existsSync(path.join(plantDir, 'CLI.md'))).toBe(true);
    const cli = readFileSync(path.join(plantDir, 'CLI.md'), 'utf8');
    expect(cli).toContain('npm i -D 0xray@4.0.9');
    expect(cli).toContain('npx @0xray/foundry mint');
    expect(cli).toContain('npx @0xray/foundry inspect');
    expect(cli).toContain('node mill-plant/install.mjs');
    expect(cli).not.toMatch(/\benforcer\b|\borchestrator\b/);
    const install = readFileSync(path.join(plantDir, 'install.mjs'), 'utf8');
    expect(install).toContain('npm i -D 0xray@4.0.9');
    expect(install).toContain('.xray/features.json');
    expect(install).toContain('factory-config.json');
    expect(install).toContain('isPasswdHome');
  });

  it('tgz lists mill+inspect plant and CLI load, not costume', () => {
    expect(existsSync(tgzPath)).toBe(true);
    const listing = execFileSync('tar', ['-tzf', tgzPath], {encoding: 'utf8'});
    expect(listing).toContain('mill-plant/skills/mill/SKILL.md');
    expect(listing).toContain('mill-plant/skills/inspect/SKILL.md');
    expect(listing).toContain('mill-plant/agents/mill.yml');
    expect(listing).toContain('mill-plant/agents/inspect.yml');
    expect(listing).toContain('mill-plant/CLI.md');
    expect(listing).toContain('mill-plant/install.mjs');
    expect(listing).not.toMatch(/enforcer|orchestrator/);
    const names = listing
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.includes('/skills/') && line.endsWith('/SKILL.md'));
    expect(names.sort()).toEqual([
      'mill-plant/skills/inspect/SKILL.md',
      'mill-plant/skills/mill/SKILL.md',
    ]);
  });
});
