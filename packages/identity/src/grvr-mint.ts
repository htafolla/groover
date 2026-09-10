/**
 * Chain mint for GrooverIdentityToken. MINTER_ROLE key stays on Railway env.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEventLogs,
  type Hex,
  type TransactionReceipt,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { frameworkLogger } from '../../xray/src/index.js';
import { composeIdentitySvg, type TokenView } from './compositor.js';
import {
  GRVR_DEFAULT_CHAIN_ID,
  GRVR_DEFAULT_CONTRACT,
  GRVR_DEFAULT_RPC,
  GRVR_SEPOLIA_CONTRACT,
  prepareMintInput,
} from './suit-dna.js';

const abiDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../abi');

/** v1 mainnet — superseded. Do not mint. Treated as 7-arg (not on-chain SVG). */
const GRVR_V1_MAINNET = '0x0abcd80C929Ff2f6c308958B112b7925801750D7';

const LEGACY_SEVEN_ARG_CONTRACTS = new Set([
  GRVR_DEFAULT_CONTRACT.toLowerCase(),
  GRVR_SEPOLIA_CONTRACT.toLowerCase(),
  GRVR_V1_MAINNET.toLowerCase(),
]);

/** False for live v2, Sepolia v2, and superseded v1 (case-insensitive). True for a new v3 address. */
export function mintWantsOnchainSvg(contract: string): boolean {
  return !LEGACY_SEVEN_ARG_CONTRACTS.has(contract.toLowerCase());
}

/** Strip control chars (< 0x20) so on-chain imageSvg passes InvalidImage. */
export function compactSvg(svg: string): string {
  let out = '';
  for (let i = 0; i < svg.length; i += 1) {
    if (svg.charCodeAt(i) >= 0x20) out += svg[i];
  }
  return out;
}

function loadAbi(onchainSvg: boolean): readonly unknown[] {
  const file = onchainSvg ? 'GrooverIdentityToken.v3.json' : 'GrooverIdentityToken.json';
  return JSON.parse(readFileSync(path.join(abiDir, file), 'utf8')) as unknown[];
}

export function grvrChain() {
  const id = Number(process.env.GRVR_CHAIN_ID || GRVR_DEFAULT_CHAIN_ID);
  const rpc = process.env.GRVR_RPC_URL || GRVR_DEFAULT_RPC;
  return defineChain({
    id,
    name: id === 8453 ? 'base' : 'base-sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  });
}

export function grvrContract(): `0x${string}` {
  const addr = (process.env.GRVR_CONTRACT || GRVR_DEFAULT_CONTRACT) as `0x${string}`;
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) throw new Error('GRVR_CONTRACT is not an address');
  return addr;
}

/** Only GRVR_PRIVATE_KEY. Leftover DEPLOYER_PRIVATE_KEY must not broadcast. */
export function minterKey(): Hex | null {
  const raw = process.env.GRVR_PRIVATE_KEY;
  if (!raw || !raw.trim()) return null;
  const hex = (raw.startsWith('0x') ? raw : `0x${raw}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) throw new Error('GRVR minter key must be 32-byte hex');
  return hex;
}

export function tokenIdFromMintReceipt(
  receipt: Pick<TransactionReceipt, 'status' | 'logs'>,
  abi: readonly unknown[],
): string {
  if (receipt.status !== 'success') {
    throw new Error('GRVR mint reverted');
  }
  const minted = parseEventLogs({
    abi: abi as never,
    logs: receipt.logs,
    eventName: 'IdentityMinted',
  });
  const first = minted[0] as { args?: { tokenId?: bigint | number | string } } | undefined;
  const tokenId = first?.args?.tokenId;
  if (tokenId === undefined || tokenId === null) {
    throw new Error('GRVR mint produced no tokenId');
  }
  return tokenId.toString();
}

export function prepareGrvrMint(params: {
  did: string;
  pack: string;
  to?: string;
  inventory?: Record<string, unknown>;
  inspect?: { ok?: boolean; dna?: string | null };
  payload?: Record<string, unknown>;
  dynamoCitation?: string;
  variant?: number;
  level?: number;
  fullBox7D?: number;
}) {
  const prepared = prepareMintInput(params);
  const to = params.to;
  if (to && !/^0x[0-9a-fA-F]{40}$/.test(to)) throw new Error('to must be a 20-byte address');
  return { ...prepared, to: to as `0x${string}` | undefined, contract: grvrContract() };
}

export async function mintGrvrIdentity(params: {
  did: string;
  pack: string;
  to: string;
  inventory?: Record<string, unknown>;
  inspect?: { ok?: boolean; dna?: string | null };
  payload?: Record<string, unknown>;
  dynamoCitation?: string;
  variant?: number;
  level?: number;
  fullBox7D?: number;
  dryRun?: boolean;
}): Promise<{
  dryRun: boolean;
  did: string;
  dna: `0x${string}`;
  pack: string;
  variant: number;
  identityKey: `0x${string}`;
  contract: `0x${string}`;
  to: `0x${string}`;
  level: number;
  txHash?: `0x${string}`;
  tokenId?: string;
}> {
  const prepared = prepareGrvrMint(params);
  if (!prepared.to) throw new Error('to address required to mint');
  const payload = {
    dryRun: Boolean(params.dryRun) || !minterKey(),
    did: prepared.did,
    dna: prepared.dna,
    pack: prepared.pack,
    variant: prepared.variant,
    identityKey: prepared.identityKey,
    contract: prepared.contract,
    to: prepared.to,
    level: prepared.level,
  };
  if (payload.dryRun) {
    frameworkLogger.log('identity', 'grvr-mint-dry-run', 'info', {
      did: payload.did,
      pack: payload.pack,
      contract: payload.contract,
    });
    return payload;
  }
  const key = minterKey();
  if (!key) throw new Error('GRVR_PRIVATE_KEY not set');
  const account = privateKeyToAccount(key);
  const chain = grvrChain();
  const transport = http(process.env.GRVR_RPC_URL || GRVR_DEFAULT_RPC);
  const wallet = createWalletClient({ account, chain, transport });
  const publicClient = createPublicClient({ chain, transport });
  const onchainSvg = mintWantsOnchainSvg(prepared.contract);
  const abi = loadAbi(onchainSvg);
  const seven: readonly (string | number | `0x${string}`)[] = [
    prepared.to,
    prepared.did,
    prepared.dna,
    prepared.pack,
    prepared.variant,
    prepared.dynamoCitation,
    prepared.level,
  ];
  let mintArgs = seven;
  if (onchainSvg) {
    const supply = (await publicClient.readContract({
      address: prepared.contract,
      abi: abi as never,
      functionName: 'totalSupply',
    })) as bigint;
    const nextId = supply + 1n;
    const imageSvg = compactSvg(
      composeIdentitySvg({
        tokenId: String(nextId),
        did: prepared.did,
        pack: prepared.pack,
        variant: prepared.variant,
        dna: prepared.dna,
        level: prepared.level,
      }),
    );
    mintArgs = [...seven, imageSvg];
  }
  const hash = await wallet.writeContract({
    address: prepared.contract,
    abi: abi as never,
    functionName: 'mint',
    args: mintArgs as never,
    chain,
    account,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const tokenId = tokenIdFromMintReceipt(receipt, abi);
  frameworkLogger.log('identity', 'grvr-minted', 'success', {
    txHash: hash,
    status: receipt.status,
    tokenId,
    did: prepared.did,
  });
  return { ...payload, dryRun: false, txHash: hash, tokenId };
}

export function parseTokenIdParam(raw: string): bigint | null {
  const id = (raw || '').split('?')[0].replace(/[^0-9]/g, '');
  if (!id || id === '0') return null;
  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

export async function loadGrvrTokenView(tokenId: bigint): Promise<TokenView | null> {
  const chain = grvrChain();
  const publicClient = createPublicClient({
    chain,
    transport: http(process.env.GRVR_RPC_URL || GRVR_DEFAULT_RPC),
  });
  const contract = grvrContract();
  const abi = loadAbi(mintWantsOnchainSvg(contract));
  try {
    const data = (await publicClient.readContract({
      address: contract,
      abi: abi as never,
      functionName: 'getTokenData',
      args: [tokenId],
    })) as {
      did: string;
      dna: `0x${string}`;
      pack: string;
      variant: number;
      level?: number;
    };
    if (!data?.did || !data?.pack) return null;
    return {
      tokenId: tokenId.toString(),
      did: data.did,
      pack: data.pack,
      variant: Number(data.variant),
      dna: data.dna,
      level: Number(data.level ?? 0),
    };
  } catch {
    return null;
  }
}

export async function renderIdentityTokenImage(raw: string): Promise<{
  status: number;
  body: string;
  contentType: string;
}> {
  const tokenId = parseTokenIdParam(raw);
  if (tokenId === null) {
    return { status: 400, body: 'invalid tokenId', contentType: 'text/plain' };
  }
  const view = await loadGrvrTokenView(tokenId);
  if (!view) {
    return { status: 404, body: 'token not minted', contentType: 'text/plain' };
  }
  return {
    status: 200,
    body: composeIdentitySvg(view),
    contentType: 'image/svg+xml',
  };
}
