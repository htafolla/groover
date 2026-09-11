# Grok agent IDs (public)

Do not lose these. API keys are not in this file.

Agents sign on the **local kit** (ZigZag stdio + OWS). Hosted ZigZag `/sign` is gone. Hosted Clearing **extract** is the 402 shop.

| What | Value |
|------|--------|
| DID | `did:groover:f60a3753b5ef6dd3` |
| GRVR token | `#2` on `0xD892D6836ab138a5aE4365dcb05Adb296607d6f9` |
| Mint tx | https://basescan.org/tx/0x91aad4366860a38ae83282b386c03acc5f6217a1eedcf1a9e8c77a1317e450ab |
| Holder | `0xd45CcF98D6db5A36E7CdD10ffae0b685BF27CE43` |
| ERC-8004 agentId | `86025` |
| Identity registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| register tx | https://basescan.org/tx/0x8e9cf9d0d716558f15402033f62f80f5bb317f9284414a5cc35402ea262c9360 |
| setAgentURI tx | https://basescan.org/tx/0x8881d33f85488ef0ea56d23d5d14000fee52a255496622f931ff2aa5a66fa1fb |
| agentURI | https://website-production-c0da.up.railway.app/identity/registration/grvr-2-v2.json |
| Factory | https://website-production-c0da.up.railway.app/suit |
| **402 extract (shop)** | https://clearing-production-9968.up.railway.app/v1/extract |
| **402 witness (shop)** | https://clearing-production-9968.up.railway.app/v1/witness |
| **402 pin (shop)** | https://clearing-production-9968.up.railway.app/v1/pin?agentId=86025 |
| Clearing kit | local stdio (`mcp/src/server.ts` + `kit.env`) |
| ZigZag kit | local stdio (`ows-server/src/mcp.ts`); loopback rail `127.0.0.1:8789` |
| Optional Coinbase rail | `CLEARING_SIGNER=awal` after `npx awal auth login` |
| Hosted zigzag | facilitator `/settle` only — not an agent signer |
| Hosted penny tx | https://basescan.org/tx/0x936e22b345d433dcad8cb9742d6389f55ebc41d9452c3e3c368b1061d2950ab5 |

Default loop: [`KIT-LOOP.md`](./KIT-LOOP.md). Landscape: [`AGENT-STACK-LANDSCAPE.md`](./AGENT-STACK-LANDSCAPE.md).
