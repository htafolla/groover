---
sidebar_position: 3
---

# Groover Agent Registration (SKILL)

This page is the web version of the machine-readable `SKILL.md` at the repo root. AI agents can fetch the raw file from `https://raw.githubusercontent.com/htafolla/groover/refs/heads/main/SKILL.md` for structured loading.

## Endpoint

```
POST https://registry-production-e2c4.up.railway.app/mcp
Content-Type: application/json
```

Register **and** `mint_suit` on this **same** host. `register-agent.cjs`
defaults `REGISTRY_URL` here. After a Railway register, minting on
`https://groover.rippel.ai/mcp` returns `-32603 Tool execution failed`
(DID/apiKey not on that store).

All calls use JSON-RPC 2.0:

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"<tool>","arguments":{...}}}
```

## Tools

| Tool | Arguments | Returns |
|------|-----------|---------|
| `get_registration_challenge` | `pubkey: string` | `nonce`, `session`, `ttl` |
| `submit_challenge_turn` | `sessionId, toolCall, hash, input?, output?, reasoning?` | `turnCount`, `followUpPrompt?` |
| `register_plugin` | `pubkey, payload, signature, challengeNonce, challengeTrace` | `{ did, apiKey }` — **apiKey is issued here** |
| `mint_suit` | **required** `did, apiKey, pack, to, issuedAtMs, mintSignature` (+ optional `inventory`, `inspect`, `dynamoCitation`, `fullBox7D`, `dryRun`) | GRVR mint / dry-run |
| `search_plugins` | `query?: string` | `results[]` |
| `list_mcp_servers` | (none) | `servers[]` |
| `get_plugin_ui_manifest` | `did: string` | `manifest` |

## Registration Flow (7 Steps)

### 1. Keypair
Generate Ed25519 PEM (Node: `crypto.generateKeyPairSync('ed25519', ...)`).
**Write the secret (`chmod 600`) and reuse `--pubkey` / `--secret-key`.**
The register script's auto-gen stays in memory and is discarded — you cannot
mint later. HMAC is rejected.

### 2. Get Challenge
`tools/call` → `get_registration_challenge(pubkey)` → `nonce`, `sessionId`

### 3. Turns 1–3
Execute required tools from the challenge. Submit each turn via `submit_challenge_turn` with hash chain:
```
prevHash = "groover-challenge-seed-v1"
content = JSON.stringify({prevHash, toolCall, input, output, reasoning, timestamp})
hash = SHA256(content)
```

### 4. Adaptive Follow-Up
Server returns `followUpPrompt` after turn 3. Submit turn 4 responding to it. **Mandatory** — without it, registration returns gray + 300s cooldown.

### 5. Build Envelope
```
merkleRoot = merkletree([h0, h1, h2, h3])
attestation = SHA256(merkleRoot + sessionId)
```

### 6. Sign PoP
Sign `nonce + "|" + payload` with your private key.

### 7. Register
`tools/call` → `register_plugin(pubkey, payload, signature, challengeNonce, challengeTrace)` → **`{ did, apiKey }` issued by the registry**. Do not invent `apiKey`.

## Factory sequence

Same Railway MCP for register **and** mint. Persist the secret. Do not pin `86025`.

1. **Register** on `https://registry-production-e2c4.up.railway.app/mcp`. Issues `{ did, apiKey }` (DID is **64 hex**).
2. **Always Dynamo-gate:** `POST …/govern_with_solar` `persistToChain: true`. Loop until `PASS` + real solar + not `storm`. `dynamoCitation` = `0x` + `containerId`. Do not invent it. Do not mint without a container.
3. **`mint_suit`** on that **same** host. Prefer the **full 64-hex** registry
   DID on GRVR v5 `0x045B35480F289F8f83F53345A0f367875958957a` (accepts 28-byte
   legacy and 76-byte registry DIDs). Truncation to 16 hex was a v4
   `InvalidDid` workaround only — do not use it for new mints.

   ```
   groover-mint:v1|{did}|{pack}|{to.toLowerCase()}|{issuedAtMs}
   ```

   Proven 2026-09-13: full DID (didLen 76) + Dynamo PASS → v5 token #1, tx
   `0x3d81ad93b4e6e37b79f338c1dd6fbb99c680a59cd345423a9d415671ee236ec1`.

   Lowercase `to`. `issuedAtMs` within ~5 minutes. **dryRun ≠ live.** If full
   DID + citation still fails live after dryRun green → ops/minter, not “bad DID”.

   `0xray-suit` requires `inventory` object + `inspect.ok === true`; `inspect.dna`
   must match keccak(canonical inventory without `mintedAt`/`dna`). Pack is a
   **known gap** until **live** mint is green. Opaque `-32603` also means wrong
   host / bad apiKey / bad signature.
4. **Pin our `agentId`** — not demo `86025`.
5. **Shops** — OWS pays Clearing; OWS may be mint `to`. Not an API key.

Railway `GRVR_PRIVATE_KEY` ≠ agent `groover_…`. See [Factory parity](./factory-parity.md).

## Reference

- Node.js ed25519: `deploy/register-agent.cjs` (291 lines, full 4-turn flow)
- Python Ed25519: [Agent Registration Guide](https://github.com/htafolla/groover/blob/main/docs/AGENT-REGISTRATION-GUIDE.md)
- Architecture: [ARCHITECTURE.md](https://github.com/htafolla/groover/blob/main/ARCHITECTURE.md)

## Verification

`GET https://registry-production-e2c4.up.railway.app/health` — health check
`GET https://registry-production-e2c4.up.railway.app/sse` — SSE transport
