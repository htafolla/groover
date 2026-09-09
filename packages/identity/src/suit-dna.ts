/**
 * GRVR identity key + mint prepare. Pack DNA is resolved by adapters
 * in ./packs (new schema = Groover PR).
 */
import { encodeAbiParameters, keccak256 } from 'viem';
import { getPackAdapter, listPackIds } from './packs/index.js';
import { millInventoryDna } from './packs/xray-suit.js';

export const GRVR_MAX_VARIANT = 16;
export const GRVR_DEFAULT_CONTRACT = '0x0abcd80C929Ff2f6c308958B112b7925801750D7';
export const GRVR_DEFAULT_CHAIN_ID = 8453;
export const GRVR_DEFAULT_RPC = 'https://mainnet.base.org';
/** Sepolia collection. Env GRVR_* overrides if still pointed here. */
export const GRVR_SEPOLIA_CONTRACT = '0xFc644D08cd98f11BB952a4E9b04f5Ad0b312D683';

const DID_RE = /^did:groover:[0-9a-fA-F]{16}$/;

export function isCanonicalGrooverDid(did: string): boolean {
  return typeof did === 'string' && did.length === 28 && DID_RE.test(did);
}

export function inventoryDna(inventory: Record<string, unknown>): `0x${string}` {
  return millInventoryDna(inventory);
}

export function grooverIdentityDna(did: string): `0x${string}` {
  if (!isCanonicalGrooverDid(did)) throw new Error('DID must be did:groover: + 16 hex');
  return getPackAdapter('groover-identity').resolveDna({ did });
}

export function identityKey(did: string, dna: `0x${string}`): `0x${string}` {
  if (!isCanonicalGrooverDid(did)) throw new Error('DID must be did:groover: + 16 hex');
  if (!/^0x[0-9a-fA-F]{64}$/.test(dna)) throw new Error('dna must be 32-byte hex');
  return keccak256(
    encodeAbiParameters(
      [{ type: 'string' }, { type: 'bytes32' }],
      [did, dna.toLowerCase() as `0x${string}`],
    ),
  );
}

export function variantFromKey(key: `0x${string}`): number {
  return Number(BigInt(key) % BigInt(GRVR_MAX_VARIANT));
}

export function assertPack(pack: string): string {
  return getPackAdapter(pack).pack;
}

export function prepareMintInput(params: {
  did: string;
  pack: string;
  inventory?: Record<string, unknown>;
  inspect?: { ok?: boolean; dna?: string | null };
  payload?: Record<string, unknown>;
  dynamoCitation?: string;
  variant?: number;
}): {
  did: string;
  dna: `0x${string}`;
  pack: string;
  variant: number;
  identityKey: `0x${string}`;
  dynamoCitation: `0x${string}`;
} {
  if (!isCanonicalGrooverDid(params.did)) throw new Error('DID must be did:groover: + 16 hex');
  const adapter = getPackAdapter(params.pack);
  const dna = adapter.resolveDna({
    did: params.did,
    inventory: params.inventory,
    inspect: params.inspect,
    payload: params.payload,
  });
  const key = identityKey(params.did, dna);
  const variant =
    typeof params.variant === 'number' ? params.variant : variantFromKey(key);
  if (!Number.isInteger(variant) || variant < 0 || variant >= GRVR_MAX_VARIANT) {
    throw new Error(`variant must be 0..${GRVR_MAX_VARIANT - 1}`);
  }
  let dynamoCitation = '0x' + '00'.repeat(32);
  if (params.dynamoCitation) {
    const hex = params.dynamoCitation.replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error('dynamoCitation must be 32-byte hex');
    dynamoCitation = `0x${hex.toLowerCase()}`;
  }
  return {
    did: params.did,
    dna,
    pack: adapter.pack,
    variant,
    identityKey: key,
    dynamoCitation: dynamoCitation as `0x${string}`,
  };
}

export { listPackIds };
