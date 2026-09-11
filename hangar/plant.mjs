#!/usr/bin/env node
/**
 * Plant the three 402 shops into Grok / Hermes / OpenClaw / OpenCode.
 * Run from a project root: npx groover-hangar
 * Never writes passwd-home ~/.grok/plugins.
 * Does not mill-plant Clearing into 0xray.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const hangarRoot = path.dirname(fileURLToPath(import.meta.url));
const shops = ['shop-extract', 'shop-witness', 'shop-pin'];

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function passwdHome() {
  try {
    return os.userInfo().homedir;
  } catch {
    return os.homedir();
  }
}

function isPasswdHome(dir) {
  return path.resolve(dir) === path.resolve(passwdHome());
}

function isInstallPrefix(dir) {
  const resolved = path.resolve(dir);
  if (resolved.includes(`${path.sep}_npx${path.sep}`) || resolved.endsWith(`${path.sep}_npx`)) {
    return true;
  }
  return !fs.existsSync(path.join(resolved, 'package.json'));
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  fs.copyFileSync(src, dest);
}

function plantShop(root, name) {
  const plugin = path.join(hangarRoot, 'plugins', name);
  const skillSrc = path.join(plugin, 'skills', name, 'SKILL.md');
  const pluginJson = path.join(plugin, 'plugin.json');
  const commandSrc = path.join(plugin, 'commands', `${name}.md`);
  if (!fs.existsSync(skillSrc)) fail(`missing ${skillSrc}`);

  copyFile(skillSrc, path.join(root, '.opencode', 'skills', name, 'SKILL.md'));
  copyFile(skillSrc, path.join(root, '.hermes', 'plugins', name, 'skills', name, 'SKILL.md'));
  copyFile(pluginJson, path.join(root, '.hermes', 'plugins', name, 'plugin.json'));
  copyFile(skillSrc, path.join(root, '.openclaw', 'skills', name, 'SKILL.md'));

  if (isPasswdHome(root)) {
    process.stdout.write(`skip .grok plant for ${name} — cwd is passwd home\n`);
    return;
  }
  const grokPlugin = path.join(root, '.grok', 'plugins', name);
  copyFile(pluginJson, path.join(grokPlugin, 'plugin.json'));
  copyFile(skillSrc, path.join(grokPlugin, 'skills', name, 'SKILL.md'));
  if (fs.existsSync(commandSrc)) {
    copyFile(commandSrc, path.join(grokPlugin, 'commands', `${name}.md`));
  }
}

const rootFlag = process.argv.indexOf('--root');
const root =
  rootFlag >= 0 && process.argv[rootFlag + 1]
    ? path.resolve(process.argv[rootFlag + 1])
    : path.resolve(process.cwd());

if (isInstallPrefix(root) && !process.argv.includes('--force')) {
  fail('refusing install prefix / missing package.json (pass --root <project> or --force)');
}

for (const name of shops) plantShop(root, name);
process.stdout.write('planted shop-extract, shop-witness, shop-pin (Grok, Hermes, OpenClaw, OpenCode)\n');
process.stdout.write('Grok: grok plugin marketplace add htafolla/groover && grok plugin install shop-extract --trust\n');
