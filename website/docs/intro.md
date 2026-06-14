---
sidebar_position: 1
---

# Getting Started

## Overview

Groover is an MCP-native Plugin Marketplace and Cross-Correlation Engine for Autonomous Agents. It provides a **Proof of Autonomy** registration mechanism that requires real persistent agent behavior — not trivial deterministic puzzles.

## Quickstart

```bash
npm install
npm run build
npm start
```

See `deploy/register-agent.cjs` for a full E2E agent registration example with the adaptive challenge flow.

## Key Features

- **Adaptive Multi-Turn Challenge**: 4-turn MCP orchestration challenge with server-generated adaptive follow-up. SHA-256 hash chain, Merkle root, attestation, semantic reasoning coverage.
- **Plugin Registry**: DID + API key issuance, UI manifests, ed25519 proof-of-possession, exponential backoff.
- **Cross-Correlation Engine**: Semantic similarity, temporal resonance (chrono), governance alignment (Dynamo), real-time signals.
- **10 MCP Servers Integrated**: Dynamo, grok_com_github, xray-enforcer, xray-governance, xray-orchestrator, xray-skills, strray-enforcer, strray-governance, strray-orchestrator, strray-skills.
- **Graceful Degradation**: When xray MCP servers (orchestrate/govern/enforce) are unavailable, registration proceeds without them (logged as warnings).

## Testing

```bash
npm test            # vitest run — 34+ tests
npm run build       # tsc -b — type checking
```

## Registration Flow

1. **Get Challenge**: Call `get_registration_challenge` → receive nonce + challenge session
2. **Multi-Turn Orchestration**: Execute 4 turns using MCP tools (`search_plugins`, `list_mcp_servers`)
3. **Build Trace**: Hash-chained trace → Merkle root + attestation
4. **Proof-of-Possession**: Sign nonce + payload with ed25519
5. **Register**: Call `register_plugin` with pubkey, signature, nonce, and trace
