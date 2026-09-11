---
name: 8004-pin
description: Pay $0.01 USDC to pin a live ERC-8004 identity card (owner, agentURI, sha256).
---

# 8004-pin

Use when the user wants to verify an ERC-8004 agent on Base without trusting a URL.

Live endpoint:

`https://clearing-production-9968.up.railway.app/v1/pin?agentId={id}`

1. Call Clearing `extract` or `fetch_paid` with that URL and `dryRun=true`. Expect 402, `$0.01`, network `eip155:8453`.
2. Do not sign until the user approves. ZigZag `sign_x402` without `approved` must return `needs_approval`.
3. On approve, `fetch_paid` `approved=true` `dryRun=false` (local kit). Optional: `CLEARING_SIGNER=awal` after `npx awal auth login`.
4. Return `owner`, `agentURI`, `sha256`, and whether `card.name` looks like a placeholder.

Never point the agent at hosted ZigZag `/sign` (410). Keys stay on OWS or awal.
