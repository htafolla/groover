# Groover Architecture 

## High-Level Structure (ASCII Tree)
```
groover/
├── packages/
│   ├── core/                    # Cross-Correlation + Diffuser Engine (from zigzag)
│   ├── marketplace/             # Plugin registry, CLI, search, challenge
│   │   └── src/
│   │       ├── index.ts         # registerPlugin, getRegistrationChallenge, search
│   │       ├── challenge.ts      # Adaptive multi-turn MCP challenge sessions
│   │       ├── mcp-server.ts     # HTTP MCP server for Railway
│   │       └── agent-ui-manifest.ts
│   ├── chrono/                  # Temporal Resonance + versioning (from chrono-warp-drive)
│   ├── identity/                # Agent Identity + DID + API key credential issuance
│   └── xray/                    # 0xRay MCP execution & orchestration
├── deploy/
│   └── register-agent.cjs       # E2E agent registration script
├── examples/
│   └── stringray-plugin-consumer/
├── docs/
│   └── mcp-schemas/
└── railway.json                 # Railway deployment config
```

## Registration & Verification Data Flow (Proof of Autonomy)
```
Agent (with MCP client)
    ↓ (1) get_registration_challenge → nonce + challenge session)
    ↓ (2) Multi-turn MCP orchestration (search_plugins, list_mcp_servers, synthesize)
    ↓ (3) Build hash-chained trace → merkle root + attestation)
    ↓ (4) sign(nonce + payload) → ed25519 PoP signature)
    ↓ (5) register_plugin(pubkey, signature, challengeNonce, challengeTrace)
        │
        ├── Crypto PoP verification (ed25519)
        ├── Challenge trace validation (hash chain, merkle, min turns/duration/tools)
        ├── Dynamo governance gate (xray-governance, graceful degradation)
        └── Codex enforcement (xray-enforcer, graceful degradation)
            │
            ├── Valid → Mint DID + API key + Registry entry (reputation 1.0)
            └── Invalid/Gray → "Try again later" + exponential backoff
```

## Adaptive Challenge Design (packages/marketplace/src/challenge.ts)

The challenge is NOT a trivial puzzle. It requires genuine agent behavior:

1. **Session-based**: Server issues a `sessionId` + task prompt. Agent must maintain state.
2. **Multi-turn**: Minimum 3 turns, each exercising real MCP tools.
3. **Hash-chained trace**: Each turn's hash depends on the previous (SHA-256 chain).
4. **Merkle root + attestation**: All turns aggregated into a merkle tree; attestation binds merkle root to sessionId.
5. **Behavioral signals**: min turns (3), min duration (3-4s), required tools (`search_plugins`, `list_mcp_servers`), reasoning depth (20+ chars per turn).
6. **Tamper-proof**: Any modification to a turn breaks the hash chain. Merkle root mismatches invalidate the entire trace.
7. **Rate limiting**: 3 failures → exponential backoff (30s → 60s → 120s → ...).

Real StringRay/0xRay/Groover agents perform this natively. Scripts/humans must maintain full MCP infrastructure per attempt — expensive to scale.

## Cross-Correlation Engine
Uses patterns from zigzag/Diffuser:
- Semantic similarity (embeddings)
- Temporal resonance (chrono)
- Governance alignment (Dynamo)
- Real-time X/web signals

This creates discoverability and composition for autonomous agents.

Under His authority.