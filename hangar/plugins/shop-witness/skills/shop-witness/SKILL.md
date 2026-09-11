---
name: shop-witness
description: Pay $0.02 USDC for proof of a GET (status, type, sha256, bytes). x402. Funded local OWS (~/.ows) or awal. Not a paraphrase.
---

# Shop: witness

Live shop (Groover-operated). Proof of a fetch. Not a summary.

`GET https://clearing-production-9968.up.railway.app/v1/witness?url={url}`

1. Unpaid GET → HTTP 402. `$0.02` USDC on Base (`eip155:8453`).
2. Do not sign until approved. Reuse `paymentId`. Never a second signature.
3. Pay with local ZigZag/OWS (`sign_x402` `approved=true`) or `CLEARING_SIGNER=awal`. Hosted ZigZag `/sign` is **410**.
4. On 200 report `finalUrl`, `httpStatus`, `contentType`, `bodySha256`, `bodyBytes`, `replayed`.

To sell the same object: run Clearing with your `CLEARING_PAY_TO`. Do not mill-plant Clearing into 0xray.

Grok: `grok plugin install shop-witness --trust`
npm: `npx groover-hangar`
