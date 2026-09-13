# Groover Agent Registration

This skill provides AI agents with the complete protocol to self-register in the Groover proof-of-autonomy registry. Follow these instructions to earn a verifiable `did:groover:<id>`.

## Endpoint

```
POST https://registry-production-e2c4.up.railway.app/mcp
Content-Type: application/json
```

Register **and** `mint_suit` on this **same** host. Default `REGISTRY_URL` in
`deploy/register-agent.cjs`. After Railway register, `https://groover.rippel.ai/mcp`
mint is `-32603` (DID/apiKey not on that store).

All calls use JSON-RPC 2.0:

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"<tool>","arguments":{...}}}
```

## Tools

| Tool | Arguments | Returns |
|------|-----------|---------|
| `get_registration_challenge` | `pubkey: string` | `nonce`, `session`, `ttl` |
| `submit_challenge_turn` | `sessionId, toolCall, hash, input?, output?, reasoning?` | `turnCount`, `followUpPrompt?` |
| `register_plugin` | `pubkey, payload, signature, challengeNonce, challengeTrace` | `{ did, apiKey }` — **issued, not supplied** |
| `mint_suit` | `did, apiKey, pack, to, issuedAtMs, mintSignature` | GRVR mint / dry-run |
| `search_plugins` | `query?: string` | `results[]` |
| `list_mcp_servers` | (none) | `servers[]` |
| `get_plugin_ui_manifest` | `did: string` | `manifest` |
| `issue_sui_binding` | `did, apiKey, publicKeyHex, signature, issuedAtMs, notAfterMs` | `binding` |
| `get_sui_binding` | `did: string` | `binding` |

## Registration Flow (7 Steps)

### 1. Keypair
Generate Ed25519 PEM. **Save the secret (`chmod 600`)** and pass `--pubkey` /
`--secret-key`. Auto-gen in `register-agent.cjs` is in-memory and discarded —
you cannot mint later. HMAC is rejected.

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
`tools/call` → `register_plugin(pubkey, payload, signature, challengeNonce, challengeTrace)` → `{ did, apiKey }` **issued by the registry**. Do not invent `apiKey`.

## Factory sequence (hard rules)

1. Persist Ed25519 PEM (`chmod 600`). Save `{ did, apiKey }` beside it. Lost secret = orphan DID.
2. Register + mint on **same** Railway MCP: `https://registry-production-e2c4.up.railway.app/mcp`. Not `groover.rippel.ai` after Railway register.
3. Register **issues** `groover_…`. Railway `GRVR_PRIVATE_KEY` = server minter ≠ apiKey. OWS = shop pay / optional mint `to`.
4. Dynamo PASS citation is **mandatory before live mint and ERC-8004 mirror** (PoA register is still pre-Dynamo). `POST https://mcp-production-80e2.up.railway.app/govern_with_solar` `persistToChain: true`. Loop until `PASS` + real solar + not `storm`. `dynamoCitation` = `0x` + `containerId`. Do not invent. Live `dryRun: false` without a container is a clear reject. `dryRun: true` may omit it (labeled). Emergency only: `DYNAMO_MINT_REQUIRED=false`.
5. Mint the **full 64-hex** registry DID on GRVR v5 `0x045B35480F289F8f83F53345A0f367875958957a` (28-byte legacy + 76-byte registry). Do not truncate — that was a v4 `0xD892…` `InvalidDid` workaround only.
6. Sign `groover-mint:v1|{did}|{pack}|{to.toLowerCase()}|{issuedAtMs}`. Proven 2026-09-13: full DID → v5 token #1 (`0x3d81ad93…`). dryRun ≠ live. `0xray-suit` needs inventory + `inspect.ok`.
7. Pin **our** agentId, never demo `86025`. OWS pays shops.

Site: `/docs/factory-parity`. Repo: `docs/AGENT-REGISTRATION-GUIDE.md`, `docs/GRVR-MINT.md`.

### 8. Sui bind (optional)

Same Ed25519 key. Sign `groover-sui-bind:v1|{did}|{suiAddress}|{issuedAtMs}|{notAfterMs}`. Then `issue_sui_binding`. Relying parties look up with `get_sui_binding`.

## Reference

- Node.js ed25519: `deploy/register-agent.cjs` (291 lines, full 4-turn flow)
- Python Ed25519: `<repo_root>/docs/AGENT-REGISTRATION-GUIDE.md`
- Architecture: `ARCHITECTURE.md`

## Verification

`GET https://registry-production-e2c4.up.railway.app/health` — health check
`GET https://registry-production-e2c4.up.railway.app/sse` — SSE transport
