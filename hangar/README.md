# groover-hangar

x402 shops for Grok, Hermes, OpenClaw, and OpenCode. Pay cents in USDC on Base. No account, no API key.

```bash
npx groover-hangar
```

Plants three live shops into the project (never passwd-home `~/.grok`):

| Shop | What you pay for | Price |
|------|------------------|-------|
| **extract** | receipted URL extract (hashed text) | $0.02 USDC |
| **witness** | proof of a GET (status, type, sha256) | $0.02 USDC |
| **pin** | live ERC-8004 identity card hash | $0.01 USDC |

Not a summarizer. Not a coworker mill. Hosted ZigZag `/sign` is **410** — keys stay on local OWS or `CLEARING_SIGNER=awal`. Clearing is not mill-planted into 0xray.

## Grok plugin / Grok bot

```bash
grok plugin marketplace add htafolla/groover
grok plugin install mill --trust
grok plugin install shop-extract --trust
grok plugin install shop-witness --trust
grok plugin install shop-pin --trust
```

## What it plants

From a **project** root (`package.json` required):

- `.grok/plugins/shop-*` — Grok (needs `--trust`)
- `.hermes/plugins/shop-*` — Hermes
- `.openclaw/skills/shop-*` — OpenClaw
- `.opencode/skills/shop-*` — OpenCode

## Sell the same object

Run Clearing with your `CLEARING_PAY_TO`. Same 402 URL shape, your shop.

Factory: https://website-production-c0da.up.railway.app/suit
