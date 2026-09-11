/**
 * GRVR → ERC-8004 identity mirror (stage 1). Never throws into the mint path.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { frameworkLogger } from '../../xray/src/index.js';

export const IDENTITY_REGISTRY_BASE =
  '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
export const IDENTITY_REGISTRY_BASE_SEPOLIA =
  '0x8004A818BFB912233c491871b3d84c89A494BD9e';

export type MirrorMintInput = {
  did: string;
  dna: string;
  pack: string;
  variant: number;
  identityKey: string;
  grvrContract: string;
  grvrTokenId: string;
  dynamoCitation?: string;
  level: number;
  chainId?: number;
};

export type RegistrationFile = {
  type: string;
  name: string;
  description: string;
  image: string;
  services: Array<{ name: string; endpoint: string; version: string }>;
  x402Support: boolean;
  active: boolean;
  supportedTrust: string[];
  groover: Record<string, string | number>;
  registrations?: Array<{ agentId: string; agentRegistry: string }>;
};

export function mirrorEnabled(): boolean {
  return process.env.MIRROR_8004_ENABLED === 'true';
}

export function identityRegistry(chainId: number): `0x${string}` {
  const override = process.env.MIRROR_8004_IDENTITY_REGISTRY;
  if (override && /^0x[0-9a-fA-F]{40}$/.test(override)) {
    return override as `0x${string}`;
  }
  return (chainId === 84532
    ? IDENTITY_REGISTRY_BASE_SEPOLIA
    : IDENTITY_REGISTRY_BASE) as `0x${string}`;
}

export function agentRegistryId(chainId: number): string {
  return `eip155:${chainId}:${identityRegistry(chainId)}`;
}

export function didShort(did: string): string {
  const hex = did.replace(/^did:groover:/, '').slice(0, 12);
  return hex || 'unknown';
}

export function buildRegistrationV1(input: MirrorMintInput): RegistrationFile {
  const chainId = input.chainId ?? 8453;
  const name = `groover-${didShort(input.did)}`;
  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name,
    description: `Groover identity mark for ${input.did}. Pack ${input.pack}, variant ${input.variant}. Grounded issuance: DNA + inspect attestation + Dynamo governance citation, mirrored from GRVR token ${input.grvrTokenId}.`,
    image: `https://registry-production-e2c4.up.railway.app/identity/token-image/${input.grvrTokenId}`,
    services: [
      { name: 'DID', endpoint: input.did, version: 'v1' },
      {
        name: 'GRVR',
        endpoint: `eip155:${chainId}:${input.grvrContract}/${input.grvrTokenId}`,
        version: 'v1',
      },
    ],
    x402Support: false,
    active: false,
    supportedTrust: ['groover-provenance'],
    groover: {
      did: input.did,
      dna: input.dna,
      pack: input.pack,
      variant: String(input.variant),
      identityKey: input.identityKey,
      grvrContract: input.grvrContract,
      grvrTokenId: input.grvrTokenId,
      dynamoCitation: input.dynamoCitation ?? 'none',
      level: String(input.level),
      grvrChainId: chainId,
    },
  };
}

export function buildRegistrationV2(
  input: MirrorMintInput,
  agentId: string,
): RegistrationFile {
  const chainId = input.chainId ?? 8453;
  const v1 = buildRegistrationV1(input);
  return {
    ...v1,
    active: true,
    registrations: [{ agentId, agentRegistry: agentRegistryId(chainId) }],
  };
}

export function writeRegistrationFiles(
  dir: string,
  input: MirrorMintInput,
  agentId?: string,
): { v1Path: string; v2Path?: string } {
  mkdirSync(dir, { recursive: true });
  const v1Path = path.join(dir, `grvr-${input.grvrTokenId}-v1.json`);
  writeFileSync(v1Path, `${JSON.stringify(buildRegistrationV1(input), null, 2)}\n`);
  if (!agentId) return { v1Path };
  const v2Path = path.join(dir, `grvr-${input.grvrTokenId}-v2.json`);
  writeFileSync(v2Path, `${JSON.stringify(buildRegistrationV2(input, agentId), null, 2)}\n`);
  return { v1Path, v2Path };
}

export async function mirrorGrvrMint(input: MirrorMintInput): Promise<{
  skipped?: string;
  v1Path?: string;
}> {
  if (!mirrorEnabled()) {
    return { skipped: 'MIRROR_8004_ENABLED is not true' };
  }
  if (!input.grvrTokenId) {
    frameworkLogger.log('identity', 'mirror-8004-fail', 'warn', { step: 'no-tokenId' });
    return { skipped: 'no-tokenId' };
  }
  try {
    const dir =
      process.env.MIRROR_8004_FILE_DIR ||
      path.join(process.cwd(), 'data', 'identity', 'registration');
    const written = writeRegistrationFiles(dir, input);
    frameworkLogger.log('identity', 'mirror-8004-file', 'info', {
      v1Path: written.v1Path,
      tokenId: input.grvrTokenId,
    });
    return written;
  } catch (err) {
    frameworkLogger.log('identity', 'mirror-8004-fail', 'warn', {
      step: 'file',
      error: err instanceof Error ? err.message : String(err),
    });
    return { skipped: 'file-error' };
  }
}
