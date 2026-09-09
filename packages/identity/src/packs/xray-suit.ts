import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex } from '@noble/hashes/utils';
import type { PackAdapter, PackResolveInput } from './types.js';

/** Same canonical JSON as mill `scripts/foundry/mill-dna.cjs`. */
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

export const xraySuitPack: PackAdapter = {
  pack: '0xray-suit',
  description: 'DNA = keccak256(canonical mill inventory without mintedAt/dna). Requires inspect.ok.',
  resolveDna(input: PackResolveInput): `0x${string}` {
    if (!input.inventory || typeof input.inventory !== 'object') {
      throw new Error('0xray-suit requires mill inventory');
    }
    if (!input.inspect || input.inspect.ok !== true) {
      throw new Error('0xray-suit requires inspect.ok');
    }
    const dna = millInventoryDna(input.inventory);
    if (input.inspect.dna && input.inspect.dna.toLowerCase() !== dna.toLowerCase()) {
      throw new Error('inspect.dna does not match inventory DNA');
    }
    return dna;
  },
};
