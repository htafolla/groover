---
sidebar_position: 1
---

# MCP API Reference

The Groover registry exposes 6 MCP tools via an HTTP JSON-RPC endpoint at `POST /mcp`. Health check at `GET /` or `GET /health`.

## Transport

```
POST https://<host>/mcp
Content-Type: application/json

JSON-RPC 2.0 subset:
{ "jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": { "name": "<tool>", "arguments": {...} } }
```

Errors follow JSON-RPC 2.0 spec:

| Code | Meaning |
|------|---------|
| -32700 | Parse error (malformed JSON) |
| -32601 | Method not found |
| -32602 | Invalid params (e.g., missing pubkey) |
| -32603 | Internal error |

Error messages are sanitized — only whitelisted tokens (`pubkey is required`, `Challenge session not found`, etc.) are returned verbatim; all others return `Internal server error`.

## Tools

### get_registration_challenge

Start the adaptive multi-turn challenge. Returns a nonce for proof-of-possession and a challenge session.

**Arguments:**

| Field | Type | Required |
|-------|------|----------|
| pubkey | string | yes |

**Response:**

```json
{
  "success": true,
  "nonce": "<hex>",
  "ttl": 300000,
  "session": {
    "sessionId": "<hex>",
    "task": { "prompt": "...", "requiredTools": ["search_plugins", "list_mcp_servers"], "minTurns": 3, "minDurationMs": 3000 },
    "status": "pending",
    "followUpPrompt": null,
    "followUpCompleted": false
  }
}
```

### submit_challenge_turn

Submit a single turn of the adaptive challenge. After 3 turns, the server may return a `followUpPrompt` requiring a 4th turn.

**Arguments:**

| Field | Type | Required |
|-------|------|----------|
| sessionId | string | yes |
| toolCall | string | yes |
| input | string | yes |
| output | string | yes |
| reasoning | string | yes (≥ 30 chars for follow-up response) |
| hash | string | yes |

**Response:**

```json
{ "success": true, "sessionId": "...", "turnCount": 3, "followUpPrompt": "..." | null }
```

### register_plugin

Register an agent after completing the challenge. Requires proof-of-possession (ed25519 signature) + challenge trace.

**Arguments:**

| Field | Type | Required |
|-------|------|----------|
| pubkey | string | yes |
| payload | string | yes |
| metadata | object | no |
| signature | string | yes — ed25519 signature of `nonce\|payload` |
| challengeNonce | string | yes — from get_registration_challenge |
| challengeTrace | object | yes — sessionId, turns[], merkleRoot, attestation |
| uiManifest | object | no — UI manifest for agent display |

**Response:**

```json
{
  "success": true,
  "did": "did:groover:<base58>",
  "record": { "did": "...", "pubkey": "...", "apiKey": "...", "reputation": 1.0, ... }
}
```

Or on failure:

```json
{ "success": true, "did": "gray", "record": { "status": "gray", "cooldown": 300000 } }
```

### search_plugins

Search the registry for plugins using cross-correlation signals.

**Arguments:**

| Field | Type | Required |
|-------|------|----------|
| query | string | no (default: "cross-correlation") |

### get_plugin_ui_manifest

Retrieve a registered agent's UI manifest.

**Arguments:**

| Field | Type | Required |
|-------|------|----------|
| did | string | yes |

### list_mcp_servers

List all integrated MCP servers with their roles and key tools.

**Arguments:** none

## MCP Governance Protocol

`xrayBridge.govern()` sends proposals as an array (`{ proposals: [proposal] }`) per 0xRay governance protocol. Each proposal includes a `source` field (required) — automated calls use `source: 'system'`.

## Standard MCP Methods

### initialize

```json
{ "jsonrpc": "2.0", "id": 1, "method": "initialize" }
```

### tools/list

```json
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }
```

## Health Check

```
GET /
GET /health
```

```json
{ "status": "healthy", "server": "groover-registry", "version": "0.2-mvp", "uptime": 123.45 }
```
