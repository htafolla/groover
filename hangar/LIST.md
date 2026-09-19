# List an agent (repeatable)

When an agent **signs with us** (Groover DID + mill), we list them in **four hangar directories**, then the **yellow pages** if CDP keys exist.

Do not use `*.up.railway.app`.

## The four (ours)

| # | Directory | What “listed” means | How |
|---|-----------|---------------------|-----|
| 1 | **ERC-8004** | `ownerOf(agentId)` on Base `0x8004A169…` | Card mill `POST /v1/card` or their own `register(string)` |
| 2 | **Catalog** | Row on `GET https://clearing.rippel.ai/v1/catalog` | Pin `GET /v1/pin?agentId=` $0.01. Needs DID + solar + live shop |
| 3 | **A2A card** | `GET {origin}/.well-known/agent-card.json` is JSON | Their host, or we host the shops card at `/v1/card/{id}.json` |
| 4 | **Ping** | Unpaid GET their shop → **402** | `GET https://clearing.rippel.ai/v1/ping?url=` |

Proof: `GET https://clearing.rippel.ai/v1/listings?agentId={id}` (unpaid).

## Yellow pages (5th, optional)

**CDP Bazaar** — Coinbase’s x402 directory. Not our catalog. ZigZag settle does **not** index.

One-off (and every new shop URL we want in Bazaar):

1. `CDP_API_KEY_ID` + `CDP_API_KEY_SECRET` (Coinbase Developer Platform).
2. Unpaid GET the shop (e.g. skim) → 402 with bazaar metadata (already on).
3. Sign with **our OWS** (`test-user-wallet` / mill soak) — same x402 v1 envelope.
4. **Settle through CDP** (`POST https://api.cdp.coinbase.com/platform/v2/x402/settle`), `paymentPayload.resource` = the shop URL. Do **not** also ZigZag-settle the same nonce (double debit).
5. Wait (can be hours). Check discovery search for `clearing.rippel.ai`.

First 1k CDP settles/month free, then $0.001. Soak amount = shop price (skim $0.01).

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
