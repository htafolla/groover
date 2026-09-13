---
sidebar_position: 2
---

# Factory parity

Live dogfood **2026-09-13**. Do not invent keys. Do not skip mint. Do not pin
demo `86025`. Do not claim `0xray-suit` works until **live** mint is green.

UI: **[/suit](/suit)** — mill plant → register → mint → pin → shops.

Core docs first (every project), then Groover-specific. Path-as-root static
+ registry HTTP (`text/markdown` / `text/plain` / `application/json` for
package.json, not the MCP banner):

- General: `GET /README.md` · `/CHANGELOG.md` · `/package.json` · `/AGENTS.md` · `/SKILLS.md` · `/llms.txt`
- Docusaurus: `/docs` (this site)
- Groover: this page, [Registration](./registration.md), [SKILL](./skill.md)

**Task C2 (ship-ready):** CI green is not enough. After registry + website
deploy, live curl evidence is mandatory — same checker, both hosts:

```bash
npx tsx deploy/check-agent-docs.ts \
  --base https://registry-production-e2c4.up.railway.app \
  --base https://website-production-c0da.up.railway.app
```

(`npx tsx deploy/check-agent-docs.ts` with no args hits those two hosts.)
Fails on HTTP ≠ 200, HTML 404, or `Groover MCP Registry active`. We released
without this gate once; do not call C2 done without the live PASS.

**Dynamo:** PoA `register_plugin` does **not** require a PASS citation. Live
`mint_suit` and ERC-8004 mirror **do**.

## Sequence

1. **Persist Ed25519 first.** Generate a PEM keypair, `chmod 600` the secret,
   then register with `--pubkey` / `--secret-key`.
   `deploy/register-agent.cjs` auto-generates in memory and **does not write**
   the private key. Lost secret = orphan DID (re-register with new persisted
   keys). Save `{ did, apiKey }` next to the keys.
2. **Register + mint on the same MCP host.** Live:
   `POST https://registry-production-e2c4.up.railway.app/mcp`
   (`REGISTRY_URL` default in `register-agent.cjs`). Registering on Railway then
   calling `mint_suit` on `https://groover.rippel.ai/mcp` returns opaque
   JSON-RPC `-32603 Tool execution failed` (DID/apiKey not on that store).
3. **Dynamo PASS citation is mandatory before live mint and ERC-8004
   mirror.** PoA `register_plugin` is still pre-Dynamo (4-turn challenge
   only). `POST https://mcp-production-80e2.up.railway.app/govern_with_solar`
   with `proposal` (mint intent + DID + DNA) and `persistToChain: true`.
   This is a **solar hammer**, not a rubber stamp: `REJECT`,
   `NEEDS_REVISION`, or storm override can fail the proposal. Retry until
   approved — loop until `recommendation === 'PASS'` **and** real solar
   activity present
   **and** activity ≠ `storm`. Do not mint on a failed hammer. Citation =
   `temporalContainer.containerId` as 32-byte hex `0x…` → `dynamoCitation`.
   Optional `fullBox7D` for Level. Do not invent a citation. Live
   `mint_suit` (`dryRun: false`) and `mirrorGrvrMint` reject a missing or
   zero citation. `dryRun: true` may omit it (result is labeled). Emergency
   only: `DYNAMO_MINT_REQUIRED=false`.
4. **Mint the full registry DID on GRVR v5.** Live contract
   `0x045B35480F289F8f83F53345A0f367875958957a` (Base 8453) accepts **both**
   28-byte (16-hex legacy) and 76-byte (64-hex registry) DIDs. Prefer the
   **full 64-hex** DID from `register_plugin`. Sign:

   ```
   groover-mint:v1|{did}|{pack}|{to.toLowerCase()}|{issuedAtMs}
   ```

   `to` **must be lowercased**. `issuedAtMs` within ~5 minutes.

   Truncating to 16 hex was a **temporary workaround** for v4 `0xD892…`
   `InvalidDid()` only. Do **not** truncate for new mints.

   Proven 2026-09-13: Blinky reminted the **full** 64-hex DID as token **#1**
   (didLen 76), tx
   [`0x3d81ad93b4e6e37b79f338c1dd6fbb99c680a59cd345423a9d415671ee236ec1`](https://basescan.org/tx/0x3d81ad93b4e6e37b79f338c1dd6fbb99c680a59cd345423a9d415671ee236ec1)
   on v5. v4 `0xD892…` and v3 `0x6F955…` are superseded for new mints.
   Railway `GRVR_CONTRACT` is v5.
5. **Pin our `agentId`.** Hangar `shop-pin` with **your** ERC-8004 id. Never
   demo `86025`. Blinky is **86556**.
6. **Shops.** OWS wallet (USDC on Base) pays Clearing. Unpaid GET is 402.
   OWS is also an optional mint `to` holder — not an API key.

## Blinky 8004 URI (ops after website deploy)

Blinky is already registered as ERC-8004 **86556**. The live `agentURI` is
still a gist. Static files now live next to grvr-2:

- `/identity/registration/grvr-1-v1.json`
- `/identity/registration/grvr-1-v2.json`

Pair digest (sha256 of both files):
`edef4912e541da61223f5656a5125ab69cbabbdbe7405da29fcb4b31ad46bf85`.

After this site deploys, **ops** (Railway `GRVR_PRIVATE_KEY` — do not publish
the key, do not `setAgentURI` from a PR that cannot see it):

```bash
curl -fsS https://website-production-c0da.up.railway.app/identity/registration/grvr-1-v2.json \
  | sha256sum
GRVR_TOKEN_ID=1 AGENT_ID=86556 npx tsx deploy/register-8004-once.ts set-uri
```

Do **not** re-register. Do **not** redeploy GRVR
(`0x045B35480F289F8f83F53345A0f367875958957a` token 1). Record the
`setAgentURI` tx on [`GROK-AGENT-IDS.md`](https://github.com/htafolla/groover/blob/main/docs/GROK-AGENT-IDS.md).

## Pack status (2026-09-13)

- `pack: "groover-identity"` — live mint **works** on v5 with the **full**
  64-hex DID + Dynamo PASS + citation (token #1 above).
- `pack: "0xray-suit"` — still a **known gap** (inventory + `inspect.ok`
  required; see adapter). No parity until **live** mint is green.
- Missing `dynamoCitation` on live mint is a **clear** reject (not opaque
  `-32603`). Opaque `-32603` covers wrong host, bad `apiKey`, bad
  `mintSignature`, or minter/env. If full DID + Dynamo citation fails live
  after dryRun green → ops/minter env, not “bad DID”. Do not truncate as a
  first fix.

## dryRun ≠ live mint

`mint_suit` with `dryRun: true` can succeed (auth + DNA) **without** a
citation — the result is labeled. `dryRun: false` without a PASS citation
fails closed. Do **not** treat dryRun success as ship-ready identity.

Live mint needs Railway `GRVR_PRIVATE_KEY` with `MINTER_ROLE` on the
**configured** `GRVR_CONTRACT`. Missing/empty key forces a dry-run even when
the caller sent `dryRun: false` (code: `dryRun || !minterKey()`).

Live `GRVR_CONTRACT` is v5 `0x045B35480F289F8f83F53345A0f367875958957a`.
Env wins over code defaults. v4 `0xD892…` / v3 `0x6F955…` are history for
new mints.

## `0xray-suit` adapter (from code)

`packages/identity/src/packs/xray-suit.ts`:

- Requires an `inventory` **object**
- Requires `inspect.ok === true`
- DNA = keccak256(canonical JSON of inventory **without** `mintedAt` / `dna`)
- If `inspect.dna` is set, it must match that keccak (case-insensitive)

A dryRun that never receives a valid inventory+inspect pair will fail before
chain. A valid pair that dryRuns green still needs a live minter.

## Three credentials (do not mix)

| Credential | What it is | What it is not |
|---|---|---|
| `groover_…` apiKey | Issued by `register_plugin` | Not invented. Not Railway. |
| Railway `GRVR_PRIVATE_KEY` | Server minter for GRVR | Not an agent API key |
| OWS wallet | Shop pay / optional mint `to` | Not a Groover API key |

## Repo walkthroughs

- Registration: [`docs/AGENT-REGISTRATION-GUIDE.md`](https://github.com/htafolla/groover/blob/main/docs/AGENT-REGISTRATION-GUIDE.md)
- Mint: [`docs/GRVR-MINT.md`](https://github.com/htafolla/groover/blob/main/docs/GRVR-MINT.md)

Also: [SKILL](./skill.md) · [Registration](./registration.md)
