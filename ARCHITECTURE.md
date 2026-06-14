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
    ↓ (1) get_registration_challenge → nonce + challenge session
    ↓ (2) Multi-turn MCP orchestration (search_plugins, list_mcp_servers, synthesize)
    ↓ (3) Build hash-chained trace → merkle root + attestation
    ↓ (4) sign(nonce + payload) → ed25519 PoP signature
    ↓ (5) register_plugin(pubkey, signature, challengeNonce, challengeTrace)
        │
        ├── Crypto PoP verification (ed25519)
        ├── Dynamo resonance check → privileged path (resonance ≥ 0.8)
        │   └── reduced minTurns, relaxed semantic threshold
        ├── Challenge trace validation
        │   ├── Structural: hash chain, merkle, min turns/duration/tools
        │   ├── Semantic: xrayBridge.enforce evaluation (or keyword fallback) ≥ 25% (12.5% for privileged)
        │   └── Adaptive: follow-up completion gate
        ├── Dynamo governance gate (xray-governance, graceful degradation)
        └── Codex enforcement (xray-enforcer, graceful degradation)
            │
            ├── Valid → Mint DID + API key + Registry entry (reputation 1.0)
            └── Invalid/Gray → "Try again later" + exponential backoff
```

## Anti-Gaming Gates (packages/marketplace/src/challenge.ts)

The challenge uses 12 stacked layers to prevent automated gaming:

| # | Gate | Mechanism | Enforcement Point |
|---|------|-----------|-------------------|
| 1 | Crypto PoP | ed25519 signature over nonce + payload | registerPlugin |
| 2 | Session state machine | pending → in-progress → completed | getRegistrationChallenge → submitTurn |
| 3 | Adaptive follow-up | Server issues dynamic prompt after 3rd turn; 4th turn required | generateFollowUp + followUpCompleted gate |
| 4 | Hash chain integrity | Each turn includes SHA-256 of prior turn | validateTrace |
| 5 | Merkle root + attestation | All turns bound to session ID | validateTrace |
| 6 | Duration enforcement | Wall-clock min 3-4s between first and last turn | validateTrace |
| 7 | Required tools | search_plugins and/or list_mcp_servers must appear | validateTrace |
| 8 | Reasoning depth | ≥ 20 chars per turn | validateTrace |
| 9 | Semantic coverage | xrayBridge.enforce reasoning evaluation (keyword fallback) ≥ 25% (12.5% privileged) | validateTrace + index.ts |
| 10 | Exponential backoff | 3 failures → cooldown doubles | rateLimitedUntil + failCount |
| 11 | Dynamo privileged path | resonance ≥ 0.8 → minTurns 3→2, coverage 25%→12.5% | computeDynamoResonance + xrayBridge.govern |
| 12 | Real reasoning tool | CJS reference attempts opencode run with retry + graceful fallback | deploy/register-agent.cjs |

## Validation Scoring (max 105)

| Check | Points | Privileged Adjust |
|-------|--------|-------------------|
| Minimum turns | 25 | effectiveMinTurns = max(2, minTurns - 1) |
| Minimum duration | 10 | unchanged |
| Required tools | 15 | unchanged |
| Hash chain integrity | 20 | unchanged |
| Merkle root | 10 | unchanged |
| Attestation | 10 | unchanged |
| Adaptive follow-up | 15 | effectiveMinTurns + 1 |
| **Total** | **105** | Passing ≥ 70 |

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
- **Semantic check is keyword-based by default**: The `computeReasoningCoverage` function uses prefix-based keyword matching. When xrayBridge is available, it is replaced by `xrayBridge.enforce('reasoning-evaluation', ...)` with the full reasoning trace + task prompt. Falls back to keyword when xray MCP is unavailable (graceful degradation).

Under His authority.