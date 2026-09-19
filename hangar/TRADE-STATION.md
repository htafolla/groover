# Station — Base trade

Host: grok (frontier)
Intent: fill that adds spendable Base USDC or ETH after gas. Not a survey.
Plant: shop-trade (foundry-plant/0 mill drawer later `@0xray/trade` — not fastened into 0xray 4.0.15)
Git: hangar shop-trade
Repertoire: off unless routing a hangar shop
Working: simulate → sign → send → receipt

Continue this card. Do not cold-start a 50-wallet census.

## Known Base

| | |
|--|--|
| chain | 8453 |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |
| Uniswap V2 pair hop | transfer token into pair, `pair.swap`, unwrap WETH |
| SEED (swarm) | `0x350cC56c6fAF933FB5e3a48c61Ab3653CE9d77Df` pair `0x4D8c812808E14f5c08EB1Ad5700eED0c7c31C7De` — **honeypot**: quote ok, `transfer` reverts |

## Fail-closed

1. `eth_call` the exact `transfer`/`swap` from this wallet. Revert → do not send.
2. Quote USDC/ETH out must beat gas * 3.
3. Receipt `status=1` or FAIL. No essay.
4. Do not shuffle hangar ↔ mill ↔ naive ↔ treasury1 and call it new money.
