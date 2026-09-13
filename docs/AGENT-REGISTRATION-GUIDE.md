# Agent Registration Guide

This doc is for AI agents. Follow these instructions to register yourself in the Groover registry as a verifiable autonomous agent.

**Live endpoint**: `POST https://registry-production-e2c4.up.railway.app/mcp`  
**SSE transport**: `GET /sse` → `POST /messages?sessionId=<UUID>`  
**Health**: `GET /health`  
**Core docs** (general first — markdown / plain, not the MCP banner):

- `GET https://registry-production-e2c4.up.railway.app/README.md`
- `GET https://registry-production-e2c4.up.railway.app/CHANGELOG.md`
- `GET https://registry-production-e2c4.up.railway.app/package.json`
- `GET https://registry-production-e2c4.up.railway.app/AGENTS.md`
- `GET https://registry-production-e2c4.up.railway.app/SKILLS.md`
- `GET https://registry-production-e2c4.up.railway.app/llms.txt`

Website static (path-as-root after deploy): the same core paths on
`https://website-production-c0da.up.railway.app` (README, CHANGELOG,
`package.json`, AGENTS, SKILLS, llms).

**Task C2 ship-ready** requires live curl evidence (not only CI):

```bash
npx tsx deploy/check-agent-docs.ts
```

That command hits both production hosts. Fail = missing file, HTML 404, or
the MCP catch-all banner.

Register **and** `mint_suit` on this **same** host (`REGISTRY_URL` default in
`deploy/register-agent.cjs`). Minting on `https://groover.rippel.ai/mcp` after a
Railway register returns `-32603 Tool execution failed`.

**Persist the Ed25519 secret** (`chmod 600`) and pass `--pubkey` / `--secret-key`.
The script's auto-generated keypair stays in memory and is **not written**.
`mint_suit` signs `groover-mint:v1|{did}|{pack}|{to.toLowerCase()}|{issuedAtMs}`
with that same key (`to` must be lowercased). Lost secret = orphan DID.
Save `{ did, apiKey }` next to the keys. Mint the **full** 64-hex DID on GRVR
v5 `0x045B35480F289F8f83F53345A0f367875958957a`. Truncation was a v4-only
workaround. Factory loop: [website/docs/factory-parity.md](../website/docs/factory-parity.md).

**Dynamo:** PoA `register_plugin` does **not** require a Dynamo PASS citation.
Live `mint_suit` and ERC-8004 mirror **do**. `govern_with_solar` is a **solar
hammer** — `REJECT`, `NEEDS_REVISION`, or storm can fail the proposal. Retry
until approved (`persistToChain: true`, loop until `PASS` + real solar + not
`storm`), then `dynamoCitation` = `0x` + `containerId`. Then ERC-8004
`deploy/register-8004-once.ts` register / setURI, then hangar `shop-pin` with
**your** `agentId` (never demo `86025`).

## Tools

| Method | What it does |
|--------|-------------|
| `get_registration_challenge` | Get a nonce + challenge session (required tools, min turns, min duration) |
| `submit_challenge_turn` | Submit one turn of your proof trace |
| `register_plugin` | Final registration — submit PoP signature + full trace |
| `search_plugins` | Search registered plugins |
| `list_mcp_servers` | List known MCP servers |
| `get_plugin_ui_manifest` | Retrieve stored UI manifest for a DID |

## Quick Start (1 command)

Requires `node` and `git`:

```bash
git clone https://github.com/htafolla/groover.git
cd groover/groover/groover
npm install
# Persist PEM first. Default auto-gen does not write the private key.
node deploy/register-agent.cjs --pubkey "$PUB" --secret-key "$PRIV" \
  --payload "my-agent-$(date +%s)" --metadata '{"name":"my-agent"}'
```

Output:
```json
{
  "success": true,
  "did": "did:groover:0b143500911aaa1c",
  "apiKey": "groover_527d1855731a286e557d371855c727b2b9b570f2ff3c3a61"
}
```

## Manual Registration (step by step)

Make JSON-RPC calls to `POST /mcp` (or use SSE stream at `/sse` for session-based transport). Each call is:

```json
{"jsonrpc":"2.0","id":<number>,"method":"tools/call","params":{"name":"<tool>","arguments":{...}}}
```

The response wraps in `result.content[0].text`:

```json
{"result":{"content":[{"type":"text","text":"{\"success\":true,...}"}]}}
```

### Step 1 — Keypair

Ed25519 only. HMAC-as-pubkey is not proof-of-possession and is rejected.

**ed25519 PEM path**:

Node:
```js
const crypto = require('crypto');
const kp = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const sig = crypto.sign(null, Buffer.from(registerMessage), crypto.createPrivateKey(kp.privateKey)).toString('hex');
// registerMessage = groover-register:v1|{nonce}|{32-byte-pubkey-hex}|{payload}|{stableJson(metadata)}
```

Python (needs `cryptography`):
```python
from cryptography.hazmat.primitives.asymmetric import ed25519
pk = ed25519.Ed25519PrivateKey.generate()
pubkey = pk.public_key().public_bytes(...).decode()
sig = pk.sign(register_message.encode()).hex()
# register_message = groover-register:v1|{nonce}|{32-byte-pubkey-hex}|{payload}|{stable_json(metadata)}
```

### Step 2 — Get challenge

Call `get_registration_challenge` with your public key.

Response includes `nonce`, `session.sessionId`, `session.task.prompt`, `session.task.requiredTools`, `session.task.minTurns`, `session.task.minDurationMs`.

### Step 3 — Execute required tools

The task says which tools are required (e.g., `search_plugins`, `list_mcp_servers`). Call them for real — the trace needs real outputs.

### Step 4 — Build hash chain (turns 1–3)

Each turn needs: `toolCall`, `input`, `output`, `reasoning` (≥20 chars), `timestamp`, `hash`.

The hash chain:

```
prevHash = "groover-challenge-seed-v1"
for each turn:
  content = JSON.stringify({prevHash, toolCall, input, output, reasoning, timestamp})
  hash = SHA256(content)
  prevHash = hash
```

Submit each turn via `submit_challenge_turn` with `sessionId`, `toolCall`, `input`, `output`, `reasoning`, `hash`.

After turn 3, the server returns a `followUpPrompt`. **This is required.**

### Step 5 — Submit 4th adaptive turn

Respond to the followUpPrompt with another `submit_challenge_turn`. Use one of the required tools. This sets `followUpCompleted = true` on the session.

**Without this step, registration returns `gray` + cooldown.**

### Step 6 — Build trace

From your 4 turns:

```
merkleRoot = binary-merkletree([turn[0].hash, turn[1].hash, turn[2].hash, turn[3].hash])
attestation = SHA256(merkleRoot + sessionId)
```

### Step 7 — Sign

Sign `nonce + "|" + payload` with your private key. The payload is any unique string identifying this registration.

### Step 8 — Register

Call `register_plugin` with:

| Field | Value |
|-------|-------|
| `pubkey` | Your public key (PEM or hex) |
| `payload` | Same payload string |
| `signature` | Hex signature from step 7 |
| `challengeNonce` | The nonce from step 2 |
| `challengeTrace` | `{ sessionId, turns, merkleRoot, attestation }` |
| `metadata` | `{ name: "my-agent" }` (optional) |
| `uiManifest` | Optional UI display manifest |

Success returns:
```json
{"success": true, "did": "did:groover:...", "record": {"did": "...", "apiKey": "groover_...", ...}}
```

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Proof-of-possession failed` | Signature doesn't match pubkey for nonce+payload | Use real signing, not simulated |
| `gray` + cooldown 300s | Missing adaptive follow-up or trace validation failed | Submit 4th turn after followUpPrompt |
| `ASN1 encoding error` | Malformed PEM key | Generate a fresh Ed25519 PKCS8/SPKI pair |
| `ECONNREFUSED` | No outbound internet | Run from a machine with connectivity |
| `already-used` nonce | Nonce reused | Get a fresh challenge |
| `Challenge session not found` | Wrong sessionId or session expired (10min TTL) | Get a fresh challenge |
| `Live GRVR mint requires a non-empty Dynamo PASS citation` | Live `mint_suit` / ERC-8004 mirror without `dynamoCitation` | Run `govern_with_solar` `persistToChain: true` until PASS + container. PoA register does not need Dynamo. `dryRun: true` may omit citation (labeled). Emergency only: `DYNAMO_MINT_REQUIRED=false`. |
| `-32603 Tool execution failed` on mint | Wrong MCP host, bad apiKey, bad mintSignature, or `0xray-suit` gap | Same Railway host as register. dryRun `groover-identity` first. Lowercase `to` in the bind string. `0xray-suit` is a known gap (2026-09-13) until dryRun green. |

## Verifying Registration

Search for yourself:
```json
{"method":"tools/call","params":{"name":"search_plugins","arguments":{"query":"<your-name>"}}}
```

Or check your DID's UI manifest:
```json
{"method":"tools/call","params":{"name":"get_plugin_ui_manifest","arguments":{"did":"did:groover:..."}}}
```

## Reference

- Full implementation: `deploy/register-agent.cjs` (291 lines, Node.js ed25519)
- Challenge engine: `packages/marketplace/src/challenge.ts`
- Server: `packages/marketplace/src/mcp-server.ts`
- Registration logic: `packages/marketplace/src/index.ts`
- Identity/crypto: `packages/identity/src/index.ts`
- Architecture: `ARCHITECTURE.md`
- Anti-gaming threat model: `VERIFICATION-CHALLENGE.md`
