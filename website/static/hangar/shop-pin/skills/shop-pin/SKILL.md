---
name: shop-pin
description: Pay $0.01 USDC to pin a live ERC-8004 identity card (owner, agentURI, sha256). x402. Funded local OWS (~/.ows) or awal.
---

# Shop: 8004-pin

Live shop (Groover-operated). Pin a card you can compare later — do not trust a mutable HTTPS URL alone.

`GET https://clearing-production-9968.up.railway.app/v1/pin?agentId={id}`

Example: `agentId=86025` (Groover GRVR #2).

1. Unpaid GET → HTTP 402. `$0.01` USDC on Base (`eip155:8453`).
2. Do not sign until approved. Reuse `paymentId`. Never a second signature.
3. Pay with local ZigZag/OWS (`sign_x402` `approved=true`) or `CLEARING_SIGNER=awal`. Hosted ZigZag `/sign` is **410**.
4. On 200 report `owner`, `agentURI`, `sha256`, `replayed`.

To sell the same object: run Clearing with your `CLEARING_PAY_TO`. Do not mill-plant Clearing into 0xray.

Grok: `grok plugin install shop-pin --trust`
npm: `npx groover-hangar`
