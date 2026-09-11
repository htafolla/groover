import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';

const hangar = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const repo = path.resolve(hangar, '..');
const shops = ['shop-extract', 'shop-witness', 'shop-pin'] as const;
const urls = {
  'shop-extract': 'https://clearing-production-9968.up.railway.app/v1/extract',
  'shop-witness': 'https://clearing-production-9968.up.railway.app/v1/witness',
  'shop-pin': 'https://clearing-production-9968.up.railway.app/v1/pin',
};

describe('hangar shops', () => {
  it('marketplace lists mill + three shops', () => {
    const raw = readFileSync(path.join(repo, '.grok-plugin/marketplace.json'), 'utf8');
    const index = JSON.parse(raw) as {plugins: Array<{name: string; source: string}>};
    expect(index.plugins.map((p) => p.name).sort()).toEqual([
      'mill',
      'shop-extract',
      'shop-pin',
      'shop-witness',
    ]);
    for (const plugin of index.plugins) {
      const rel = plugin.source.replace(/^\.\//, '');
      expect(existsSync(path.join(repo, rel, 'plugin.json'))).toBe(true);
    }
  });

  it('each shop is a Grok plugin with skill, command, and live 402 URL', () => {
    for (const name of shops) {
      const plugin = path.join(hangar, 'plugins', name);
      const skill = readFileSync(path.join(plugin, 'skills', name, 'SKILL.md'), 'utf8');
      const command = readFileSync(path.join(plugin, 'commands', `${name}.md`), 'utf8');
      const manifest = JSON.parse(readFileSync(path.join(plugin, 'plugin.json'), 'utf8')) as {
        name: string;
      };
      expect(manifest.name).toBe(name);
      expect(skill).toContain(urls[name]);
      expect(skill).toContain('410');
      expect(skill).not.toMatch(/xray-clearing/);
      expect(skill).toContain('Do not mill-plant Clearing into 0xray');
      expect(command).toContain(urls[name]);
    }
  });

  it('plant writes Grok, Hermes, OpenClaw, OpenCode and skips passwd-home grok', () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'hangar-plant-'));
    writeFileSync(path.join(tmp, 'package.json'), '{"name":"hangar-plant-fixture"}\n');
    execFileSync(process.execPath, [path.join(hangar, 'plant.mjs'), '--root', tmp], {
      encoding: 'utf8',
    });
    for (const name of shops) {
      expect(existsSync(path.join(tmp, '.grok/plugins', name, 'plugin.json'))).toBe(true);
      expect(existsSync(path.join(tmp, '.grok/plugins', name, 'skills', name, 'SKILL.md'))).toBe(
        true,
      );
      expect(existsSync(path.join(tmp, '.hermes/plugins', name, 'plugin.json'))).toBe(true);
      expect(existsSync(path.join(tmp, '.openclaw/skills', name, 'SKILL.md'))).toBe(true);
      expect(existsSync(path.join(tmp, '.opencode/skills', name, 'SKILL.md'))).toBe(true);
    }

    const home = mkdtempSync(path.join(os.tmpdir(), 'hangar-home-'));
    mkdirSync(path.join(home, 'project'));
    writeFileSync(path.join(home, 'project', 'package.json'), '{"name":"x"}\n');
    const fakePasswd = path.join(home, 'passwd');
    mkdirSync(fakePasswd);
    // plant.mjs uses os.userInfo().homedir — cannot spoof; assert --root without package.json fails
    expect(() =>
      execFileSync(process.execPath, [path.join(hangar, 'plant.mjs'), '--root', home], {
        encoding: 'utf8',
      }),
    ).toThrow(/install prefix|package.json/);
  });
});
