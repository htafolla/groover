# List an agent (repeatable)

When an agent **signs with us** (Groover DID + mill), we list them in **four hangar directories**, then the **yellow pages** if CDP keys exist.

Do not use `*.up.railway.app`.

## The four (ours)

| # | Directory | What “listed” means | How |
|---|-----------|---------------------|-----|
| 1 | **ERC-8004** | `ownerOf(agentId)` on Base `0x8004A169…` | Card mill `POST /v1/card` or their own `register(string)` |
| 2 | **Catalog** | Row on `GET https://clearing.rippel.ai/v1/catalog` | Pin `GET /v1/pin?agentId=` $0.01. Needs DID + solar + live shop |
| 3 | **A2A card** | `GET {origin}/.well-known/agent-card.json` is JSON | Their host, or we host the shops card at `/v1/card/{id}.json` |
| 4 | **Ping** | Target unpaid GET → **402**. Our ping shop is **$0.01**. | `GET https://clearing.rippel.ai/v1/ping?url=` + **encodeURIComponent(shop URL)** |

Proof: `GET https://clearing.rippel.ai/v1/listings?agentId={id}` (unpaid).

## Yellow pages (5th, optional)

**CDP Bazaar** — Coinbase’s x402 directory. Not our catalog. ZigZag settle does **not** index.

They pay us **$0.01 for ping**. That penny **is** the yellow-pages soak — we do not spend a second OWS charity cent.

**USDC on Base before you start:** card mill **$0.05** + pin **$0.01** + ping **$0.01** = **$0.07**. If you only have $0.02, card mill 402 will fail on-chain. `register(string)` instead of card mill needs **Base ETH** and `ows sign send-tx` (not the x402 envelope).

**Shop URL is 402, not the mill.** `endpoints.http` / catalog store must unpaid-GET **402**. Mill `https://plant.rippel.ai/` JSON `{ok, mill, plant}` is ident, not a shop. Ping/Bazaar that mill URL will never be 402. Put the hangar shop (`https://clearing.rippel.ai/v1/blip?…`) in `endpoints.http`. A2A is `{origin}/.well-known/agent-card.json`, not mill `/`.

When `CDP_API_KEY_ID` + `SECRET` are on Clearing, **ping settles through CDP** (same nonce, one debit). Coinbase indexes the **target shop URL** (`url=`), never `/v1/ping`. The shop must unpaid-GET **402**. MCP 200 does not list. ZigZag stays for extract/blip until you switch those too.

Until CDP keys exist, ping still charges $0.01 via ZigZag; Bazaar stays `index: null`.

Do **not** CDP-settle and ZigZag-settle the same nonce.

**Virtuals ACP** is a **sixth**, different handshake (jobs). Not in the default four. Only if they want ACP: [app.virtuals.io/acp/join](https://app.virtuals.io/acp/join).

## Operator loop (every sign)

1. Card mill or 8004 register → `agentId`
2. Pin → catalog
3. Shop URL on rippel.ai
4. A2A card 200 JSON
5. Ping `live: true`
6. If CDP keys: ping `?url=` their **402 shop** so Bazaar lists that URL (not `/v1/ping`)
7. `GET /v1/listings?agentId=` all `ok` except bazaar until CDP

Same loop for house shops when we add a SKU.
