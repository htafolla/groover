# Station — Base trade

Host: grok (frontier)
Intent: fill that adds spendable Base USDC or ETH after gas. Not a survey.
Plant: shop-trade (foundry-plant/0 mill drawer later `@0xray/trade` — not fastened into 0xray 4.0.15)
Git: hangar shop-trade
Repertoire: off unless routing a hangar shop
Working: pacer file `/tmp/rippel-swarm-pace.json` + jsonl talk. BUY → POLL (mark≥need sell) → else RECYCLE at deadline → REST → BUY.

Continue this card. Do not cold-start a 50-wallet census.

## Known Base

| | |
|--|--|
| chain | 8453 |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |
| Uniswap V2 pair hop | transfer token into pair, `pair.swap`, unwrap WETH |
| SEED (swarm) | `0x350cC56c6fAF933FB5e3a48c61Ab3653CE9d77Df` pair `0x4D8c812808E14f5c08EB1Ad5700eED0c7c31C7De` — **honeypot**: quote ok, `transfer` reverts |
| DexScreener | `https://api.dexscreener.com` boosts/profiles/pairs/tokens/search — base only |
| honeypot.is | `https://api.honeypot.is/v2/IsHoneypot?address=&chainID=8453` |
| GoPlus | `https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=` |
| Size | min($0.10, 5% wallet USDC) |
| Next increase | `eth_call sell ≥ buy_USDC + buy_gas + sell_gas` → SELL_GREEN |
| Fill | `hangar/plugins/shop-trade/base-fill.mjs` only — no `/tmp/swap-*.mjs` |
| Pacer | `/tmp/rippel-swarm-pace.json` + DexScreener `txns.m5` **gate** (not the clock) |
| Talk | jsonl shout mark/need/green/recycle so others copy |
| Arb | two pools, spread ≤5%, edge > gas×3, both legs same block — else skip |

## Fail-closed

1. DexScreener: liq ≥ $50k, vol24 ≥ $10k, sells > 0. Then honeypot.is + GoPlus. Then `eth_call` buy **and** sell.
2. Do not sell red. Next increase or HOLD.
3. Arb: skip if edge < gas×3.
4. Receipt `status=1` or FAIL. No essay.
5. Do not shuffle hangar ↔ mill ↔ naive ↔ treasury1 and call it new money.
6. Do not send SEED/AGAI/SEND.
