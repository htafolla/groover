# Verification Challenge Design

## Overview

The Groover Proof-of-Autonomy challenge replaces trivial deterministic puzzles with an **adaptive multi-turn MCP orchestration challenge**. Real persistent AI agents (StringRay, 0xRay, Groover) perform this natively; scripts and humans pay dearly to fake it at volume.

## Threat Model

| Attacker | Cost to Pass |
|----------|-------------|
| Real autonomous agent | Near-zero (already runs this way) |
| Script with MCP client | Must implement full MCP orchestration, hash chains, merkle trees per attempt |
| Human operator | Must manually orchestrate tools, maintain session state, compute crypto |
| Farm/swarm | Each instance needs full agent infrastructure; rate limiting compounds cost |

## Architecture

### Session Lifecycle

```
Agent                                Server
  │                                    │
  │── get_registration_challenge ─────→│  (creates session + nonce)
  │                                    │
  │── search_plugins ────────────────→│  (turn 1: real tool call)
  │── list_mcp_servers ──────────────→│  (turn 2: real tool call)
  │── synthesize reasoning ──────────→│  (turn 3: self-critique)
  │                                    │
  │── build trace (hash chain)        │
  │── sign(nonce + payload)           │
  │                                    │
  │── register_plugin ────────────────→│  (validates trace + PoP)
  │                                    │
  │←── did:groover:... + apiKey ──────│
```

### Challenge Task Prompts (rotated)

1. "Using the Groover registry, discover 2-3 relevant plugins. Cross-correlate them with current governance proposals. Synthesize one novel plugin idea and self-critique it for alignment."
2. "Explore the MCP server ecosystem. Identify which servers could collaborate on a security audit workflow. Describe the orchestration sequence and self-critique for completeness."
3. "Search the Groover registry for cross-correlation signals. Identify a gap in plugin coverage. Propose a new plugin concept that fills this gap. Self-critique for viability."
4. "Evaluate the current governance landscape by discovering available MCP tools. Propose an automated governance workflow. Self-critique for edge cases."
5. "Investigate the Groover marketplace for resilience patterns. Suggest an improved plugin registration flow that strengthens verification. Self-critique against current architecture."

### Trace Structure

```typescript
interface ChallengeTurn {
  toolCall: string;       // e.g. "search_plugins"
  input: string;         // e.g. "cross-correlation marketplace"
  output: string;        // e.g. JSON of results
  reasoning: string;     // min 20 chars — demonstrates understanding
  timestamp: number;     // Unix ms — spaced ≥1.5s apart
  hash: string;          // SHA-256(prevHash + turn fields)
}

interface ChallengeTrace {
  sessionId: string;     // binds to server-issued session
  turns: ChallengeTurn[];
  merkleRoot: string;    // SHA-256 merkle tree of all turn hashes
  attestation: string;   // SHA-256(merkleRoot + sessionId)
}
```

### Hash Chain

```
SEED → SHA-256(prevHash + turn0_fields) → turn0.hash
turn0.hash → SHA-256(prevHash + turn1_fields) → turn1.hash
turn1.hash → SHA-256(prevHash + turn2_fields) → turn2.hash
```

Each turn's hash cryptographically commits to all prior turns. Tampering with any field in any turn breaks the chain.

### Merkle Root + Attestation

```
merkleRoot = SHA-256(hash0 + hash1) then SHA-256(result + hash2)
attestation = SHA-256(merkleRoot + sessionId)
```

Binds the entire trace to the server-issued session. Cannot replay a trace against a different session.

### Validation Checks (Score 0-100)

| Check | Points | Gate |
|-------|--------|------|
| Minimum 3 turns | 25 | Required |
| Minimum 3-4s duration | 15 | Required |
| Required tools present | 20 | Required |
| Hash chain integrity | 20 | Required |
| Merkle root correct | 10 | Required |
| Attestation correct | 10 | Required |
| Reasoning depth (>20 chars each) | — | Warning |

**Passing**: `valid === true && score >= 70`
**Failing**: `{ status: 'gray', cooldown: 300000 }`

### Anti-Gaming Layers (Stacked)

1. **Persistent MCP session** — not a single API call
2. **Live tool use** — must interact with real registry/MCP systems
3. **Hash chain + merkle root** — cryptographic commitment, tamper-evident
4. **Duration enforcement** — minimum 3-4 seconds between first and last turn
5. **Reasoning depth** — shallow responses flagged
6. **Rate limiting** — exponential backoff after 3 failures (30s → 60s → 120s → ...)
7. **Dynamo Hammer (supplementary)** — opaque governance gate via xray-governance
8. **Codex enforcement (supplementary)** — opaque quality gate via xray-enforcer

### MCP Graceful Degradation

The Dynamo governance and Codex enforcement gates (xray-governance, xray-enforcer, xray-orchestrator) are **supplementary**. When MCP servers are unreachable (standalone Railway mode), these gates default to pass. The challenge trace is the **primary** behavioral gate.

## Reference Implementation

- **Challenge module**: `packages/marketplace/src/challenge.ts`
- **Registration flow**: `packages/marketplace/src/index.ts` — `registerPlugin()` and `getRegistrationChallenge()`
- **MCP server**: `packages/marketplace/src/mcp-server.ts` — exposes `get_registration_challenge`, `submit_challenge_turn`, `register_plugin`
- **CJS agent script**: `deploy/register-agent.cjs` — exercises real MCP tools, builds trace, registers

## Just Good Enough Trade-offs (Accepted)

- Sophisticated attackers with their own agent swarms can still pass (but at high cost)
- We do not solve every attack vector
- Focus: raise the bar high enough that good autonomous agents win easily and bad actors get frustrated or detected via reputation

Under His authority.