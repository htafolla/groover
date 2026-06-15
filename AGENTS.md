# AGENTS.md — 0xRay Consumer Template

**Version**: 3.0.12
**Updated**: 2026-06-14

## What is 0xRay?

0xRay provides intelligent multi-agent orchestration with automatic delegation and Codex compliance validation under the pure three-subsystem model (Inference + External Governance via Dynamo + Autonomous Engine via thinDispatch 7-flow in MCP orchestrator). Agents operate via YML surfaces and MCP skill servers.

## Available MCP Servers

| Server | Purpose |
|--------|---------|
| `xray-enforcer` | Codex compliance & error prevention |
| `xray-governance` | Proposal governance, codex snapshot |
| `xray-orchestrator` | thinDispatch 7-flow delegation routing |
| `xray-skills` | Skill invocation (code-review, security-audit, researcher, etc.) |

## CLI Commands

```
npx 0xray setup          Full framework configuration
npx 0xray validate        Run Codex compliance validation
npx 0xray status          Show framework status
npx 0xray install <mcp>   Install MCP server (groks)
```

## Governance

All actions are governed by the Universal Development Codex via Dynamo (External Governance SSOT). Governance precedes action.

## Logging

Use `fwLogger` / `frameworkLogger` structured logging only (never `console.*`). Logs go to `logs/framework/activity.log` + `.opencode/logs/`.

## Architecture

- **Inference**: Session capture, pattern accumulation, governance triggers
- **External Governance**: Dynamo Solar SSOT via codex.json
- **Autonomous Engine**: thinDispatch 7-flow in MCP orchestrator

## Complexity Routing

| Complexity | Score | Strategy |
|-----------|-------|----------|
| Simple | ≤15 | Single agent |
| Moderate | ≤25 | Single agent with tools |
| Complex | ≤50 | Multi-agent coordination |
| Enterprise | >50 | Orchestrator-led team |

## Groover Self-Registration

Groover is a live registry (`https://registry-production-e2c4.up.railway.app`) where AI agents prove autonomy and receive a verifiable DID.

### How to Register

1. Generate an ed25519 keypair
2. Call `get_registration_challenge` to start the 4-turn adaptive challenge
3. Complete turns using MCP tools — the server issues an unseen follow-up on turn 3
4. Submit via `register_plugin` with: pubkey, signature over nonce, full challenge trace (hash chain + merkle root + attestation)

Reference implementations:
- **Node.js ed25519**: `deploy/register-agent.cjs` (291 lines, full 4-turn adaptive flow)
- **Python HMAC (stdlib, no deps)**: `docs/AGENT-REGISTRATION-GUIDE.md`
- **Python ed25519**: `docs/AGENT-REGISTRATION-GUIDE.md` (requires `cryptography`)

### How to Verify a DID

- `GET /plugins?did=did:groover:<id>` returns the agent's public key and registration metadata
- The public key is bound to the DID at registration time — verify any signed message from that agent using the stored pubkey
- The behavioral trace is part of the registration record and independently replayable

### Status

- 46 tests passing, `tsc -b` clean
- 3 live DIDs on Railway (opencode, Grok x2)
- Standard MCP HTTP transport (`GET /sse` + `POST /messages?sessionId=UUID` + `POST /mcp`)
- 12 anti-gaming gates — no admin bypass, no privileged paths
