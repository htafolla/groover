# Launch your own hangar with 0xRay

A **hangar** is a pay-per-call web shop for AI agents. Someone calls one of your URLs. Your server answers
**HTTP 402 Payment Required** with a price quote (the [x402](https://www.x402.org/) standard). The caller signs
a USDC payment on Base and calls again. Your server settles the payment and returns the result. The USDC goes
straight to the wallet address you choose (your **payTo**).

The server that does this is **Clearing** ([htafolla/clearing](https://github.com/htafolla/clearing)). You run your
own copy and set your own payTo. The buyer side (the `npx groover-hangar` plugins) is covered in
[README.md](./README.md). This guide covers selling.

> **Draft.** Lines marked `TODO(verify)` could not be confirmed from the source repos or from a live URL. Check them before you
> rely on them.

## What it costs overall

| Item | Who pays | Amount | Required? |
|------|----------|--------|-----------|
| Suit + hangar npm packages | nobody | free | step 1 |
| OWS wallet | nobody | free | step 2 |
| Railway hosting | you | Usage-based. Live [Railway pricing](https://docs.railway.com/pricing.md) on 2026-09-26: subscription plus resources (Free $0 with $1 of resources, Hobby $5/mo, Pro $20/mo; RAM $10/GB/mo, CPU $20/vCPU/mo, egress $0.05/GB, volume $0.15/GB/mo). No single hangar total in groover or clearing. | step 3 |
| Settling each sale on Base | the private ZigZag settle service | Base ETH gas to broadcast `transferWithAuthorization`. Not a USD quote. Clearing only POSTs the signed authorization and reads back `txHash` (`ZigzagFacilitator` in clearing `mcp/src/facilitator.ts`, main `2ee49299`). Your Railway process does not send the transaction, and the buyer does not spend ETH. | step 3 |
| One test purchase from your own shop | you (you pay yourself) | **$0.02 USDC** for extract (default price) | step 5 |
| On-chain agent ID, do-it-yourself `register(string)` | you | **Base ETH gas**. `register(string)` measured **134,840 gas** on 2026-09-10 ([GRVR-ERC8004-INTEROP-SPEC.md](../docs/GRVR-ERC8004-INTEROP-SPEC.md) §2.3). Not a USD quote. `TODO(verify): exact ows sign send-tx arguments are not in groover or clearing` | step 6, pick one |
| On-chain agent ID via the hosted card service (it pays the gas) | you | **$0.05 USDC** | step 6, pick one |
| Pin into the catalog | you | **$0.01 USDC** | step 6 |
| Ping (optional reachability check) | you | **$0.01 USDC** | step 6, optional |
| Groover DID + Dynamo PASS | — | `TODO(verify): no USDC price in groover, clearing, or the live govern_with_solar descriptor` | step 6 |

Buyers pay without ETH: x402 "exact" payments use EIP-3009 signatures, so the buyer never sends a gas transaction.

---

## 1. Fasten a suit (your agent's identity kit)

A **suit** is a small identity kit from npm (`0xray` plus `@0xray/foundry`). It gives your agent project a
fingerprint (its "DNA") and a self-check. The suit is not a shop and does not take payments.

A fastened suit is **not required to sell**. Clearing quotes `CLEARING_PAY_TO` and does not read a suit
(`mcp/src/config.ts`, `mcp/src/http.ts` on clearing `2ee49299`). It is also **not what the catalog checks**.
A pin lists you only when the card has a Groover DID (or a GRVR `eip155:8453:0x…/<id>` string), a Dynamo
PASS or a `0x` + 64-hex citation, a live shop URL that unpaid-GETs 402, and an ERC-8004 agent id
(`mcp/src/gates.ts`, `mcp/src/live-shop.ts`, `mcp/src/pin.ts`). The suit is the documented way to fasten DNA
before an optional `mint_suit`. You can take payments without it.

Run the suit commands in a project folder that has a `package.json`. Node 20 or newer.

```bash
npm i 0xray
npx @0xray/foundry mint --skip-live
npx @0xray/foundry inspect --skip-live
```

`inspect` should report `ok: true`, `suit: "fastened"`, and `costume: false`. Use one suit per agent. Don't share
one suit across agents.

## 2. Make a wallet (OWS)

You need a Base address to receive sales. You also need a funded wallet to make the test purchase in step 5.
[Open Wallet Standard (OWS)](https://docs.openwallet.sh) keeps keys locally in `~/.ows`.

```bash
curl -fsSL https://docs.openwallet.sh/install.sh | bash

ows wallet create --name "agent-treasury-1"
ows wallet list
# copy the Base (eip155:8453) address
ows fund balance --wallet agent-treasury-1 --chain base
```

- **Receiving:** the address you copied can be your payTo. Any Base address you control works, including a
  separate cold wallet.
- **Buying (for step 5):** send USDC **on Base** (chain id 8453, not Ethereum) to that address. Native USDC is
  `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. The OWS on-ramp is optional:
  `ows fund deposit --wallet agent-treasury-1 --chain base`.

Never put a private key in Clearing's environment. Clearing only needs your **public** payTo address.

## 3. Deploy Clearing with your own payTo (Railway)

Clearing ships with a `railway.json`. It builds with Nixpacks (plus `ffmpeg` in `nixpacks.toml`), starts with
`npx tsx mcp/src/mcp-http.ts`, and health-checks `/health`. Railway sets `PORT`.

```bash
git clone https://github.com/htafolla/clearing.git
cd clearing
railway login
railway init
```

Set the variables. Replace the placeholders with your own values:

```bash
railway variable set CLEARING_PAY_TO=0xYOUR_BASE_ADDRESS
railway variable set CLEARING_SIGNER=zigzag
railway variable set CLEARING_FACILITATOR=zigzag
railway variable set CLEARING_ZIGZAG_URL=YOUR_SETTLE_SERVICE_URL
railway variable set CLEARING_RAIL_TOKEN=YOUR_RAIL_TOKEN
railway variable set CLEARING_PUBLIC_URL=https://YOUR_DOMAIN
railway variable set CLEARING_EXTRACT_BASE_URL=https://YOUR_DOMAIN
railway variable set CLEARING_DATA_DIR=/data
```

What each one does (from `mcp/src/config.ts`, `production-rail.ts`, `facilitator.ts`, `.env.example`):

| Variable | Meaning |
|----------|---------|
| `CLEARING_PAY_TO` | **Your** Base address. Every 402 quote tells buyers to pay this address. Required. |
| `CLEARING_SIGNER` | Must be `zigzag` on Railway. Otherwise the server refuses to start. |
| `CLEARING_RAIL_TOKEN` | Must be set on Railway (or `ZIGZAG_RAIL_TOKEN`). Sent as a Bearer token to the settle service. |
| `CLEARING_FACILITATOR` | Who settles paid calls. It defaults to `zigzag` when the signer is `zigzag`. |
| `CLEARING_ZIGZAG_URL` | Base URL of the settle service. Clearing POSTs to `<url>/settle`. Or set `CLEARING_ZIGZAG_SETTLE_URL` directly. |
| `CLEARING_PUBLIC_URL` / `CLEARING_EXTRACT_BASE_URL` | Your public origin, used in quotes and self-checks. |
| `CLEARING_DATA_DIR` | Where receipts and listings are stored. The default `~/.clearing` is wiped on redeploy, so mount a volume at `/data`. |
| `CLEARING_EXTRACT_PRICE_USD` | Extract price. Default `0.02` (`0.05` with `js=1` via `CLEARING_EXTRACT_PRICE_JS_USD`). |

Settling a sale currently needs **private ZigZag**. `ZigzagFacilitator` POSTs the buyer's signed EIP-3009 to
`CLEARING_ZIGZAG_URL` + `/settle` (or `CLEARING_ZIGZAG_SETTLE_URL`) with `Authorization: Bearer` set to
`CLEARING_RAIL_TOKEN` (`mcp/src/facilitator.ts`). [htafolla/zigzag](https://github.com/htafolla/zigzag) is
private. This repo does not publish a settle URL or a way to mint a rail token
([FIND.md](./FIND.md): no `zigzag.rippel.ai`). [KIT-LOOP.md](../docs/KIT-LOOP.md) says hosted ZigZag
`POST /settle` still broadcasts a client-signed authorization, and that `POST /sign` is 410. It does not give
the URL. Until you have that private service, you can deploy the server and you cannot collect a real payment.

`CdpFacilitator` in the same file can POST to `https://api.cdp.coinbase.com/platform/v2/x402/settle` when
`CLEARING_FACILITATOR=cdp` and both `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` are set. That is **not** a
working seller path on Railway today. `mcp/src/production-rail.ts` refuses to start unless
`CLEARING_SIGNER=zigzag` and `CLEARING_RAIL_TOKEN` are set (`RAILWAY_ENVIRONMENT` or `NODE_ENV=production`).
A CDP facilitator path that would let a seller settle without private ZigZag is in progress in
[htafolla/clearing](https://github.com/htafolla/clearing) (separate PR). Do not deploy assuming CDP collects
the payment.

Don't copy `kit.env` into your deployment. It contains the house payTo (`0xc9cD…462D`), so your sales would go
to someone else.

Add a volume, deploy, and get a domain:

```bash
railway volume add          # mount it at /data
railway up
railway domain              # or: railway domain shop.example.com
```

Use a custom domain for anything you advertise. Clearing's Bazaar code drops `*.railway.app` hostnames.

## 4. Keep or add a shop route

Every route in Clearing is a plain handler. `mcp/src/http.ts` lists which paths go to the shop code
(`isExtractPath`). It then tries each handler in order (`handleHangar`: ping, listings, listed, pin, witness,
skim, blip, card, then extract).

**Keep one (easiest).** A fresh deploy already sells these, all paid to your `CLEARING_PAY_TO`:

| Route | Price | Where the price lives |
|-------|-------|-----------------------|
| `GET /v1/extract?url=` | $0.02 ($0.05 with `js=1`) | `CLEARING_EXTRACT_PRICE_USD` env |
| `GET /v1/skim?url=` | $0.01 | `SKIM_USD` in `mcp/src/skim.ts` |
| `GET /v1/witness?url=` | $0.02 | `WITNESS_USD` in `mcp/src/witness.ts` (`0.02`). Live unpaid GET on 2026-09-26 quoted `20000` |
| `GET /v1/pin?agentId=` | $0.01 | `PIN_USD` in `mcp/src/pin.ts` |
| `GET` or `POST /v1/card` | $0.05 | `CARD_USD` in `mcp/src/card.ts`. Returns 503 unless `CLEARING_8004_KEY` is set |

`/v1/blip` also exists, but it needs extra minting services (`BLIPS_*` vars). Leave it alone unless you run those.

**Add your own.** Copy `mcp/src/skim.ts`. It's the smallest complete shop. The pattern:

1. Return `undefined` if the path isn't yours, so the next handler runs.
2. Validate input and do any "would this fail?" checks **before** quoting, so nobody pays for an error.
3. `buildRequirements({ amountUsd, payTo: ctx.config.payTo, resource, description })`, then `buildQuote(...)`.
4. No payment header (`paymentHeaderFromRequest`)? Return the quote with status **402** and `quoteHeaders(quote)`.
5. Otherwise call `ctx.facilitator.settle(header, requirements)`. If `ok`, do the work and return `paid: true`,
   `replayed`, and `txHash`.

Then register it in `mcp/src/http.ts`. Add your path to `isExtractPath` and call your handler in `handleHangar`
before `handleExtract`. Run `npm test` and redeploy with `railway up`.

## 5. Smoke test: one 402, then one paid call

**Check health (free):**

```bash
curl -s https://YOUR_DOMAIN/health
# {"status":"healthy","server":"clearing","version":"0.1.0","tools":6,"signer":"zigzag"}
```

The house server `https://clearing.rippel.ai/health` returned that body on 2026-09-26. `tools` is
`TOOL_DEFINITIONS.length` in `mcp/src/mcp-http.ts` (status, discover, extract, fetch_paid, receipts, blip).

**Unpaid call returns 402 (free):**

```bash
curl -si 'https://YOUR_DOMAIN/v1/extract?url=https://example.com'
```

Expect `HTTP/2 402`, a `payment-required` header (base64 of the body), `www-authenticate: x402`, and an x402 v2
body like this one (shape from the live house server):

```json
{
  "x402Version": 2,
  "error": "X-PAYMENT header is required",
  "resource": { "url": "...", "description": "...", "mimeType": "application/json", "serviceName": "Clearing" },
  "accepts": [{
    "scheme": "exact", "network": "eip155:8453",
    "maxAmountRequired": "20000", "amount": "20000",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "payTo": "0xyour_address_lowercased",
    "maxTimeoutSeconds": 60,
    "extra": { "name": "USD Coin", "version": "2" }
  }],
  "extensions": { "bazaar": { "info": {}, "schema": {} } }
}
```

Amounts are in USDC base units (6 decimals), so `20000` is $0.02. **Check that `payTo` is your address.**

**Paid call. Costs USDC ($0.02 for extract, from your step-2 wallet to your payTo).**

Clearing reads payment from the `X-PAYMENT` (or `PAYMENT-SIGNATURE`) header. The value is base64 JSON
`{ x402Version: 1, paymentId, nonce, accepted, eip3009 }`, where `eip3009` is a signed USDC
`TransferWithAuthorization`. A bare `ows pay request` fails against Clearing (`missing paymentId/nonce`), so use
one of these:

- **Clearing's own buyer tool (MCP).** In a local clone, `npm run mcp` is `tsx mcp/src/server.ts`.
  `server.ts` loads `kit.env` only for keys that are still unset. That file sets `CLEARING_SIGNER=zigzag`,
  `CLEARING_FACILITATOR=zigzag`, the house `CLEARING_PAY_TO` (`0xc9cD…462D`),
  `CLEARING_EXTRACT_BASE_URL=https://clearing.rippel.ai`, and `ZIGZAG_WALLET=agent-treasury-1`. It does not set
  `CLEARING_ZIGZAG_URL`. `createFacilitator('zigzag')` throws at boot without `CLEARING_ZIGZAG_URL`,
  `CLEARING_SIGNER_URL`, or `CLEARING_ZIGZAG_SETTLE_URL` (`facilitator.ts`).

  Export these **before** `npm run mcp` so `kit.env` cannot overwrite them:

  ```bash
  export CLEARING_ZIGZAG_URL=http://127.0.0.1:8789
  export CLEARING_EXTRACT_BASE_URL=https://YOUR_DOMAIN
  export CLEARING_SIGNER=zigzag
  export ZIGZAG_WALLET=agent-treasury-1
  export ZIGZAG_ROOT=/path/to/zigzag
  npm install
  npm run mcp
  ```

  The loopback URL only gets the process past boot. `createSigner` treats `127.0.0.1` / `localhost` as
  in-process (`isLoopbackSignerUrl` in `ows-signer.ts`) and does not POST `/sign`. `fetchPaid` (`pay.ts`)
  signs, then GETs the shop. The **shop** settles. The local facilitator is not called on that path. The
  quote's `payTo` is the shop's, not the house address in `kit.env`. `CLEARING_EXTRACT_BASE_URL`'s host is
  added to the buyer allowlist (`config.ts`).

  Signing imports private `zigzag/src/lib/eip3009.ts` from `ZIGZAG_ROOT`, or `../zigzag`, or `~/dev/zigzag`.
  Without that file, `sign` fails with `OWS signer needs sibling zigzag`. This buyer tool does not work from
  the public clearing repo alone.

  Call `status`, then `extract` with `dry_run=true` to read the price, then again with `dry_run=false` and
  `approved=true`.
- **By hand with OWS.** Sign the EIP-3009 typed data with
  `ows sign message --wallet agent-treasury-1 --chain 8453 --message "" --typed-data '<eip-712 json>' --json`,
  then retry with `X-PAYMENT` set to the base64 envelope above.
  `TODO(verify): the JSON file for --typed-data is not in public clearing or groover. Signing is delegated to private zigzag src/lib/eip3009.ts. shop-pin only shows the CLI flag.`

A good paid response is `200` with `paid: true`, `replayed: false`, a `txHash`, and the result (for extract:
`textHash`, `markdown`, and more). Send the **same** header again and you get `replayed: true`, with no second
charge. Check that your payTo's USDC balance went up on Base.

## 6. Optional: list your hangar in the public catalog

The public catalog is `GET https://clearing.rippel.ai/v1/catalog` (also `/v1/listed` and `/v1/online`).
Groover MCP `list_hangars` reads the same data. Listing is paid on the **house** Clearing. Your own server's
catalog only lists what people pin there.

To be listed, you need all of these (from `mcp/src/pin.ts`, `gates.ts`, `live-shop.ts`):

1. **A Groover DID** (`did:groover:<hex>`). Register through the Groover registry MCP
   (`https://groover.rippel.ai/mcp`: `get_registration_challenge` → `register_plugin`). Save your keypair before
   you register.
2. **A Dynamo PASS.** A governance check. Your card carries it as `PASS` or as a 0x-prefixed
   64-hex citation (`solarProof` in `mcp/src/gates.ts`).
   `TODO(verify): the call that yields the citation. Groover [SKILL.md](../SKILL.md) says POST https://hammer.rippel.ai/govern_with_solar with persistToChain true and citation = 0x + temporalContainer.containerId. A live GET of that URL on 2026-09-26 describes proposal, structuredProposal, baseVoteWeight, sharePublicly, and spectralQuality, and its outputs do not include a container id.`
3. **A public HTTPS card (JSON)** that includes:
   - your DID (`groover.did`, or a `services` entry named `DID`);
   - the PASS (`groover.dynamoCitation`, or `solar: { "verdict": "PASS" }`);
   - at least one shop URL that returns 402 when called unpaid (`storeUrl`, `endpoints.http`, or a `services`
     entry). Your status page isn't a shop, so it doesn't count.
4. **An on-chain agent ID (ERC-8004 on Base, registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`).** Pick one:
   - **Costs ETH (gas on Base):** call `register(string)` with your card URL yourself. The same call measured
     **134,840 gas** on 2026-09-10 ([GRVR-ERC8004-INTEROP-SPEC.md](../docs/GRVR-ERC8004-INTEROP-SPEC.md) §2.3).
     That figure is gas units, not a USD price. [LIST.md](./LIST.md) says to send it with `ows sign send-tx`,
     not the x402 envelope. `deploy/register-8004-once.ts register` is the house script: it signs with
     `GRVR_PRIVATE_KEY`, not your OWS wallet. Do not use that key.
     `TODO(verify): the exact ows sign send-tx arguments (to, calldata) are not in groover or clearing`
   - **Costs USDC ($0.05):** use the hosted card service `https://clearing.rippel.ai/v1/card` (POST your card
     JSON or GET `?uri=`). It pays the gas and transfers the ID to your paying wallet.
5. **Costs USDC ($0.01): pin.** `GET https://clearing.rippel.ai/v1/pin?agentId=YOUR_AGENT_ID`, paid the same way
   as step 5. The response includes `listed: true` when every check passed. A pin alone doesn't list you.

Optional, **costs USDC ($0.01): ping.**
`GET https://clearing.rippel.ai/v1/ping?url=<encodeURIComponent(your shop URL)>` checks that your shop is reachable.

Check your status for free:

```bash
curl -s 'https://clearing.rippel.ai/v1/listings?agentId=YOUR_AGENT_ID'
curl -s https://clearing.rippel.ai/v1/catalog
```

To stay "online", your shop must pass a health check at least every 15 minutes (`probeIntervalMs` default
`15 * 60 * 1000` in `mcp/src/config.ts`).

## Where to get help

- Clearing: [README](https://github.com/htafolla/clearing#readme), [TECH-SPEC](https://github.com/htafolla/clearing/blob/main/TECH-SPEC.md)
- Buyer side: [hangar README](./README.md) · listing details: [LIST.md](./LIST.md)
- Issues: https://github.com/htafolla/groover/issues
