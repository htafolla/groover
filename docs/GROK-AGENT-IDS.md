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

## Blinky — GRVR token 1 (v5)

Do not redeploy GRVR. Contract stays `0x045B35480F289F8f83F53345A0f367875958957a` token 1.

| What | Value |
|------|--------|
| DID | `did:groover:869a20477a1e9a8c15760b15502a6d616f196d6546111138d7110a65f8ec1df9` |
| GRVR token | `#1` on `0x045B35480F289F8f83F53345A0f367875958957a` |
| Mint tx | https://basescan.org/tx/0x3d81ad93b4e6e37b79f338c1dd6fbb99c680a59cd345423a9d415671ee236ec1 |
| ERC-8004 agentId | `86556` |
| Identity registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| register tx | https://basescan.org/tx/0x4c47e48084b1f58602d51e8dbc8a07029177527218f3557972277934c4aa8c3c |
| agentURI (current, gist) | https://gist.githubusercontent.com/htafolla/aa1460cc88a74d9c83b802d8aaca6eda/raw/d5bca967d40a9e036d7d00b76fd5e9d1a8a449bf/grvr-1-v2.json |
| agentURI (after website deploy + `setAgentURI`) | https://website-production-c0da.up.railway.app/identity/registration/grvr-1-v2.json |
| v1 sibling | https://website-production-c0da.up.railway.app/identity/registration/grvr-1-v1.json |
| Pair digest (sha256 of both static files) | `edef4912e541da61223f5656a5125ab69cbabbdbe7405da29fcb4b31ad46bf85` |

`setAgentURI` is **ops after merge + website deploy**. Needs Railway `GRVR_PRIVATE_KEY` (8004 NFT owner). Do not run it from a PR that cannot see that key. Receipt:

```bash
# 1. Confirm Railway is serving the pair (digest must match).
curl -fsS https://website-production-c0da.up.railway.app/identity/registration/grvr-1-v2.json \
  | sha256sum
# expect edef4912e541da61223f5656a5125ab69cbabbdbe7405da29fcb4b31ad46bf85

# 2. Point agent 86556 at the website v2 URL. Do not register again.
GRVR_TOKEN_ID=1 AGENT_ID=86556 npx tsx deploy/register-8004-once.ts set-uri
```

Paste the printed `tx 0x…` into this table as `setAgentURI tx` when it lands.

Default loop: [`KIT-LOOP.md`](./KIT-LOOP.md). Landscape: [`AGENT-STACK-LANDSCAPE.md`](./AGENT-STACK-LANDSCAPE.md).
