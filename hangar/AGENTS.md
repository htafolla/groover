# Groover hangar — agents

This is the **shop** layer, not the 0xray suit.

- **Mill / suit:** `npm i -D 0xray` then `npx @0xray/foundry mint|inspect`. Seven `xray-*` MCPs. Do not add an 8th. Do not mill-plant Clearing into 0xray.
- **Shops:** `npx groover-hangar` or `grok plugin install shop-extract --trust` (and witness, pin).
- **Pay:** unpaid GET → 402 (no wallet). To settle: OWS wallet funded with USDC on Base, then `ows pay request '<shop-url>' --wallet agent-treasury-1`. Kit path: ZigZag `sign_x402` `approved=true`. Hosted `/sign` is 410. Reuse `paymentId`. Never twice. No Groover API key to pay. Mill/DID optional.
- **Grok bot:** Grok CLI / Build on the machine that has `ows` + `~/.ows`. `grok plugin install shop-extract --trust`, new session, `/shop-extract` or “extract this URL”. Bot shells `ows pay request`. grok.com cloud chat cannot pay (no vault). Hangar plugins are skills, not a signer.
- **Name:** Groover DID / GRVR / ERC-8004 is optional. Not required to settle.
- **Costume:** not this package. `foundry.json` `"costume": true` is mill, not hangar.

## Factory parity (when you want a name)

Persist Ed25519 (`chmod 600`). Register **issues** `{ did, apiKey }`. Same MCP
for register and mint: `https://registry-production-e2c4.up.railway.app/mcp`.
Do not mint on `groover.rippel.ai` after Railway register (`-32603`).
`GRVR_PRIVATE_KEY` = server minter ≠ `groover_…`. OWS = shop pay / mint `to`.
Mint the **full 64-hex** DID on GRVR v5 `0x045B35480F289F8f83F53345A0f367875958957a`.
Do not truncate (v4 `InvalidDid` workaround only).
Sign `groover-mint:v1|{did}|{pack}|{to.toLowerCase()}|{issuedAtMs}`.
Always Dynamo-gate (PASS + container).
dryRun `groover-identity` first — **dryRun ≠ live**. `0xray-suit` needs
inventory + `inspect.ok`. Known gap until **live** mint green. Pin **your**
`agentId`, never `86025`.

UI: `/suit`. Repo: `docs/AGENT-REGISTRATION-GUIDE.md`, `docs/GRVR-MINT.md`.

Grok: Read this file from `node_modules/groover-hangar/AGENTS.md` after install. Do not overwrite project-root `AGENTS.md` (0xray mill writes that).
