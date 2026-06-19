#!/usr/bin/env node
/**
 * Operator-local bootstrap: merge local credential_pool.xai-oauth into a remote
 * ~/.hermes/auth.json. Reads credentials from YOUR machine at runtime — nothing
 * is embedded in this file. Do not commit auth.json or patch payloads.
 *
 * Usage:
 *   node deploy/sync-xai-oauth-to-prod.mjs user@host
 *
 * Optional env:
 *   SSH_IDENTITY_FILE  path to SSH private key (uses ssh default/agent if unset)
 */

import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const target = process.argv[2];
if (!target) {
  process.stderr.write('usage: node deploy/sync-xai-oauth-to-prod.mjs user@host\n');
  process.exit(1);
}

function sshIdentityArgs() {
  const identity = process.env.SSH_IDENTITY_FILE?.trim();
  return identity ? ['-i', identity] : [];
}

const localAuthPath = join(homedir(), '.hermes', 'auth.json');
const local = JSON.parse(readFileSync(localAuthPath, 'utf8'));

const poolEntry = local.credential_pool?.['xai-oauth'];
const providerEntry = local.providers?.['xai-oauth'];

if (!poolEntry && !providerEntry) {
  process.stderr.write('local ~/.hermes/auth.json has no xai-oauth credentials\n');
  process.exit(1);
}

const patchPath = join(tmpdir(), `xai-oauth-patch-${randomBytes(4).toString('hex')}.json`);
writeFileSync(patchPath, JSON.stringify({ poolEntry, providerEntry }));

const remoteScriptPath = join(tmpdir(), `merge-xai-oauth-${randomBytes(4).toString('hex')}.mjs`);
writeFileSync(
  remoteScriptPath,
  `import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const patch = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const authPath = join(homedir(), '.hermes', 'auth.json');
const auth = JSON.parse(readFileSync(authPath, 'utf8'));
auth.credential_pool = auth.credential_pool || {};
if (patch.poolEntry) auth.credential_pool['xai-oauth'] = patch.poolEntry;
auth.providers = auth.providers || {};
if (patch.providerEntry) auth.providers['xai-oauth'] = patch.providerEntry;
auth.updated_at = new Date().toISOString();
writeFileSync(authPath, JSON.stringify(auth, null, 2) + '\\n', { mode: 0o600 });
process.stdout.write('merged xai-oauth into ' + authPath + '\\n');
const pool = auth.credential_pool['xai-oauth'];
process.stdout.write('pool entries: ' + (Array.isArray(pool) ? pool.length : pool ? 1 : 0) + '\\n');
`,
);

const remotePatch = `/tmp/xai-oauth-patch-${randomBytes(4).toString('hex')}.json`;
const remoteScript = `/tmp/merge-xai-oauth-${randomBytes(4).toString('hex')}.mjs`;
const identityArgs = sshIdentityArgs();

for (const [local, remote] of [
  [patchPath, remotePatch],
  [remoteScriptPath, remoteScript],
]) {
  const scp = spawnSync('scp', [...identityArgs, local, `${target}:${remote}`], { encoding: 'utf8' });
  if (scp.status !== 0) {
    process.stderr.write(scp.stderr ?? '');
    process.exit(scp.status ?? 1);
  }
}

const ssh = spawnSync(
  'ssh',
  [...identityArgs, target, 'node', remoteScript, remotePatch],
  { encoding: 'utf8' },
);
process.stdout.write(ssh.stdout ?? '');
process.stderr.write(ssh.stderr ?? '');

spawnSync('ssh', [...identityArgs, target, 'rm', '-f', remotePatch, remoteScript], { encoding: 'utf8' });
unlinkSync(patchPath);
unlinkSync(remoteScriptPath);

process.exit(ssh.status ?? 1);