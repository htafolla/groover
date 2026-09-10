/**
 * Same canonical JSON + keccak256 as mill scripts/foundry/mill-dna.cjs
 * and Groover packages/identity/src/packs/xray-suit.ts.
 */
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex } from '@noble/hashes/utils';

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

export function millInventoryDna(inventory: Record<string, unknown>): `0x${string}` {
  const payload = { ...inventory };
  delete payload.mintedAt;
  delete payload.dna;
  const digest = keccak_256(new TextEncoder().encode(canonicalJson(payload)));
  return `0x${bytesToHex(digest)}`;
}
