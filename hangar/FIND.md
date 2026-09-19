# Find and ping

Hangar discovery. Public hostnames are **`*.rippel.ai`**, never `*.up.railway.app`.

## Layers (TCP analog)

| Layer | What | SYN |
|-------|------|-----|
| ERC-8004 | Address. `agentId` + `tokenURI` | `tokenURI(id)` then GET the card |
| x402 Bazaar | Shop yellow pages | Unpaid GET shop → **402** |
| Clearing catalog | Hangar hosts file | `GET https://clearing.rippel.ai/v1/catalog` |
| A2A Agent Card | Peer after you have a host | `GET https://clearing.rippel.ai/.well-known/agent-card.json` |
| Groover well-known | Registry JSON (not the MCP banner) | `GET https://groover.rippel.ai/.well-known/agent-card.json` |

8004 does not search. Bazaar lists URLs, not hangars. Catalog is hangar law (DID + pin + live shop). Ping a shop = unpaid GET expecting **402**. Catalog and well-known are unpaid **200**. Groover `/.well-known/*` is real JSON now. Still not in CDP Bazaar / Virtuals.

## Our hosts (advertise these)

| Service | URL |
|---------|-----|
| Hangar shops | https://clearing.rippel.ai |
| Catalog | https://clearing.rippel.ai/v1/catalog |
| Well-known x402 | https://clearing.rippel.ai/.well-known/x402 |
| A2A card | https://clearing.rippel.ai/.well-known/agent-card.json |
| 8004 domain proof | https://clearing.rippel.ai/.well-known/agent-registration.json |
| OpenAPI | https://clearing.rippel.ai/openapi.json |
| MCP | https://clearing.rippel.ai/mcp |
| Desk | https://blips.rippel.ai |
| Desk SKILLS | https://blips.rippel.ai/SKILLS.md |
| Groover | https://groover.rippel.ai |
| Groover MCP | https://groover.rippel.ai/mcp |
| Groover well-known x402 | https://groover.rippel.ai/.well-known/x402 |
| Groover A2A card | https://groover.rippel.ai/.well-known/agent-card.json |
| Groover agent.json | https://groover.rippel.ai/.well-known/agent.json |
| Groover 8004 domain proof | https://groover.rippel.ai/.well-known/agent-registration.json |
| Dynamo | https://dynamo.rippel.ai |

Shops: `/v1/extract` `/v1/skim` `/v1/witness` `/v1/pin` `/v1/card` `/v1/blip`

House 8004 ids: **86556**, **86666**. Registry `eip155:8453:0x8004A169FB4a3325136EB29Fa0Ceb6d2E539a432`.

## Register (keep these live)

1. Catalog — pin + Groover DID + solar + live shop on rippel.ai
2. `/.well-known/x402` resources[] from catalog (rippel.ai URLs)
3. `/.well-known/agent-card.json` + `agent-registration.json`
4. `/openapi.json` all paid paths (x402scan prefers this)
5. CDP Bazaar — 402 quotes already carry bazaar extension; index needs a settle through CDP (not ZigZag). Until then, well-known + OpenAPI + 402 ping are the public SYN. Groover JSON well-known is live; Groover is still not in CDP Bazaar / Virtuals.

Do not publish `*.up.railway.app` in cards, SKILLS, well-known, or catalogs.
