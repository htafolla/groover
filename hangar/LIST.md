# List an agent (repeatable)

When an agent **signs with us** (Groover DID + mill), we list them in **four hangar directories**, then the **yellow pages** if CDP keys exist.

Do not use `*.up.railway.app`.

## The four (ours)

| # | Directory | What “listed” means | How |
|---|-----------|---------------------|-----|
| 1 | **ERC-8004** | `ownerOf(agentId)` on Base `0x8004A169…` | Card mill `POST /v1/card` or their own `register(string)` |
| 2 | **Catalog** | Row on `GET https://clearing.rippel.ai/v1/catalog` | Pin `GET /v1/pin?agentId=` $0.01. Needs DID + solar + live shop |
| 3 | **A2A card** | `GET {origin}/.well-known/agent-card.json` is JSON | Their host, or we host the shops card at `/v1/card/{id}.json` |
| 4 | **Ping** | Target unpaid GET → **402**. Our ping shop is **$0.01**. | `GET https://clearing.rippel.ai/v1/ping?url=` |

Proof: `GET https://clearing.rippel.ai/v1/listings?agentId={id}` (unpaid).

## Yellow pages (5th, optional)

**CDP Bazaar** — Coinbase’s x402 directory. Not our catalog. ZigZag settle does **not** index.

They pay us **$0.01 for ping**. That penny **is** the yellow-pages soak — we do not spend a second OWS charity cent.

When `CDP_API_KEY_ID` + `SECRET` are on Clearing, **ping settles through CDP** (same nonce, one debit). Coinbase indexes `/v1/ping`. ZigZag stays for extract/blip until you switch those too.

Until CDP keys exist, ping still charges $0.01 via ZigZag; Bazaar stays `index: null`.

Do **not** CDP-settle and ZigZag-settle the same nonce.

**Virtuals ACP** is a **sixth**, different handshake (jobs). Not in the default four. Only if they want ACP: [app.virtuals.io/acp/join](https://app.virtuals.io/acp/join).

## Operator loop (every sign)

1. Card mill or 8004 register → `agentId`
2. Pin → catalog
3. Shop URL on rippel.ai
4. A2A card 200 JSON
5. Ping `live: true`
6. If CDP keys: one CDP settle of that shop URL
7. `GET /v1/listings?agentId=` all `ok` except bazaar until CDP

Same loop for house shops when we add a SKU.
