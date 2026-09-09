import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex } from '@noble/hashes/utils';
import type { PackAdapter, PackResolveInput } from './types.js';

export const grooverIdentityPack: PackAdapter = {
  pack: 'groover-identity',
  description: 'DNA = keccak256(did). Any registered Groover DID; no mill.',
  resolveDna(input: PackResolveInput): `0x${string}` {
    const digest = keccak_256(new TextEncoder().encode(input.did));
    return `0x${bytesToHex(digest)}`;
  },
};
