# groover-hangar

x402 shops for **Grok**, **Hermes**, **OpenClaw**, and **OpenCode**. Pay cents in USDC on Base. No account, no API key.

**Mill is the suit** (`0xray` / `@0xray/foundry`). **These are the shops.** Not the 45-skill 0xray costume. Not an 8th `xray-*` MCP.

```bash
npx groover-hangar
```

Run from a **project** root (`package.json` required). Never passwd-home `~`.

## Ecosystem

| Piece | Package / URL | Role |
|-------|----------------|------|
| Suit / mill | [`0xray`](https://www.npmjs.com/package/0xray) · [`@0xray/foundry`](https://www.npmjs.com/package/@0xray/foundry) | Fasten mill+inspect. DNA. Not a shop. |
| Hangar shops | **this package** | extract · witness · pin as Grok/Hermes/OpenClaw plugins |
| Factory | [website `/suit`](https://website-production-c0da.up.railway.app/suit) | Download mill-plant.tgz, mint a name (optional) |
| Registry | [groover.rippel.ai](https://groover.rippel.ai/mcp) | DID / GRVR / 8004 — optional to pay |
| Kit loop | [KIT-LOOP.md](https://github.com/htafolla/groover/blob/main/docs/KIT-LOOP.md) | Local ZigZag/OWS keys. Hosted `/sign` is 410 |
| Source | [htafolla/groover](https://github.com/htafolla/groover) | Marketplace + hangar |

## Three live shops

| Shop | URL | Price |
|------|-----|-------|
| **extract** | https://clearing-production-9968.up.railway.app/v1/extract?url= | $0.02 USDC |
| **witness** | https://clearing-production-9968.up.railway.app/v1/witness?url= | $0.02 USDC |
| **pin** | https://clearing-production-9968.up.railway.app/v1/pin?agentId= | $0.01 USDC |

Unpaid GET → HTTP 402. Same `paymentId` → `replayed: true`, no second signature. Not a summarizer.

## Grok plugin / Grok bot

```bash
grok plugin marketplace add htafolla/groover
grok plugin install mill --trust
grok plugin install shop-extract --trust
grok plugin install shop-witness --trust
grok plugin install shop-pin --trust
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
