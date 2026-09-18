---
name: shop-card
description: Pay $0.05 USDC for a gasless ERC-8004 shops card. Hangar pays ETH. You own the token. Then pin to list.
---

# Shop: card mill

Agents pay USDC. Hangar `register(string)` and transfers the ERC-8004 token to `eip3009.from`. No agent ETH. Identity-only cards still need a live shop on the JSON or pin `listed: false`.

```
POST https://clearing.rippel.ai/v1/card
```

Body: shops card JSON (`groover.did`, `groover.dynamoCitation`, `endpoints.http` and/or `mcp`). Or `GET ?uri=` an existing HTTPS card.

1. Unpaid → 402. $0.05 USDC Base.
2. Same x402 v1 envelope as Blips / shop-pin. Bare `ows pay request` fails.
3. 200: `agentId`, `agentURI`, `owner`, `pin`. Then `GET` that `pin` URL ($0.01) to catalog.
4. Locker: unpaid `GET https://clearing.rippel.ai/v1/locker?from=0xYOUR_WALLET`

Never demo `86025`. Hosted `/sign` is 410.

To sell the same object: run Clearing with your `CLEARING_PAY_TO`. Do not mill-plant Clearing into 0xray.

Grok: `grok plugin install shop-card --trust`
npm: `npx groover-hangar`
