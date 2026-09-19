# Trade mill swarm — stop report

Stopped mid cycle **3/4 POLL**. Pacer `pace.mjs` killed. Four wallet sessions cancelled.

## What worked

- Foundry loop: field fail → plant (`shop-trade`, `TRADE-STATION.md`, `base-fill.mjs`, `pace.mjs`) → wear again. Same as blip, not an xray 4.0.16 PR.
- Honeypot in the suit (DexScreener + honeypot.is + GoPlus + `eth_call`). SEED/AGAI/SEND never should have been a fill.
- Screened fills that **did** land: AERO (Aerodrome) and TOSHI (Uni V3) **status 1** on hangar/mill/naive/treasury1.
- Next-increase rule: **HOLD** when `mark < cost+gas`. No red dump that round.
- Clock in the mill is **180s**, not 12 min. `pace.mjs` is the pacer (not an LLM writing `/tmp`).

## Issues

1. **Pair-hop two-tx donated bags.** `transfer` to the pair then `pair.swap` is not atomic. Naive/hangar/treasury1 AERO went to the pool; USDC did not come back. Mill TOSHI (router) was the only clean recycle. **Fix in suit:** Aerodrome router one swap (approve only if needed).
2. **Agents still author scripts.** Pacer and traders wrote `/tmp/swap-*.mjs` and poll parsers instead of only `pace.mjs` + `base-fill.mjs`. jsonl became 120 lines of `pace tick`. Talk should be one line per fill, not a heartbeat.
3. **Pacer clock vs process time.** Mill window = 180s. LLM pacer was told to live 12 min “watching tape,” so BUY never opened. User expected a tick every 3 min.
4. **Tape gate too tight.** `m5.buys===0` skipped 6 min while AERO m5 had **$6.5k vol / 37 sells**. h1 TOSHI had **21 buys**. Gate now: m5.buys **or** vol.m5 **or** h1.buys.
5. **Size vs gas.** Tickets $0.012–0.06; buy+sell gas ~30–60% of notional. `mark ≥ cost+gas` almost cannot print. 30s poll < AERO avg up-run (~88s). Next-increase needs dollars not cents, or a longer poll.
6. **Inspect dump vs profit mill.** Forced same-window sell locked **−$0.02**. Then HOLD forever starved the loop. Need one rule: green sell **or** pacer **RECYCLE** at 180s so capital returns — not both “never dump red” and “must loop.”
7. **Approve + swap is still two txs** the first time. User asked “no 2 tnx.” Pair-hop is gone; first-fill approve remains. Max-approve once, then one swap.
8. **No combined report.** Four sessions exit separately. Hangar missed cycle-1 recycle (`poll parse`). No single inspect receipt until this file.

## PnL (order of magnitude)

Start ~**$2.20 USDC** + dust ETH. Screened buys then sells ≈ **flat minus gas (~$0.02)** plus **AERO bags donated** on the bad hop (not returned as USDC). Not a growth mill at this size.

## Plant to keep

| File | Role |
|------|------|
| `hangar/plugins/shop-trade/base-fill.mjs` | Router fill only |
| `hangar/plugins/shop-trade/pace.mjs` | 4×180s clock + tape gate |
| `TRADE-STATION.md` | Continuity card |

## Next mill pass (not run)

- Traders: **only** `base-fill.mjs` / `pace.mjs`. No `search_replace` on swap code.
- One 180s: BUY (if tape open) → POLL → SELL_GREEN or RECYCLE. No leftover bag.
- Size so gas < ~5% of ticket, or drop next-increase until then.
- jsonl: one JSON per action (`buy`/`sell`/`skip`/`green`/`recycle`), not ticks.
