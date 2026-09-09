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
  prepareMintInput,
} from './suit-dna.js';

const abiPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../abi/GrooverIdentityToken.json');

function loadAbi(): readonly unknown[] {
  return JSON.parse(readFileSync(abiPath, 'utf8')) as unknown[];
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
  const abi = loadAbi();
  const hash = await wallet.writeContract({
    address: prepared.contract,
    abi: abi as never,
    functionName: 'mint',
    args: [
      prepared.to,
      prepared.did,
      prepared.dna,
      prepared.pack,
      prepared.variant,
      prepared.dynamoCitation,
    ],
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
  const abi = loadAbi();
  try {
    const data = (await publicClient.readContract({
      address: grvrContract(),
      abi: abi as never,
      functionName: 'getTokenData',
      args: [tokenId],
    })) as {
      did: string;
      dna: `0x${string}`;
      pack: string;
      variant: number;
    };
    if (!data?.did || !data?.pack) return null;
    return {
      tokenId: tokenId.toString(),
      did: data.did,
      pack: data.pack,
      variant: Number(data.variant),
      dna: data.dna,
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
