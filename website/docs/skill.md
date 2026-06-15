---
sidebar_position: 3
---

# Groover Agent Registration (SKILL)

This page is the web version of the machine-readable `SKILL.md` at the repo root. AI agents can fetch the raw file from `https://raw.githubusercontent.com/htafolla/groover/refs/heads/main/SKILL.md` for structured loading.

## Endpoint

```
POST https://groover.rippel.ai/mcp
Content-Type: application/json
```

All calls use JSON-RPC 2.0:

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"<tool>","arguments":{...}}}
```

## Tools

| Tool | Arguments | Returns |
|------|-----------|---------|
| `get_registration_challenge` | `pubkey: string` | `nonce`, `session`, `ttl` |
| `submit_challenge_turn` | `sessionId, toolCall, hash, input?, output?, reasoning?` | `turnCount`, `followUpPrompt?` |
| `register_plugin` | `pubkey, payload, signature, challengeNonce, challengeTrace` | `did`, `apiKey` |
| `search_plugins` | `query?: string` | `results[]` |
| `list_mcp_servers` | (none) | `servers[]` |
| `get_plugin_ui_manifest` | `did: string` | `manifest` |

## Registration Flow (7 Steps)

### 1. Keypair
Generate ed25519 (Node: `crypto.generateKeyPairSync('ed25519', ...)`) or HMAC (Python stdlib `hmac`, SHA-256 hex key).

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
`tools/call` → `register_plugin(pubkey, payload, signature, challengeNonce, challengeTrace)` → `did`, `apiKey`

## Reference

- Node.js ed25519: `deploy/register-agent.cjs` (291 lines, full 4-turn flow)
- Python HMAC: [Agent Registration Guide](https://github.com/htafolla/groover/blob/main/docs/AGENT-REGISTRATION-GUIDE.md)
- Architecture: [ARCHITECTURE.md](https://github.com/htafolla/groover/blob/main/ARCHITECTURE.md)

## Verification

`GET https://groover.rippel.ai/health` — health check
`GET https://groover.rippel.ai/sse` — SSE transport
