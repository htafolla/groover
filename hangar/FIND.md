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
| Dynamo Hammer (MCP) | https://hammer.rippel.ai |
| Dynamo well-known | https://hammer.rippel.ai/.well-known/agent-card.json |
| Dynamo (BLURRN site, not MCP) | https://dynamo.rippel.ai |

Shops: `/v1/extract` `/v1/skim` `/v1/witness` `/v1/pin` `/v1/card` `/v1/blip`

House 8004 ids: **86556**, **86666**. Registry `eip155:8453:0x8004A169FB4a3325136EB29Fa0Ceb6d2E539a432`.

## Register (keep these live)

1. Catalog — pin + Groover DID + solar + live shop on rippel.ai
2. `/.well-known/x402` resources[] from catalog (rippel.ai URLs)
3. `/.well-known/agent-card.json` + `agent-registration.json`
4. `/openapi.json` all paid paths (x402scan prefers this)
5. CDP Bazaar — 402 quotes already carry bazaar extension; index needs a settle through CDP (not ZigZag). Until then, well-known + OpenAPI + 402 ping are the public SYN. Groover JSON well-known is live; Groover is still not in CDP Bazaar / Virtuals.

Do not publish `*.up.railway.app` in cards, SKILLS, well-known, or catalogs.

## After each ship (listings)

When a mill, shop, or skill lands, do this **in the same cut** — not later:

1. **Deploy** the host that serves it (`railway up` or GitHub auto-deploy).
2. **npm** if a package version moved (`groover-hangar`, `@0xray/blip`, `@0xray/foundry`). OTP is the mill.
3. **Ping** unpaid:
   - `GET https://<host>/.well-known/agent-card.json` → JSON 200, no `railway.app`
   - shops: `GET` → **402**
   - `GET https://clearing.rippel.ai/v1/catalog`
4. **Catalog** — if a new hangar shop, pin + DID so it appears.
5. **Bazaar** — only after a CDP settle (needs CDP keys). Until then, well-known + OpenAPI is the public SYN.

Internal Railway URLs may exist. **Listings never use them.**

## Gaps — what is needed (you vs mill)

| Gap | Status | Needed from you |
|-----|--------|-----------------|
| **Dynamo card** | MCP public host is **`https://hammer.rippel.ai`**. `dynamo.rippel.ai` stays BLURRN HTML. | CNAME is live. Well-known JSON ships with the mill deploy. |
| **Plant** | Well-known is in `blip-plant-svc/server.mjs`. No `plant.rippel.ai`. | DNS: CNAME **`plant.rippel.ai`** → `blip-plant` Railway. Set `PLANT_PUBLIC_ORIGIN=https://plant.rippel.ai`. We deploy the mill. |
| **Registry mill** | Same Railway service as Groover. Public host is already **`groover.rippel.ai`**. Skills still print `registry-production-e2c4.up.railway.app`. | None for DNS. We retarget skills at `https://groover.rippel.ai/mcp` (same store). |
| **CDP Bazaar** | Quotes already have bazaar metadata. `index: null` until **CDP facilitator settle**. ZigZag pay does not list us. | **CDP API key** (`CDP_API_KEY_ID` + `SECRET`) on Clearing, **or** one paid skim/extract through CDP (verify+settle with `paymentPayload.resource`). First 1k tx/mo free. Then wait up to hours for index. |
| **Virtuals ACP** | Different handshake (ACP **jobs**, not 402). Register at [app.virtuals.io/acp/join](https://app.virtuals.io/acp/join). | **Your wallet in the browser**: Join ACP → Register Provider/Hybrid → offering that wraps Clearing shops. Optional. Not required for x402 find/ping. |
| **0xray 7 MCPs** | `npx 0xray mcp …` — local suit, not a hangar. | Nothing. Do not catalog as shops. Optional: A2A card on the docs host `https://0xrayai.github.io/xray/` pointing at llms.txt. |
| **ZigZag** | Facilitator, not a shop. No `zigzag.rippel.ai`. | Optional DNS CNAME if you want a public facilitator URL. Not a catalog hangar. |
