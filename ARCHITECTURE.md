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

## Known Trade-offs & Limitations

- **In-memory sessions**: Challenge sessions are stored in a `Map` in `challenge.ts`. A server restart clears all pending sessions. TTL sweep runs every 60s; sessions older than 10 min are expired. No persistence layer.
- **Single-process session store**: The `Map` is not thread-safe. Acceptable for Node single-process deployment; would need a shared store (Redis, Postgres) for multi-instance scaling.
- **No TLS termination**: The MCP server listens on plain HTTP. In production, terminate TLS at the reverse proxy (Railway handles this automatically).
- **MCP graceful degradation**: When xray MCP servers (orchestrate/govern/enforce) are unavailable, registration proceeds without them (logged as warnings). The challenge trace is the primary behavioral gate; MCP gates are supplementary.
- **Nixpacks builder**: Railway uses Nixpacks, not Docker. Type checking (`tsc -b --noEmit`) runs at build time but does not produce output; runtime uses `tsx`. True type safety enforced in CI rather than at deploy.
- **Race window in min duration check**: The duration check uses wall-clock timestamps from turns. A fast agent could manipulate timestamps, but the hash chain integrity check detects timestamp tampering (timestamps are included in the hash).
- **No graceful shutdown**: On Railway SIGTERM, the server hard-exits. In-flight requests are dropped. Impact is low for MVP (MCP calls complete in ms).
- **No file locking on registry.json**: Sequential writes in single-process Node are safe; concurrent writes from multiple processes would corrupt the file.
- **Error message exposure**: The MCP server sanitizes error responses with a whitelist of safe message patterns. Unexpected errors return `Internal server error` to clients while logging the full detail server-side.

Under His authority.