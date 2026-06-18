/**
 * Load platform .env files without adding a dotenv dependency.
 * Searched in order; later files do not override already-set process.env keys.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GROOVER_ROOT = join(__dirname, '..');

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const eq = trimmed.indexOf('=');
  if (eq <= 0) return null;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, 'utf8').split('\n');
  for (const line of lines) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }
}

/** Load .env from groover root, siblings, and optional XRAY_ROOT / REPERTOIRE_ROOT. */
export function loadPlatformEnv(): void {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  const candidates = [
    join(GROOVER_ROOT, '.env'),
    join(GROOVER_ROOT, '..', 'repertoire', '.env'),
    join(GROOVER_ROOT, '..', 'xray', '.env'),
    join(GROOVER_ROOT, '..', '.env'),
    home ? join(home, '.hermes', '.env') : '',
  ].filter(Boolean);

  for (const path of candidates) {
    loadEnvFile(path);
  }

  if (process.env.XRAY_ROOT) loadEnvFile(join(process.env.XRAY_ROOT, '.env'));
  if (process.env.REPERTOIRE_ROOT) loadEnvFile(join(process.env.REPERTOIRE_ROOT, '.env'));
}