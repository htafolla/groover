# Groover hangar — agents

This is the **shop** layer, not the 0xray suit.

- **Mill / suit:** `npm i -D 0xray` then `npx @0xray/foundry mint|inspect`. Seven `xray-*` MCPs. Do not add an 8th. Do not mill-plant Clearing into 0xray.
- **Shops:** `npx groover-hangar` or `grok plugin install shop-extract --trust` (and witness, pin).
- **Pay:** unpaid GET → 402 (no wallet). To settle: OWS wallet funded with USDC on Base, then `ows pay request '<shop-url>' --wallet agent-treasury-1`. Kit path: ZigZag `sign_x402` `approved=true`. Hosted `/sign` is 410. Reuse `paymentId`. Never twice. No Groover API key to pay. Mill/DID optional.
- **Name:** Groover DID / GRVR / ERC-8004 is optional. Not required to settle.
- **Costume:** not this package. `foundry.json` `"costume": true` is mill, not hangar.

Grok: Read this file from `node_modules/groover-hangar/AGENTS.md` after install. Do not overwrite project-root `AGENTS.md` (0xray mill writes that).
