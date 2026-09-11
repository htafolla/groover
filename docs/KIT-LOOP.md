# Default Groover kit loop

This is the product path. Not a Railway wallet.

**Grok (the door):**

```bash
grok plugin marketplace add htafolla/groover
grok plugin install mill --trust
grok plugin install shop-extract --trust
grok plugin install shop-witness --trust
grok plugin install shop-pin --trust
```

**npm / Hermes / OpenClaw:** `npx groover-hangar` from a project root.

```
factory /suit
  → mill plugin + three shops
  → DID + GRVR mint (optional name)
  → ERC-8004 register (same mill)
  → local ZigZag stdio (OWS keys)
  → hosted extract / witness / pin 402
```

## 1. Name the agent (hosted mill)

Open https://website-production-c0da.up.railway.app/suit

Mill params → download mill+inspect → load in the CLI → **mint**.

Mint returns `did:groover:…`, GRVR `tokenId`, and should mirror ERC-8004 (`agentId` on `0x8004A169…a432`). Live example: [`GROK-AGENT-IDS.md`](./GROK-AGENT-IDS.md).

`.mcp.json` Groover registry stays HTTP (no keys).

## 2. Wear the kit (local)

In the project `.mcp.json` (already this shape):

- **zigzag** — `node --import tsx ../zigzag/ows-server/src/mcp.ts` (from the groover repo root)  
  Keys: `~/.ows`. Loopback rail: `127.0.0.1:8789`.
- **clearing** — `node --import tsx ../clearing/mcp/src/server.ts` + `--env-file ../clearing/kit.env`  
  extract URL = hosted shop, signer = zigzag @ loopback.
- **0xray-*** — `npx -y 0xray mcp …`
- **repertoire** — vendored MCP under `0xray`

Do **not** point zigzag or clearing at `*.up.railway.app/mcp` for signing.

## 3. Pay the shop (no spend until approved)

```
clearing extract  url=https://example.com  dryRun=true
→ 402, $0.02 USDC on Base, payTo from kit.env

zigzag sign_x402  approved=false
→ needs_approval: true

# live spend only with approved=true (or CLEARING_SIGNER=awal after OTP)
```

Hosted extract: `https://clearing-production-9968.up.railway.app/v1/extract?url=…`

Lean prefab (free): [mill-plant.tgz](https://website-production-c0da.up.railway.app/mill-plant.tgz) + [lean clerk](https://website-production-c0da.up.railway.app/prefabs/lean/README.md).

Shops (pay for a GET receipt, not a summary):

- extract `https://clearing-production-9968.up.railway.app/v1/extract?url=`
- witness `https://clearing-production-9968.up.railway.app/v1/witness?url=`
- pin `https://clearing-production-9968.up.railway.app/v1/pin?agentId=`

Same `paymentId` → `replayed: true`, no second signature. Clearing is its own MCP — not mill-planted into 0xray.

## 4. Optional Coinbase custody

```
npx awal auth login you@email
npx awal auth verify <flowId> <otp>
# kit.env: CLEARING_SIGNER=awal
```

Clearing still gates. `awal x402 pay` signs in Coinbase TEE. Not the default.

## 5. What hosted ZigZag still does

`POST /settle` broadcasts a **client-signed** EIP-3009 so extract can settle.  
`POST /sign` and MCP `sign_x402` return **410**.

## Do not

- Treasury mnemonic as the agent wallet
- Wallet MCP (`mcp.base.org`) as Clearing’s signer
- Replace Clearing with Turnkey
- Multi-chain GRVR until this loop is boring
