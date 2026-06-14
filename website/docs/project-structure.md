---
sidebar_position: 4
---

# Project Structure

```
groover/
├── packages/
│   ├── marketplace/             # Plugin registry, challenge engine, MCP server
│   │   └── src/
│   │       ├── index.ts         # registerPlugin, getRegistrationChallenge, searchPlugins, CLI
│   │       ├── challenge.ts     # Adaptive multi-turn MCP challenge sessions
│   │       ├── mcp-server.ts    # HTTP MCP server for Railway
│   │       ├── agent-ui-manifest.ts  # UI manifest schema + validation
│   │       └── index.test.ts    # 14 tests
│   ├── core/                    # Cross-Correlation + Diffuser Engine
│   │   └── src/
│   │       ├── index.ts         # CoreEngine, rankWithDynamo
│   │       └── index.test.ts    # 4 tests
│   ├── chrono/                  # Temporal Resonance + versioning
│   │   └── src/
│   │       ├── index.ts         # TemporalResonanceEngine, P_o, harmonic oscillator
│   │       └── index.test.ts    # 4 tests
│   ├── identity/                # Agent Identity + DID + API key issuance
│   │   └── src/
│   │       ├── index.ts         # generateDID, generateApiKey, keypair, sign/verify
│   │       └── index.test.ts    # 4 tests
│   └── xray/                    # 0xRay MCP execution & orchestration bridge
│       └── src/
│           ├── index.ts         # MCPBridge, frameworkLogger, listMcpServers
│           └── index.test.ts    # 8 tests
├── deploy/
│   ├── register-agent.cjs       # Full E2E agent registration script (adaptive 4-turn flow)
│   └── confirm-railway-endpoints.ts  # Deploy verification script
├── docs/
│   ├── mcp-servers-index.md     # MCP server reference
│   ├── mcp-tools-index.json     # Tools index
│   └── mcp-schemas/             # MCP schema definitions
├── website/                     # Docusaurus documentation site
├── data/                        # Registry persistence (registry.json)
├── railway.json                 # Nixpacks build + deploy config
├── ARCHITECTURE.md              # System architecture
├── VERIFICATION-CHALLENGE.md    # Challenge design doc
├── AGENTS.md                    # 0xRay framework config
└── package.json                 # Root monorepo config
```

## Key Source Files

| File | Purpose |
|------|---------|
| `packages/marketplace/src/challenge.ts` | ChallengeSession, validateTrace, buildTurn, computeTurnHash, computeMerkleRoot, computeReasoningCoverage, generateFollowUp, submitTurn |
| `packages/marketplace/src/index.ts` | registerPlugin (PoP + followUpCompleted gate + validateTrace + enforce), getRegistrationChallenge, searchPlugins, CLI |
| `packages/marketplace/src/mcp-server.ts` | HTTP MCP server — 6 tools, adaptive follow-up, health endpoint, SIGTERM handler |
| `packages/xray/src/index.ts` | MCPBridge (orchestrate/govern/enforce), frameworkLogger, listMcpServers |
| `packages/identity/src/index.ts` | ed25519 key generation, signing, verification, DID/API key generation |
| `packages/core/src/index.ts` | CrossCorrelationEngine, rankWithDynamo |
