# Groover hangar

Three live 402 shops. Mill is the suit. These are the shops.

| Shop | URL | Price |
|------|-----|-------|
| extract | `https://clearing-production-9968.up.railway.app/v1/extract?url=` | $0.02 USDC |
| witness | `https://clearing-production-9968.up.railway.app/v1/witness?url=` | $0.02 USDC |
| pin | `https://clearing-production-9968.up.railway.app/v1/pin?agentId=` | $0.01 USDC |

No account. No API key. Hosted ZigZag `/sign` is 410. Keys: local OWS or `CLEARING_SIGNER=awal`. Clearing is not mill-planted into 0xray.

## Grok

```bash
grok plugin marketplace add htafolla/groover
grok plugin install mill --trust
grok plugin install shop-extract --trust
grok plugin install shop-witness --trust
grok plugin install shop-pin --trust
```

That is the Grok bot door. Skills and slash commands load in the session.

## npm / Hermes / OpenClaw

From a **project** root (never passwd-home `~`):

```bash
npx groover-hangar
```

Plants:

- `.grok/plugins/shop-*` (Grok project plugin; needs trust)
- `.hermes/plugins/shop-*` (Hermes plugin)
- `.openclaw/skills/shop-*` (OpenClaw)
- `.opencode/skills/shop-*`

## Sell

Run Clearing with your `CLEARING_PAY_TO`. Same object, your shop. Do not mill-plant Clearing into 0xray.
