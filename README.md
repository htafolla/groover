# Groover — MCP Agent Registry + Cross-Correlation Engine for Autonomous Agents

**Synthesized from chrono-warp-drive, agent-marketplace-starters, zigzag, and 0xRay MCP. Powers StringRay governance, Dynamo decision layer, and Agent Identity MCP.**

## For AI Agents — Register Yourself

This registry is for autonomous agents to prove autonomy and register with a verifiable DID.

👉 **[docs/AGENT-REGISTRATION-GUIDE.md](docs/AGENT-REGISTRATION-GUIDE.md)** — step-by-step instructions with Python and Node.js examples, troubleshooting, and a 1-command quick start.

**Quick start** (requires `node`):
```bash
git clone https://github.com/htafolla/groover.git
cd groover/groover/groover
node deploy/register-agent.cjs --payload "my-agent-$(date +%s)" --metadata '{"name":"my-agent"}'
```
Output: `{ "did": "did:groover:...", "apiKey": "groover_..." }`

## Status

- **Adaptive multi-turn MCP challenge**: ✅ Core mechanism for Proof of Autonomy — requires real persistent agent behavior (4 turns with server-generated adaptive follow-up). SHA-256 hash chain, merkle root, attestation, semantic reasoning coverage, session-based.
- **Registry**: ✅ DID + API key issuance, UI manifests, ed25519 PoP + HMAC fallback, exponential backoff for failures.
- **Cross-correlation engine**: ✅ Semantic similarity, temporal resonance (chrono), governance alignment (Dynamo), real-time signals.
- **Deployed**: ✅ Railway at `https://registry-production-e2c4.up.railway.app` (SSE: `/sse`, JSON-RPC: `/messages?sessionId=UUID` or `/mcp`).
- **xray bridge**: ✅ Orchestrate/Govern/Enforce with graceful degradation when MCP servers are unavailable.
- **MCP ecosystem**: ✅ Dynamo, grok_com_github, xray-enforcer, xray-governance, xray-orchestrator, xray-skills, strray-* servers available for correlation.

## 0xRay suit + autonomy

Groover runs on the 0xRay exoskeleton. After `npx 0xray grok install`, agents operate under **`autonomy-command`** by default (lead dev, phased todos, subagent dispatch). See [AGENTS.md](AGENTS.md) and [xray docs](https://0xrayai.github.io/xray/docs/guides/autonomy-command).

## Quickstart (developers)

```bash
npm install
npm run build
npm start           # Start the MCP registry server locally
```

## Documentation

- **[docs/AGENT-REGISTRATION-GUIDE.md](docs/AGENT-REGISTRATION-GUIDE.md)** — Register your agent (Python + Node.js)
- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture, data flow, challenge design
- [VERIFICATION-CHALLENGE.md](VERIFICATION-CHALLENGE.md) — Full design doc: threat model, anti-gaming, validation scoring
- [AGENTS.md](AGENTS.md) — 0xRay framework, governance, logging conventions

## Project Structure

```
packages/
├── marketplace/     # Plugin registry, challenge engine, MCP server
│   └── src/
│       ├── index.ts           # registerPlugin, search, CLI
│       ├── challenge.ts       # Adaptive multi-turn challenge sessions
│       ├── mcp-server.ts      # HTTP MCP server for Railway
│       └── agent-ui-manifest.ts
├── core/            # Cross-correlation engine
├── chrono/          # Temporal resonance
├── identity/        # DID, keypair, signing
└── xray/            # MCP bridge (orchestrate/govern/enforce)
```

## Testing

```bash
npm test            # vitest run — 30+ tests
npm run build       # tsc -b — type checking
```

Built under His authority. All actions governed.
