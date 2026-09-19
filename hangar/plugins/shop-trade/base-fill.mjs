#!/usr/bin/env node
/**
 * Uniform Base fill. Agents run THIS — do not write /tmp/swap-*.mjs.
 *
 *   WALLET=ziggy-user-1775937444074 SIDE=buy MARKET=AERO USDC=60000 \
 *     node hangar/plugins/shop-trade/scripts/base-fill.mjs
 *   WALLET=... SIDE=sell MARKET=AERO node ...
 *
 * SIDE=buy needs USDC atomic (6 dp). SIDE=sell sells entire MARKET bag.
 * Simulate (eth_call) before send. Honeypot revert → exit 2, no broadcast.
 */
import { spawnSync } from 'node:child_process';
import {
  createPublicClient,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  http,
  keccak256,
  parseAbi,
  serializeTransaction,
  toHex,
} from 'viem';
import { base } from 'viem/chains';

const RPC = process.env.RPC || 'https://mainnet.base.org';
const WALLET = process.env.WALLET;
const SIDE = (process.env.SIDE || '').toLowerCase();
const MARKET = (process.env.MARKET || 'AERO').toUpperCase();
const USDC_IN = BigInt(process.env.USDC || '0');

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const WETH = '0x4200000000000000000000000000000000000006';
const MARKETS = {
  AERO: {
    token: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
    kind: 'aero',
    router: '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43',
    factory: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',
    stable: false,
  },
  TOSHI: {
    token: '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4',
    kind: 'v3',
    router: '0x2626664c2603336E57B271c5C0b26F421741e481',
    buyPath: encodePacked(
      ['address', 'uint24', 'address', 'uint24', 'address'],
      [USDC, 500, WETH, 10000, '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4'],
    ),
    sellPath: encodePacked(
      ['address', 'uint24', 'address', 'uint24', 'address'],
      ['0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4', 10000, WETH, 500, USDC],
    ),
  },
};

if (!WALLET || (SIDE !== 'buy' && SIDE !== 'sell') || !MARKETS[MARKET]) {
  process.stderr.write('usage: WALLET=ows-name SIDE=buy|sell MARKET=AERO|TOSHI [USDC=atomic] node base-fill.mjs\n');
  process.exit(1);
}

const mkt = MARKETS[MARKET];
const client = createPublicClient({ chain: base, transport: http(RPC) });
const erc20 = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
]);
const pairAbi = parseAbi([
  'function token0() view returns (address)',
  'function getReserves() view returns (uint112,uint112,uint32)',
  'function getAmountOut(uint256 amountIn, address tokenIn) view returns (uint256)',
  'function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes data)',
]);
const routerAbi = parseAbi([
  'function exactInput((bytes path,address recipient,uint256 amountIn,uint256 amountOutMinimum)) payable returns (uint256)',
]);
const aeroAbi = parseAbi([
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, (address from, address to, bool stable, address factory)[] routes, address to, uint256 deadline) returns (uint256[])',
]);

function ows(args) {
  const r = spawnSync('ows', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'ows').slice(0, 400));
  return r.stdout.trim();
}

function walletAddress() {
  const out = ows(['wallet', 'list']);
  const block = out.split(/(?=ID:)/).find((b) => b.includes(`Name: ${WALLET}`) || b.includes(WALLET));
  const m = block && block.match(/0x[a-fA-F0-9]{40}/);
  if (!m) throw new Error(`no 0x for wallet ${WALLET}`);
  return m[0];
}

function getAmountOut(amountIn, reserveIn, reserveOut) {
  const a = amountIn * 997n;
  const out = (a * reserveOut) / (reserveIn * 1000n + a);
  return out > 2n ? out - 2n : 0n;
}

async function sendTx(from, { to, data, gas }) {
  const nonce = await client.getTransactionCount({ address: from, blockTag: 'pending' });
  const fees = await client.estimateFeesPerGas();
  const unsigned = serializeTransaction({
    type: 'eip1559',
    chainId: 8453,
    nonce,
    to,
    data,
    value: 0n,
    gas,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  const raw = ows([
    'sign', 'send-tx', '--wallet', WALLET, '--chain', '8453',
    '--rpc-url', RPC, '--tx', unsigned, '--json',
  ]);
  const j = JSON.parse(raw);
  const hash = j.tx_hash || j.hash;
  if (!hash) throw new Error(`no hash ${raw.slice(0, 200)}`);
  for (let i = 0; i < 40; i++) {
    const rec = await client.getTransactionReceipt({ hash }).catch(() => null);
    if (rec) {
      if (rec.status !== 'success') throw new Error(`revert ${hash}`);
      return hash;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`no receipt ${hash}`);
}

async function callOk(from, { to, data }) {
  try {
    await client.call({ account: from, to, data });
    return true;
  } catch {
    return false;
  }
}

function mappingSlot(holder, slot) {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }],
      [holder, BigInt(slot)],
    ),
  );
}

/** Isolated pair.swap always reverts — tokens are not on the pair yet. Push tokenIn via stateOverride. */
async function callSwapWithPush(from, swap, tokenIn, amountIn) {
  const pairBal = await client.readContract({
    address: tokenIn,
    abi: erc20,
    functionName: 'balanceOf',
    args: [mkt.pair],
  });
  const slots = tokenIn.toLowerCase() === USDC.toLowerCase() ? [9, 0] : [0, 9];
  for (const slot of slots) {
    try {
      await client.call({
        account: from,
        to: swap.to,
        data: swap.data,
        stateOverride: [
          {
            address: tokenIn,
            stateDiff: [
              {
                slot: mappingSlot(mkt.pair, slot),
                value: toHex(pairBal + amountIn, { size: 32 }),
              },
            ],
          },
        ],
      });
      return true;
    } catch {
      /* try next slot */
    }
  }
  return false;
}

async function quoteV2(amountIn, tokenIn, reserveIn, reserveOut) {
  try {
    return await client.readContract({
      address: mkt.pair,
      abi: pairAbi,
      functionName: 'getAmountOut',
      args: [amountIn, tokenIn],
    });
  } catch {
    return getAmountOut(amountIn, reserveIn, reserveOut);
  }
}

const from = walletAddress();
const hashes = [];

if (mkt.kind === 'aero') {
  const tokenIn = SIDE === 'buy' ? USDC : mkt.token;
  const tokenOut = SIDE === 'buy' ? mkt.token : USDC;
  const amountIn =
    SIDE === 'buy'
      ? USDC_IN
      : await client.readContract({ address: mkt.token, abi: erc20, functionName: 'balanceOf', args: [from] });
  if (amountIn <= 0n) throw new Error(SIDE === 'buy' ? 'USDC atomic required' : 'empty bag');
  const allowance = await client.readContract({
    address: tokenIn,
    abi: erc20,
    functionName: 'allowance',
    args: [from, mkt.router],
  });
  if (allowance < amountIn) {
    const approve = {
      to: tokenIn,
      data: encodeFunctionData({ abi: erc20, functionName: 'approve', args: [mkt.router, amountIn] }),
      gas: 80_000n,
    };
    if (!(await callOk(from, approve))) {
      process.stdout.write(`${JSON.stringify({ ok: false, reason: 'approve eth_call revert' })}\n`);
      process.exit(2);
    }
    hashes.push(await sendTx(from, approve));
  }
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 180);
  const swap = {
    to: mkt.router,
    data: encodeFunctionData({
      abi: aeroAbi,
      functionName: 'swapExactTokensForTokens',
      args: [
        amountIn,
        0n,
        [{ from: tokenIn, to: tokenOut, stable: mkt.stable, factory: mkt.factory }],
        from,
        deadline,
      ],
    }),
    gas: 250_000n,
  };
  if (!(await callOk(from, swap))) {
    process.stdout.write(`${JSON.stringify({ ok: false, reason: 'router eth_call revert' })}\n`);
    process.exit(2);
  }
  hashes.push(await sendTx(from, swap));
} else if (mkt.kind === 'v2') {
  const token0 = await client.readContract({ address: mkt.pair, abi: pairAbi, functionName: 'token0' });
  const [r0, r1] = await client.readContract({ address: mkt.pair, abi: pairAbi, functionName: 'getReserves' });
  const tokenIs0 = token0.toLowerCase() === mkt.token.toLowerCase();
  const usdcIs0 = token0.toLowerCase() === USDC.toLowerCase();
  if (SIDE === 'buy') {
    if (USDC_IN <= 0n) throw new Error('USDC atomic required for buy');
    const reserveIn = usdcIs0 ? r0 : r1;
    const reserveOut = usdcIs0 ? r1 : r0;
    const quoted = await quoteV2(USDC_IN, USDC, reserveIn, reserveOut);
    const out = (quoted * 99n) / 100n;
    const amount0Out = tokenIs0 ? out : 0n;
    const amount1Out = tokenIs0 ? 0n : out;
    const transfer = {
      to: USDC,
      data: encodeFunctionData({ abi: erc20, functionName: 'transfer', args: [mkt.pair, USDC_IN] }),
      gas: 80_000n,
    };
    const swap = {
      to: mkt.pair,
      data: encodeFunctionData({
        abi: pairAbi,
        functionName: 'swap',
        args: [amount0Out, amount1Out, from, '0x'],
      }),
      gas: 180_000n,
    };
    if (!(await callOk(from, transfer))) {
      process.stdout.write(`${JSON.stringify({ ok: false, reason: 'eth_call revert (honeypot or empty)' })}\n`);
      process.exit(2);
    }
    hashes.push(await sendTx(from, transfer));
    if (!(await callOk(from, swap))) {
      process.stderr.write('eth_call swap after transfer failed; broadcasting (tokens already on pair)\n');
    }
    hashes.push(await sendTx(from, swap));
  } else {
    const bag = await client.readContract({ address: mkt.token, abi: erc20, functionName: 'balanceOf', args: [from] });
    if (bag === 0n) throw new Error('empty bag');
    const reserveIn = tokenIs0 ? r0 : r1;
    const reserveOut = tokenIs0 ? r1 : r0;
    const quoted = await quoteV2(bag, mkt.token, reserveIn, reserveOut);
    const out = (quoted * 99n) / 100n;
    const amount0Out = usdcIs0 ? out : 0n;
    const amount1Out = usdcIs0 ? 0n : out;
    const transfer = {
      to: mkt.token,
      data: encodeFunctionData({ abi: erc20, functionName: 'transfer', args: [mkt.pair, bag] }),
      gas: 80_000n,
    };
    const swap = {
      to: mkt.pair,
      data: encodeFunctionData({
        abi: pairAbi,
        functionName: 'swap',
        args: [amount0Out, amount1Out, from, '0x'],
      }),
      gas: 180_000n,
    };
    if (!(await callOk(from, transfer))) {
      process.stdout.write(`${JSON.stringify({ ok: false, reason: 'eth_call revert' })}\n`);
      process.exit(2);
    }
    hashes.push(await sendTx(from, transfer));
    if (!(await callOk(from, swap))) {
      process.stderr.write('eth_call swap after transfer failed; broadcasting (tokens already on pair)\n');
    }
    hashes.push(await sendTx(from, swap));
  }
} else {
  const path = SIDE === 'buy' ? mkt.buyPath : mkt.sellPath;
  const amountIn =
    SIDE === 'buy'
      ? USDC_IN
      : await client.readContract({ address: mkt.token, abi: erc20, functionName: 'balanceOf', args: [from] });
  if (amountIn <= 0n) throw new Error(SIDE === 'buy' ? 'USDC atomic required' : 'empty bag');
  const spend = SIDE === 'buy' ? USDC : mkt.token;
  const allowance = await client.readContract({
    address: spend,
    abi: erc20,
    functionName: 'allowance',
    args: [from, mkt.router],
  });
  if (allowance < amountIn) {
    const approve = {
      to: spend,
      data: encodeFunctionData({ abi: erc20, functionName: 'approve', args: [mkt.router, amountIn] }),
      gas: 80_000n,
    };
    if (!(await callOk(from, approve))) process.exit(2);
    hashes.push(await sendTx(from, approve));
  }
  const swap = {
    to: mkt.router,
    data: encodeFunctionData({
      abi: routerAbi,
      functionName: 'exactInput',
      args: [{ path, recipient: from, amountIn, amountOutMinimum: 0n }],
    }),
    gas: 250_000n,
  };
  if (!(await callOk(from, swap))) {
    process.stdout.write(`${JSON.stringify({ ok: false, reason: 'eth_call revert' })}\n`);
    process.exit(2);
  }
  hashes.push(await sendTx(from, swap));
}

process.stdout.write(`${JSON.stringify({ ok: true, wallet: WALLET, from, side: SIDE, market: MARKET, hashes }, null, 2)}\n`);
