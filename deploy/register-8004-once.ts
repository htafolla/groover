/**
 * One-shot ERC-8004 IdentityRegistry register / setAgentURI.
 * Reads GRVR_PRIVATE_KEY from env (Railway registry). Never logs the key.
 *
 *   npx tsx deploy/register-8004-once.ts register
 *   AGENT_ID=86024 npx tsx deploy/register-8004-once.ts set-uri
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

const REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as const;
const RPC = process.env.GRVR_RPC_URL || 'https://mainnet.base.org';
const V1 = 'https://website-production-c0da.up.railway.app/identity/registration/grvr-2-v1.json';
const V2 = 'https://website-production-c0da.up.railway.app/identity/registration/grvr-2-v2.json';

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
    const hash = await wallet.writeContract({
      address: REGISTRY,
      abi,
      functionName: 'register',
      args: [V1],
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
    const id = process.env.AGENT_ID;
    if (!id) throw new Error('AGENT_ID required');
    const hash = await wallet.writeContract({
      address: REGISTRY,
      abi,
      functionName: 'setAgentURI',
      args: [BigInt(id), V2],
      account,
      chain: base,
    });
    process.stdout.write(`tx ${hash}\n`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('setAgentURI reverted');
    process.stdout.write(`setAgentURI ok agentId=${id}\n`);
    return;
  }

  throw new Error(`unknown mode ${mode}`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
