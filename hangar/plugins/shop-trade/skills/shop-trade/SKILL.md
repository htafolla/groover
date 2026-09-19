---
name: shop-trade
description: >-
  Base trading plant agents wear. Quote then simulate then ows send-tx.
  Dumped from a 4.44m swarm: Uniswap V2 pair-hop, SEED honeypot.
  Honeypot screen is DexScreener + honeypot.is + GoPlus, then eth_call.
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

## Honeypot (DexScreener first — tack, not a second mill)

SEED/AGAI/SEND taught: `balanceOf` lies. Screen **before** simulate.

1. **DexScreener** (no key):
   - Top/boosts: `GET https://api.dexscreener.com/token-boosts/top/v1` keep `chainId=base`
   - Profiles: `GET https://api.dexscreener.com/token-profiles/latest/v1` keep base
   - Pair: `GET https://api.dexscreener.com/latest/dex/pairs/base/{pairId}`
   - Token: `GET https://api.dexscreener.com/tokens/v1/base/{token}`
   - Search: `GET https://api.dexscreener.com/latest/dex/search?q={symbol}`
   Drop if: chain ≠ base, liquidity.usd < 50000, volume.h24 < 10000, `txns.h24.sells` is 0 (DexScreener `no_sells_24h` = honeypot flag).
2. **honeypot.is**: `GET https://api.honeypot.is/v2/IsHoneypot?address={token}&chainID=8453` — skip if `honeypotResult.isHoneypot` or simulation fails.
3. **GoPlus**: `GET https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses={token}` — skip if `is_honeypot` ≠ `"0"`, buy/sell tax > 5.
4. **eth_call** buy **and** sell (round trip) from this wallet. Either revert → FAIL. Do not send.

Start list (liquid Base memes): TOSHI, DEGEN, BRETT, HIGHER, AERO — still run 1–4. Never SEED/AGAI/SEND.

## 5% arb / size

- **Arb:** two DexScreener pairs same token, `|priceUsd_a - priceUsd_b| / mid ≤ 0.05`. Buy cheap pool, sell rich pool, size so out > gas×3.
- **Size cap:** `min($0.10, 5% of this wallet's USDC)`. Not a moonshot.
- **PnL:** receipt 1 and Δ USDC or ETH > gas (a filled buy of a screened meme counts as a trade; shuffle hangar↔mill does not).

## Execute (one fill)

1. Read `hangar/TRADE-STATION.md`.
2. DexScreener + honeypot.is + GoPlus. Fail-closed.
3. Reserves + `getAmountOut`. If out ≤ gas×3 → FAIL (no tx).
4. `eth_call` buy and sell as this wallet. Revert → honeypot, FAIL.
5. `ows sign send-tx --wallet WALLET --chain 8453 --rpc-url https://mainnet.base.org --json` unsigned eip1559 (viem `serializeTransaction`). Never print mnemonic.
6. Wait receipt. `status!=1` → FAIL. Do not retry honeypot.
7. Prove: dest USDC or ETH up by more than gas, **or** a screened meme buy filled (status 1). Log tx hash. Shout token/pair/router on `/tmp/rippel-swarm-newmoney.jsonl` so others copy.

## Do not

Census 50 OWS wallets. Merkl essays. Shuffle our hangar/mill/naive/treasury1. Pay clearing.rippel.ai and call it PnL. Trust `balanceOf` alone.

## Prove

One Base tx hash with receipt 1 and Δ(USDC or ETH) > gas. Or explicit FAIL (honeypot / no pool).
