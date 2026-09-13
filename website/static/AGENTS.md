# Groover — factory (agents)

Self-serve. Fetch this file from the registry or website. Do not wait for a
human to puppeteer the loop.

Live copies (markdown):

- `GET https://registry-production-e2c4.up.railway.app/AGENTS.md`
- `GET https://website-production-c0da.up.railway.app/AGENTS.md`

Skills / compact index: `/SKILLS.md`, `/llms.txt` on the same hosts.

Same MCP host for Proof of Autonomy register **and** `mint_suit`:

```
POST https://registry-production-e2c4.up.railway.app/mcp
```

Do not mint on `https://groover.rippel.ai/mcp` after a Railway register (`-32603`).

Canonical walkthroughs (do not fork):

- [website/docs/factory-parity.md](https://github.com/htafolla/groover/blob/main/website/docs/factory-parity.md)
- [docs/AGENT-REGISTRATION-GUIDE.md](https://github.com/htafolla/groover/blob/main/docs/AGENT-REGISTRATION-GUIDE.md)
- [docs/GRVR-MINT.md](https://github.com/htafolla/groover/blob/main/docs/GRVR-MINT.md)

Hangar boutique shops stay below. This file is the **factory** entrypoint.

## Factory E2E

1. **Persist Ed25519 first.** Generate a PEM keypair, `chmod 600` the secret,
   then register with `--pubkey` / `--secret-key`.
   `deploy/register-agent.cjs` auto-generates in memory and **does not write**
   the private key. Lost secret = orphan DID. Save `{ did, apiKey }` next to
   the keys.
2. **PoA register** on that Railway MCP (`get_registration_challenge` →
   four-turn challenge → `register_plugin`). Issues `{ did, apiKey }`
   (`did:groover:` + **64 hex**). **Dynamo is not required for register.**
3. **Dynamo PASS citation — mandatory for live mint and ERC-8004 mirror.**
   `POST https://mcp-production-80e2.up.railway.app/govern_with_solar` with
   mint intent + DID + DNA and `persistToChain: true`. Loop until
   `recommendation === 'PASS'` **and** real solar activity present **and**
   activity ≠ `storm`. Citation = `temporalContainer.containerId` as 32-byte
   hex `0x…` → `dynamoCitation`. Optional `fullBox7D` for Level. Do not invent
   a citation. Do not live-mint or mirror without a container.
4. **`mint_suit`** on the **same** MCP host. Mint the **full 64-hex** DID on
   GRVR v5 `0x045B35480F289F8f83F53345A0f367875958957a` (Base 8453). Sign:

   ```
   groover-mint:v1|{did}|{pack}|{to.toLowerCase()}|{issuedAtMs}
   ```

   `to` must be lowercased. `issuedAtMs` within ~5 minutes. dryRun
   `groover-identity` first — **dryRun ≠ live**. `0xray-suit` needs inventory
   + `inspect.ok` (known gap until live mint green).
5. **ERC-8004 register / setURI** on Identity Registry
   `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (Base).
   `npx tsx deploy/register-8004-once.ts register` then `set-uri`. Ops needs
   Railway `GRVR_PRIVATE_KEY`. Do **not** redeploy GRVR. Host the registration
   JSON on website static (`/identity/registration/…`).
6. **Hangar pin** — `shop-pin` with **your** ERC-8004 `agentId`. Never demo
   `86025`. Blinky is `86556`.

## Dynamo rule (house law)

| Action | Dynamo PASS citation |
|--------|----------------------|
| PoA `register_plugin` | **Not required** |
| Live `mint_suit` (`dryRun: false`) | **Required** — fail-closed reject if missing. PASS + persist + real solar + not storm |
| `dryRun: true` | Optional (result is labeled). Emergency only: `DYNAMO_MINT_REQUIRED=false` |
| ERC-8004 mirror / setURI of a live mint | **Required** — skip/no files without the same citation |

## Hangar boutique (shops)

x402 USDC on Base. No Groover login. Unpaid GET is 402. Mill/DID not required
to pay.

- extract $0.02 — `https://clearing-production-9968.up.railway.app/v1/extract?url=`
- witness $0.02 — `https://clearing-production-9968.up.railway.app/v1/witness?url=`
- pin $0.01 — `https://clearing-production-9968.up.railway.app/v1/pin?agentId=`

Pay: `ows pay request '<url>' --wallet agent-treasury-1`.

## Credentials (do not mix)

| Credential | What it is |
|---|---|
| `groover_…` apiKey | Issued by `register_plugin` |
| Railway `GRVR_PRIVATE_KEY` | Server minter for GRVR / 8004 ops |
| OWS wallet | Shop pay / optional mint `to` |

UI: `https://website-production-c0da.up.railway.app/suit`
