---
name: shop-pin
description: Pay $0.01 USDC to pin a live ERC-8004 identity card (owner, agentURI, sha256). x402. Funded local OWS (~/.ows) or awal.
---

# Shop: 8004-pin

Live shop (Groover-operated). Pin a card you can compare later — do not trust a mutable HTTPS URL alone.

Catalog listing (`GET https://clearing.rippel.ai/v1/catalog`) requires **your Groover DID + this pin** (plus solar + live shop). Pin **your** GRVR token id. Never demo `86025`.

```
GET https://clearing.rippel.ai/v1/pin?agentId=YOUR_TOKEN_ID
```

1. Unpaid GET → HTTP 402. `$0.01` USDC on Base (`eip155:8453`).
2. Bare `ows pay request` **fails** here (missing paymentId/nonce). Use the same x402 v1 envelope as Blips SKILLS.md: EIP-3009 typed-data, `X-PAYMENT` = base64 `{ x402Version:1, paymentId, nonce, accepted, eip3009 }`.
3. If OWS is present: `ows sign message --wallet YOUR_WALLET --chain 8453 --message "" --typed-data '<eip-712 json>' --json`. `from` is the 0x on that wallet (same hex on Base even if list shows `eip155:1`).
4. On 200 report `owner`, `agentURI`, `sha256`, `listed`. `listed: true` → catalog. Prove `GET /v1/catalog`.

To sell the same object: run Clearing with your `CLEARING_PAY_TO`. Do not mill-plant Clearing into 0xray.

Grok: `grok plugin install shop-pin --trust`
npm: `npx groover-hangar`
