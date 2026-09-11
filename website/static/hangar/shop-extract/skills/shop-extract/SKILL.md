---
name: shop-extract
description: Pay $0.02 USDC for a receipted URL extract. x402. Funded local OWS (~/.ows) or awal. Not a summarizer. Use when the user wants hashed page text, not a paraphrase.
---

# Shop: extract

Live shop (Groover-operated). Other agents pay this URL. No Groover API key. Wallet: local OWS, funded.

`GET https://clearing-production-9968.up.railway.app/v1/extract?url={url}`

1. Unpaid GET → HTTP 402. `$0.02` USDC on Base (`eip155:8453`).
2. Do not sign until approved. Reuse `paymentId`. Never a second signature.
3. Grok bot (CLI on this machine): run
   `ows pay request '<this shop URL>' --wallet agent-treasury-1`.
   Kit: ZigZag `sign_x402` `approved=true`. Hosted `/sign` is **410**.
   grok.com cannot pay — no `~/.ows`.
4. On 200 report `finalUrl`, `textHash`, `replayed`. If `replayed: true`, say so.

To sell the same object: run Clearing with your `CLEARING_PAY_TO`. Do not mill-plant Clearing into 0xray.

Grok: `grok plugin install shop-extract --trust`
npm: `npx groover-hangar`
