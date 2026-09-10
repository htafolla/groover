#!/usr/bin/env node
/**
 * Load this mill plant into a project and into the CLI.
 * Run from your repo root:  node mill-plant/install.mjs
 * Optional: --from factory-config.json   --mint
 * Never writes passwd-home ~/.grok/plugins/0xray.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const plant = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.cwd());
const args = new Set(process.argv.slice(2));

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

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(rel, value) {
  if (!value || typeof value !== 'object') return;
  const dest = path.join(root, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, `${JSON.stringify(value, null, 2)}\n`);
  process.stdout.write(`wrote ${rel}\n`);
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function loadFactoryConfig() {
  const fromFlag = process.argv.indexOf('--from');
  const named =
    fromFlag >= 0 && process.argv[fromFlag + 1]
      ? path.resolve(root, process.argv[fromFlag + 1])
      : path.join(root, 'factory-config.json');
  const packed = readJson(named);
  if (packed && typeof packed === 'object') {
    return {
      inventory: packed.inventory || readJson(path.join(root, 'foundry-inventory.json')),
      features: packed.features ?? readJson(path.join(root, 'features.json')),
      config: packed.config ?? readJson(path.join(root, 'config.json')),
      codex: packed.codex ?? readJson(path.join(root, 'codex.json')),
    };
  }
  return {
    inventory: readJson(path.join(root, 'foundry-inventory.json')),
    features: readJson(path.join(root, 'features.json')),
    config: readJson(path.join(root, 'config.json')),
    codex: readJson(path.join(root, 'codex.json')),
  };
}

function fastenPlant() {
  const skillNames = ['mill', 'inspect'];
  const skillDirs = [
    path.join(root, '.opencode', 'skills'),
    path.join(root, '.hermes', 'plugins', 'xray-hermes', 'skills'),
    path.join(root, '.openclaw', 'skills'),
  ];
  if (!isPasswdHome(root)) {
    skillDirs.push(path.join(root, '.grok', 'plugins', '0xray', 'skills'));
  } else {
    process.stdout.write('skip .grok plant — cwd is passwd home\n');
  }
  for (const name of skillNames) {
    const src = path.join(plant, 'skills', name, 'SKILL.md');
    if (!fs.existsSync(src)) fail(`missing mill plant skill ${name}`);
    for (const dir of skillDirs) {
      copyFile(src, path.join(dir, name, 'SKILL.md'));
    }
  }
  const agentsDest = path.join(root, '.opencode', 'agents');
  for (const file of ['mill.yml', 'inspect.yml']) {
    const src = path.join(plant, 'agents', file);
    if (!fs.existsSync(src)) fail(`missing mill plant agent ${file}`);
    copyFile(src, path.join(agentsDest, file));
  }
  process.stdout.write('fastened mill+inspect plant\n');
}

function writeConfigs(bundle) {
  const inventory = bundle.inventory;
  const params =
    inventory && typeof inventory === 'object' && inventory.params && typeof inventory.params === 'object'
      ? inventory.params
      : {
          codex: 'xray/codex.json',
          features: 'xray/features.json',
          config: 'xray/config.json',
        };
  writeJson('.xray/foundry-inventory.json', inventory);
  if (bundle.features) {
    writeJson(typeof params.features === 'string' ? params.features : 'xray/features.json', bundle.features);
    writeJson('.xray/features.json', bundle.features);
  }
  if (bundle.config) {
    writeJson(typeof params.config === 'string' ? params.config : 'xray/config.json', bundle.config);
    writeJson('.xray/config.json', bundle.config);
  }
  if (bundle.codex) {
    writeJson(typeof params.codex === 'string' ? params.codex : 'xray/codex.json', bundle.codex);
    writeJson('.xray/codex.json', bundle.codex);
  }
}

function installCli() {
  process.stdout.write('npm i -D @0xray/foundry\n');
  const result = spawnSync('npm', ['i', '-D', '@0xray/foundry'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) fail('npm i -D @0xray/foundry failed');
}

function runMill(cmd) {
  const result = spawnSync('npx', ['@0xray/foundry', cmd], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) fail(`npx @0xray/foundry ${cmd} failed`);
}

if (!fs.existsSync(path.join(plant, 'skills', 'mill', 'SKILL.md'))) {
  fail('run from a checkout that still has mill-plant/skills');
}

const bundle = loadFactoryConfig();
fastenPlant();
writeConfigs(bundle);
if (!args.has('--skip-npm')) installCli();
if (args.has('--mint')) {
  runMill('mint');
  runMill('inspect');
} else {
  process.stdout.write('\nLoaded. Next:\n  npx @0xray/foundry mint\n  npx @0xray/foundry inspect\n');
}
