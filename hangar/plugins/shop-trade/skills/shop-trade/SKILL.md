---
name: shop-trade
description: >-
  Base trading plant agents wear. Quote then simulate then ows send-tx.
  Dumped from a 4.44m swarm: Uniswap V2 pair-hop, SEED honeypot.
---

# Shop: trade (Base)

Not an x402 hangar SKU. Foundry plant agents **wear** so they can fill without a 50-wallet census.

Do **not** mill-plant this into 0xray 4.0.15. Fasten is foundry-plant/0; a future mill package `@0xray/trade` would declare this skill. Until then: `npx groover-hangar` shop-trade plugin.

## What the swarm learned (pass 1)

- Shuffle (ETH/USDC among our four) is easy. New money is not.
- Treasury1 wrote a Uniswap V2 **pair hop** (no router): `token.transfer(pair, amountIn)` → `pair.swap(amount0Out, amount1Out, to, 0x)` → `WETH.withdraw`.
- Mill **quoted** 9 SEED → ~0.026 USDC > gas, then **on-chain revert**. `balanceOf` shows 9; `transfer`/`transferFrom` revert (`TRANSFER_FROM_FAILED` / exceeds balance). **Quote is not a fill. Honeypot.**
- Approve can succeed and swap still die. Simulate the swap `eth_call` from the signer.

## Base constants

```
chainId        8453
USDC           0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
WETH           0x4200000000000000000000000000000000000006
SEED           0x350cC56c6fAF933FB5e3a48c61Ab3653CE9d77Df
SEED/WETH pair 0x4D8c812808E14f5c08EB1Ad5700eED0c7c31C7De
```

Uniswap V2 amountOut: `amountIn * 997 * reserveOut / (reserveIn * 1000 + amountIn * 997)`. token0/token1 order from `pair.token0()`.

## Execute (one fill)

1. Read `hangar/TRADE-STATION.md`.
2. Reserves + `getAmountOut`. If out ≤ gas×3 → FAIL (no tx).
3. `eth_call` `token.transfer(pair, amountIn)` as this wallet. Revert → honeypot, FAIL.
4. `eth_call` `pair.swap(...)`. Revert → FAIL.
5. `ows sign send-tx --wallet WALLET --chain 8453 --rpc-url https://mainnet.base.org --json` unsigned eip1559 (viem `serializeTransaction`). Never print mnemonic.
6. Wait receipt. `status!=1` → FAIL. Do not retry honeypot.
7. Prove: dest USDC or ETH up by more than gas. Log tx hash.

## Do not

Census 50 OWS wallets. Merkl essays. Shuffle our hangar/mill/naive/treasury1. Pay clearing.rippel.ai and call it PnL. Trust `balanceOf` alone.

## Prove

One Base tx hash with receipt 1 and Δ(USDC or ETH) > gas. Or explicit FAIL (honeypot / no pool).
