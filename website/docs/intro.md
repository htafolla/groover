---
sidebar_position: 1
---

# Getting Started

## Core docs (every project)

Maintain these first. Same files on the registry HTTP server and this
site's static root (path-as-root):

| File | Live |
|------|------|
| [README.md](pathname:///README.md) | `/README.md` |
| [CHANGELOG.md](pathname:///CHANGELOG.md) | `/CHANGELOG.md` |
| [package.json](pathname:///package.json) | `/package.json` |
| [llms.txt](pathname:///llms.txt) | `/llms.txt` |
| [AGENTS.md](pathname:///AGENTS.md) | `/AGENTS.md` |
| [SKILLS.md](pathname:///SKILLS.md) | `/SKILLS.md` |
| This Docusaurus site | `/docs` |

Registry: `https://registry-production-e2c4.up.railway.app` — markdown, not
the MCP catch-all banner.

## Groover

Groover is an MCP-native Plugin Marketplace and Cross-Correlation Engine for Autonomous Agents. It provides a **Proof of Autonomy** registration mechanism that requires real persistent agent behavior — not trivial deterministic puzzles.

### Quickstart

```bash
npm install
npm run build
npm start
```

See `deploy/register-agent.cjs` for a full E2E agent registration example with the adaptive challenge flow.

Factory loop: persist Ed25519 → register **and** `mint_suit` on Railway
`…e2c4.up.railway.app/mcp` → Dynamo PASS+container (solar hammer: retry
until approved) → mint the **full** 64-hex DID on GRVR v5 `0x045B…` → pin
**your** `agentId` → shops.
[Factory parity](./factory-parity.md).

### Key Features

- **Adaptive Multi-Turn Challenge**: 4-turn MCP orchestration challenge with server-generated adaptive follow-up. SHA-256 hash chain, Merkle root, attestation, semantic reasoning coverage.
- **Plugin Registry**: DID + API key issuance, UI manifests, ed25519 proof-of-possession, exponential backoff.
- **Cross-Correlation Engine**: Semantic similarity, temporal resonance (chrono), governance alignment (Dynamo), real-time signals.
- **MCP Ecosystem**: Dynamo, grok_com_github, xray-enforcer, xray-governance, xray-orchestrator, xray-skills, strray-* servers available for correlation.
- **Graceful Degradation**: When xray MCP servers (orchestrate/govern/enforce) are unavailable, registration proceeds without them (logged as warnings).

### Testing

```bash
npm test            # vitest run
npm run build       # tsc -b — type checking
```

### Registration Flow

1. **Get Challenge**: Call `get_registration_challenge` → receive nonce + challenge session
2. **Multi-Turn Orchestration**: Execute 4 turns using MCP tools (`search_plugins`, `list_mcp_servers`)
3. **Build Trace**: Hash-chained trace → Merkle root + attestation
4. **Proof-of-Possession**: Sign nonce + payload with ed25519
5. **Register**: Call `register_plugin` with pubkey, signature, nonce, and trace — **issues `{ did, apiKey }`** (do not invent the key)
