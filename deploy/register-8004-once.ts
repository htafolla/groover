/**
 * One-shot ERC-8004 IdentityRegistry register / setAgentURI.
 * Reads GRVR_PRIVATE_KEY from env (Railway registry). Never logs the key.
 *
 *   npx tsx deploy/register-8004-once.ts register
 *   AGENT_ID=86025 npx tsx deploy/register-8004-once.ts set-uri
 *
 * Blinky (GRVR token 1, already registered as agent 86556) — after website
 * deploy serves the static files, ops only:
 *
 *   GRVR_TOKEN_ID=1 AGENT_ID=86556 npx tsx deploy/register-8004-once.ts set-uri
 *
 * AGENT_ID=86556 alone also selects the grvr-1 website URLs.
 * Do not re-register. Do not redeploy GRVR.
 */
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { resolveRegistrationCard, resolveSetUriTarget } from './register-8004-cards.js';

const REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as const;
const RPC = process.env.GRVR_RPC_URL || 'https://mainnet.base.org';

const abi = [
  {
    type: 'function',
    name: 'register',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'setAgentURI',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'newURI', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'Registered',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'agentURI', type: 'string', indexed: false },
      { name: 'owner', type: 'address', indexed: true },
    ],
  },
] as const;

function minterKey(): Hex {
  const raw = process.env.GRVR_PRIVATE_KEY;
  if (!raw || !raw.trim()) throw new Error('GRVR_PRIVATE_KEY missing');
  const hex = (raw.startsWith('0x') ? raw : `0x${raw}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) throw new Error('GRVR_PRIVATE_KEY not 32-byte hex');
  return hex;
}

async function main(): Promise<void> {
  const mode = process.argv[2] || 'register';
  const account = privateKeyToAccount(minterKey());
  const transport = http(RPC);
  const wallet = createWalletClient({ account, chain: base, transport });
  const publicClient = createPublicClient({ chain: base, transport });
  process.stdout.write(`from ${account.address} mode=${mode}\n`);

  if (mode === 'register') {
    const card = resolveRegistrationCard();
    process.stdout.write(`card token=${card.tokenId} uri=${card.v1}\n`);
    const hash = await wallet.writeContract({
      address: REGISTRY,
      abi,
      functionName: 'register',
      args: [card.v1],
      account,
      chain: base,
    });
    process.stdout.write(`tx ${hash}\n`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('register reverted');
    let agentId = '';
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi, data: log.data, topics: log.topics });
        if (decoded.eventName === 'Registered') {
          const args = decoded.args as { agentId?: bigint };
          if (args.agentId !== undefined) agentId = args.agentId.toString();
        }
      } catch {
        /* not this event */
      }
    }
    if (!agentId) throw new Error('Registered event missing agentId');
    process.stdout.write(`agentId ${agentId}\n`);
    return;
  }

  if (mode === 'set-uri') {
    const target = resolveSetUriTarget();
    process.stdout.write(
      `card token=${target.card.tokenId} agentId=${target.agentId} uri=${target.uri}\n`,
    );
    const hash = await wallet.writeContract({
      address: REGISTRY,
      abi,
      functionName: 'setAgentURI',
      args: [BigInt(target.agentId), target.uri],
      account,
      chain: base,
    });
    process.stdout.write(`tx ${hash}\n`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('setAgentURI reverted');
    process.stdout.write(`setAgentURI ok agentId=${target.agentId}\n`);
    return;
  }

  throw new Error(`unknown mode ${mode}`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
