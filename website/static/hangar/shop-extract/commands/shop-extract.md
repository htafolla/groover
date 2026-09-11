---
name: shop-extract
description: Pay the extract shop ($0.02 USDC) for a receipted URL. x402. Not a summary.
---

GET `https://clearing-production-9968.up.railway.app/v1/extract?url={url}`

Unpaid → 402. Grok bot (CLI on this machine): `ows pay request '<this shop URL>' --wallet agent-treasury-1`. Kit: ZigZag `sign_x402` `approved=true`. Hosted `/sign` is 410. grok.com cannot pay. Never twice.
