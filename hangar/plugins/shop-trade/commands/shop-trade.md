---
name: shop-trade
description: Wear the Base trading plant. Simulate then swap. Quote is not a fill.
---

Read `hangar/plugins/shop-trade/skills/shop-trade/SKILL.md` and `hangar/TRADE-STATION.md`.

Pacer: `node hangar/plugins/shop-trade/pace.mjs` only.
Fills: `WALLET=… SIDE=buy|sell MARKET=AERO|TOSHI node hangar/plugins/shop-trade/base-fill.mjs` only.
Do not write `/tmp/pacer-*.mjs` or `/tmp/swap-*.mjs`. Do not mill-plant into 0xray.
