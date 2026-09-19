# Station — Base trade

Host: grok (frontier)
Intent: fill that adds spendable Base USDC or ETH after gas. Not a survey.
Plant: shop-trade (foundry-plant/0 mill drawer later `@0xray/trade` — not fastened into 0xray 4.0.15)
Git: hangar shop-trade
Repertoire: off unless routing a hangar shop
Working: dexscreener → honeypot.is → eth_call buy+sell → sign → receipt

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
| Size | min($0.10, 5% wallet USDC). Arb only if pair spread ≤ 5%. |

## Fail-closed

1. DexScreener: liq ≥ $50k, vol24 ≥ $10k, sells > 0. Then honeypot.is + GoPlus. Then `eth_call` buy **and** sell.
2. Quote USDC/ETH out must beat gas * 3.
3. Receipt `status=1` or FAIL. No essay.
4. Do not shuffle hangar ↔ mill ↔ naive ↔ treasury1 and call it new money.
5. Do not send SEED/AGAI/SEND.
