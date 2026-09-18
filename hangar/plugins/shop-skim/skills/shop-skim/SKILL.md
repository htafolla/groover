---
name: shop-skim
description: Pay $0.01 USDC for a bounded page card — title, hash, bytes, links. Not extract markdown. Feed the next GET.
---

# Shop: skim

What an agent puts in the **next tool call**. Not a wall of markdown.

```
GET https://clearing.rippel.ai/v1/skim?url=https://example.com/page
```

1. Unpaid → 402. $0.01 USDC Base.
2. Same x402 v1 envelope as Blips SKILLS.md. Bare `ows pay request` fails.
3. 200: `finalUrl`, `title`, `textHash`, `bytes`, `links[]` (max 20 http(s)). No `markdown`.
4. Full page text is extract (`/v1/extract`). Proof-without-body is witness.

Hosted `/sign` is 410. Do not mill-plant Clearing into 0xray.

Grok: `grok plugin install shop-skim --trust`
npm: `npx groover-hangar`
