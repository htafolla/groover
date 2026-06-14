---
sidebar_position: 2
---

# Architecture

## High-Level Structure

```
groover/
├── packages/
│   ├── core/                    # Cross-Correlation + Diffuser Engine
│   ├── marketplace/             # Plugin registry, CLI, search, challenge
│   │   └── src/
│   │       ├── index.ts         # registerPlugin, getRegistrationChallenge, search
│   │       ├── challenge.ts     # Adaptive multi-turn MCP challenge sessions
│   │       ├── mcp-server.ts    # HTTP MCP server for Railway
│   │       └── agent-ui-manifest.ts
│   ├── chrono/                  # Temporal Resonance + versioning
│   ├── identity/                # Agent Identity + DID + API key issuance
│   └── xray/                    # 0xRay MCP execution & orchestration
├── deploy/
│   └── register-agent.cjs       # E2E agent registration script
├── railway.json                 # Railway deployment config
└── website/                     # Docusaurus documentation site
```

## Registration & Verification Data Flow

```
Agent (with MCP client)
    ↓ (1) get_registration_challenge → nonce + challenge session
    ↓ (2) Multi-turn MCP orchestration (search_plugins, list_mcp_servers)
    ↓ (3) Build hash-chained trace → merkle root + attestation
    ↓ (4) sign(nonce + payload) → ed25519 PoP signature
    ↓ (5) register_plugin(pubkey, signature, challengeNonce, challengeTrace)
        │
        ├── Crypto PoP verification (ed25519)
        ├── Dynamo resonance check → privileged path (reduced minTurns, relaxed semantic threshold)
        │   └── resonance ≥ 0.8 → privileged: true
        ├── xray reasoning evaluation (keyword fallback)
        ├── Challenge trace validation (hash chain, merkle, min turns/duration/tools)
        ├── Dynamo governance gate (xray-governance, graceful degradation)
        └── Codex enforcement (xray-enforcer, graceful degradation)
            │
            ├── Valid → Mint DID + API key + Registry entry (reputation 1.0)
            └── Invalid/Gray → "Try again later" + exponential backoff
```

## Adaptive Challenge Design

The challenge is NOT a trivial puzzle. It requires genuine agent behavior:

1. **Session-based**: Server issues a `sessionId` + task prompt. Agent must maintain state.
2. **Multi-turn**: Minimum 3 turns + 1 adaptive follow-up turn, each exercising real MCP tools.
3. **Hash-chained trace**: Each turn's hash depends on the previous (SHA-256 chain).
4. **Merkle root + attestation**: All turns aggregated into a merkle tree; attestation binds merkle root to sessionId.
5. **Behavioral signals**: min turns, min duration, required tools, reasoning depth (20+ chars per turn).
6. **Semantic reasoning**: `xrayBridge.enforce('reasoning-evaluation', ...)` evaluates reasoning trace against task prompt. Falls back to keyword coverage check (`< 25%` → violation) when xray MCP unavailable.
7. **Tamper-proof**: Any modification to a turn breaks the hash chain.
8. **Rate limiting**: 3 failures → exponential backoff.
9. **Privileged path**: Agents with prior Dynamo governance resonance ≥ 0.8 get reduced minTurns (2 instead of 3) and relaxed semantic threshold (12.5% instead of 25%). Checked via xrayBridge.govern after PoP, before validation. Graceful degradation when MCP unavailable.

## Cross-Correlation Engine

Uses patterns from zigzag/Diffuser:
- Semantic similarity (embeddings)
- Temporal resonance (chrono)
- Governance alignment (Dynamo)
- Real-time X/web signals

## Known Trade-offs & Limitations

- **In-memory sessions**: Sessions stored in a `Map` — server restart clears all pending sessions.
- **Single-process store**: Not thread-safe. Needs Redis/Postgres for multi-instance scaling.
- **No TLS termination**: Plain HTTP — Railway handles TLS at the reverse proxy.
- **MCP graceful degradation**: When xray MCP servers are unavailable, registration proceeds with warnings.
- **Nixpacks builder**: Type checking runs at build time but uses `tsx` at runtime.
- **Race window in min duration check**: Timestamps in hash chain detect tampering.
- **No graceful shutdown**: On SIGTERM, in-flight requests may be dropped.
- **No file locking on registry.json**: Safe in single-process; concurrent writes would corrupt.
- **Error message exposure**: Sanitized with whitelist; unknown errors return "Internal server error".
- **Semantic check**: Uses xrayBridge.enforce reasoning evaluation when available; falls back to keyword-based coverage check. The keyword fallback uses prefix-based matching against task prompt terms as a proxy for true semantic understanding.
