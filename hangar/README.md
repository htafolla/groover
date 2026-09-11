# groover-hangar

x402 shops for **Grok**, **Hermes**, **OpenClaw**, and **OpenCode**. Pay cents in USDC on Base.

No Groover login. No API key. No hosted wallet. **To pay:** create a local OWS wallet (ZigZag, keys in `~/.ows`), fund it with USDC on Base, sign with `approved=true`. Or `CLEARING_SIGNER=awal` (that path *is* a Coinbase account). Unpaid GET still 402s with no wallet.

**Mill is the suit** (`0xray` / `@0xray/foundry`). **These are the shops.** Not the 45-skill 0xray costume. Not an 8th `xray-*` MCP.

Need **Node 20+**. Run from a **project** root (`package.json` required). Never passwd-home `~`.

```bash
npx groover-hangar
```

Grok path also needs the [Grok CLI](https://docs.x.ai/docs) (`grok` on PATH) and `--trust` on install. Mill / Groover DID / API key are **not** required to pay a shop.

## Create a local OWS wallet (required to pay)

Docs: [docs.openwallet.sh](https://docs.openwallet.sh) · [open-wallet-standard/core](https://github.com/open-wallet-standard/core) · wallet lifecycle: [06 — Wallet Lifecycle](https://docs.openwallet.sh/doc.html?slug=06-wallet-lifecycle)

ZigZag hangar kit looks for wallet name `agent-treasury-1` in `~/.ows`. Hosted ZigZag `/sign` is **410**.

```bash
# CLI
curl -fsSL https://docs.openwallet.sh/install.sh | bash

ows wallet create --name "agent-treasury-1"
ows wallet list
# copy the Base (eip155:8453) address
ows fund balance --wallet agent-treasury-1 --chain base
```

**Fund it.** The new wallet is empty. Send **USDC on Base** (chain id 8453) from another wallet or an exchange withdrawal. Pick the **Base** network, not Ethereum. Token: native USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. Shops are $0.02 (extract/witness) or $0.01 (pin). x402 exact / EIP-3009: you sign; you do not need ETH for gas on this path.

Optional on-ramp in OWS (MoonPay): `ows fund deposit --wallet agent-treasury-1 --chain base`.

Or Node: `npm install @open-wallet-standard/core`. Browser setup (ZigZag web wallet): [zigzag-two.vercel.app/wallet/setup](https://zigzag-two.vercel.app/wallet/setup).

Wait until `ows fund balance` shows USDC on Base (exchange withdrawals can take minutes).

## Pay a shop (first receipt)

Quote (no wallet):

```bash
curl -sI 'https://clearing-production-9968.up.railway.app/v1/extract?url=https://example.com'
# HTTP 402
```

Pay from OWS (public path — signs the 402 and retries):

```bash
ows pay request 'https://clearing-production-9968.up.railway.app/v1/extract?url=https://example.com' \
  --wallet agent-treasury-1
```

Same for witness (`/v1/witness?url=`) and pin (`/v1/pin?agentId=86025`). Reuse fails as `replayed: true`, not a second debit.

Kit path (local ZigZag MCP, `sign_x402` `approved=true`) is in [KIT-LOOP.md](https://github.com/htafolla/groover/blob/main/docs/KIT-LOOP.md). Do not call hosted ZigZag `/sign` (410). Alternate custody: `CLEARING_SIGNER=awal` after `npx awal auth login` (Coinbase account).

## Ecosystem

| Piece | Package / URL | Role |
|-------|----------------|------|
| Suit / mill | [`0xray`](https://www.npmjs.com/package/0xray) · [`@0xray/foundry`](https://www.npmjs.com/package/@0xray/foundry) | Fasten mill+inspect. DNA. Not a shop. |
| Hangar shops | **this package** | extract · witness · pin as Grok/Hermes/OpenClaw plugins |
| Factory | [website `/suit`](https://website-production-c0da.up.railway.app/suit) | Download mill-plant.tgz, mint a name (optional) |
| Registry | [groover.rippel.ai](https://groover.rippel.ai/mcp) | DID / GRVR / 8004 — optional to pay |
| Kit loop | [KIT-LOOP.md](https://github.com/htafolla/groover/blob/main/docs/KIT-LOOP.md) | Local ZigZag/OWS keys. Hosted `/sign` is 410 |
| OWS | [docs.openwallet.sh](https://docs.openwallet.sh) | Create + fund local wallet. Vault `~/.ows` |
| Source | [htafolla/groover](https://github.com/htafolla/groover) | Marketplace + hangar |

## Three live shops

| Shop | URL | Price |
|------|-----|-------|
| **extract** | https://clearing-production-9968.up.railway.app/v1/extract?url= | $0.02 USDC |
| **witness** | https://clearing-production-9968.up.railway.app/v1/witness?url= | $0.02 USDC |
| **pin** | https://clearing-production-9968.up.railway.app/v1/pin?agentId= | $0.01 USDC |

Unpaid GET → HTTP 402. Same `paymentId` → `replayed: true`, no second signature. Not a summarizer.

## Grok bot (how it actually pays)

This is **Grok CLI / Grok Build on a machine that has `ows` and `~/.ows`**. Not grok.com cloud chat — that host has no local vault.

1. Same machine: OWS wallet `agent-treasury-1`, funded with USDC on Base (above).
2. Install plugins (once). New Grok session. Slash: `/shop-extract`, `/shop-witness`, `/shop-pin`.
3. Human: `extract https://example.com` (or `/shop-extract`).
4. Grok reads the skill, GETs the shop, sees **402**, then runs in the project shell:

```bash
ows pay request 'https://clearing-production-9968.up.railway.app/v1/extract?url=https://example.com' \
  --wallet agent-treasury-1
```

5. Reports the receipt (`textHash` / `bodySha256` / `replayed`). Does not paraphrase the page.

Hangar plugins are **skills + slash commands**. They are not a wallet and not a ZigZag MCP. If `ows` is not on PATH in that session, the bot cannot settle. Kit `sign_x402` is optional and needs local ZigZag; hosted `/sign` is 410.

```bash
grok plugin marketplace add htafolla/groover
grok plugin install mill --trust
grok plugin install shop-extract --trust
grok plugin install shop-witness --trust
grok plugin install shop-pin --trust
# new session, or Plugins tab → r
```

## What `npx groover-hangar` plants

- `.grok/plugins/shop-*` — Grok (needs `--trust`)
- `.hermes/plugins/shop-*` — Hermes
- `.openclaw/skills/shop-*` — OpenClaw
- `.opencode/skills/shop-*` — OpenCode

Does **not** write project `AGENTS.md` (0xray mill owns that). Does **not** mill-plant Clearing into 0xray. Does **not** dump 45/42 costume.

Agent map in this package: `AGENTS.md` · `SKILLS.md` · `llms.txt`.

## Sell

Run Clearing with your `CLEARING_PAY_TO`. Same 402 object, your shop.

## Docs

- Factory: https://website-production-c0da.up.railway.app/suit
- Issues: https://github.com/htafolla/groover/issues
- License: MIT
