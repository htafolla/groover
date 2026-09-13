/**
 * GRVR identity key + mint prepare. Pack DNA is resolved by adapters
 * in ./packs (new schema = Groover PR).
 */
import { encodeAbiParameters, keccak256 } from 'viem';
import { isCanonicalGrooverDid } from './did.js';
import { getPackAdapter, listPackIds } from './packs/index.js';
import { millInventoryDna } from './packs/xray-suit.js';

export const GRVR_MAX_VARIANT = 16;
/** 0 Unknown (no Dynamo), 1 Dissonant, 2 Unstable, 3 Resonant, 4 Celestial */
export const GRVR_MAX_LEVEL = 5;
export const GRVR_LEVEL_NAMES = ['Unknown', 'Dissonant', 'Unstable', 'Resonant', 'Celestial'] as const;
export type GrvrLevelName = (typeof GRVR_LEVEL_NAMES)[number];
/** Live v5 (on-chain SVG; 16-hex legacy + 64-hex registry DID). Railway GRVR_CONTRACT must match. */
export const GRVR_DEFAULT_CONTRACT = '0x045B35480F289F8f83F53345A0f367875958957a';
export const GRVR_DEFAULT_CHAIN_ID = 8453;
export const GRVR_DEFAULT_RPC = 'https://mainnet.base.org';
/** Sepolia v3 (on-chain SVG). Env GRVR_* overrides. */
export const GRVR_SEPOLIA_CONTRACT = '0x0CEb73b07E1fdF3305cE4d3f6AC3BC28F8Ff8670';
/** Superseded mainnet collections. Do not mint here. */
export const GRVR_V4_MAINNET = '0xD892D6836ab138a5aE4365dcb05Adb296607d6f9';
export const GRVR_V3_MAINNET = '0x6F955cA006E2FE951750cac25372e098D6E89743';
/** 7-arg collections. Do not mint here. */
export const GRVR_V2_MAINNET = '0x7b184bf7B7054A7328a1D7851465c6001Bb2AFb3';
export const GRVR_V2_SEPOLIA = '0x6C61feb8389c99EBf00576E7A110140866C5D9fF';
export const GRVR_V1_MAINNET = '0x0abcd80C929Ff2f6c308958B112b7925801750D7';

export { isCanonicalGrooverDid };

export function inventoryDna(inventory: Record<string, unknown>): `0x${string}` {
  return millInventoryDna(inventory);
}

export function grooverIdentityDna(did: string): `0x${string}` {
  if (!isCanonicalGrooverDid(did)) throw new Error('DID must be did:groover: + 16 or 64 hex');
  return getPackAdapter('groover-identity').resolveDna({ did });
}

export function identityKey(did: string, dna: `0x${string}`): `0x${string}` {
  if (!isCanonicalGrooverDid(did)) throw new Error('DID must be did:groover: + 16 or 64 hex');
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

/** Dynamo 7D composite → GRVR Level id. Same buckets as Vortex UI. */
export function levelFromComposite(composite: number): number {
  if (!Number.isFinite(composite)) throw new Error('fullBox7D must be a finite number');
  if (composite >= 0.95) return 4;
  if (composite >= 0.78) return 3;
  if (composite >= 0.50) return 2;
  return 1;
}

export function levelName(level: number): GrvrLevelName {
  if (!Number.isInteger(level) || level < 0 || level >= GRVR_MAX_LEVEL) {
    throw new Error(`level must be 0..${GRVR_MAX_LEVEL - 1}`);
  }
  return GRVR_LEVEL_NAMES[level];
}

export function assertPack(pack: string): string {
  return getPackAdapter(pack).pack;
}

/** bytes32(0) — contract accepts it; live mint/mirror policy does not. */
export const ZERO_DYNAMO_CITATION = ('0x' + '00'.repeat(32)) as `0x${string}`;

/** Default required. Emergency opt-out only: DYNAMO_MINT_REQUIRED=false. */
export function dynamoMintRequired(): boolean {
  return process.env.DYNAMO_MINT_REQUIRED !== 'false';
}

/** Non-empty 32-byte hex that is not bytes32(0). */
export function hasPassCitation(citation?: string): boolean {
  if (!citation) return false;
  const hex = citation.replace(/^0x/i, '').toLowerCase();
  return /^[0-9a-f]{64}$/.test(hex) && hex !== '00'.repeat(32);
}

export function prepareMintInput(params: {
  did: string;
  pack: string;
  inventory?: Record<string, unknown>;
  inspect?: { ok?: boolean; dna?: string | null };
  payload?: Record<string, unknown>;
  dynamoCitation?: string;
  variant?: number;
  level?: number;
  fullBox7D?: number;
}): {
  did: string;
  dna: `0x${string}`;
  pack: string;
  variant: number;
  identityKey: `0x${string}`;
  dynamoCitation: `0x${string}`;
  level: number;
} {
  if (!isCanonicalGrooverDid(params.did)) throw new Error('DID must be did:groover: + 16 or 64 hex');
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
  let dynamoCitation: `0x${string}` = ZERO_DYNAMO_CITATION;
  if (params.dynamoCitation) {
    const hex = params.dynamoCitation.replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error('dynamoCitation must be 32-byte hex');
    dynamoCitation = `0x${hex.toLowerCase()}`;
  }
  let level: number;
  if (typeof params.level === 'number') {
    level = params.level;
  } else if (typeof params.fullBox7D === 'number') {
    level = levelFromComposite(params.fullBox7D);
  } else {
    level = 0;
  }
  if (!Number.isInteger(level) || level < 0 || level >= GRVR_MAX_LEVEL) {
    throw new Error(`level must be 0..${GRVR_MAX_LEVEL - 1}`);
  }
  return {
    did: params.did,
    dna,
    pack: adapter.pack,
    variant,
    identityKey: key,
    dynamoCitation: dynamoCitation as `0x${string}`,
    level,
  };
}

export { listPackIds };
