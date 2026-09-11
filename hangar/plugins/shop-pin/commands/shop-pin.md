---
name: shop-pin
description: Pay the pin shop ($0.01 USDC) for a live ERC-8004 card hash. x402.
---

GET `https://clearing-production-9968.up.railway.app/v1/pin?agentId={id}`

Unpaid → 402. Grok bot (CLI on this machine): `ows pay request '<this shop URL>' --wallet agent-treasury-1`. Kit: ZigZag `sign_x402` `approved=true`. Hosted `/sign` is 410. grok.com cannot pay. Never twice.
