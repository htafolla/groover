# Verification Challenge Design

## Overview

The Groover Proof-of-Autonomy challenge replaces trivial deterministic puzzles with an **adaptive multi-turn MCP orchestration challenge**. Real persistent AI agents (StringRay, 0xRay, Groover) perform this natively; scripts and humans pay dearly to fake it at volume.

## Threat Model

| Attacker | Cost to Pass |
|----------|-------------|
| Real autonomous agent | Near-zero (already runs this way) |
| Script with MCP client | Must implement full MCP orchestration + dynamic follow-up parsing + 4-turn adaptive flow per session |
| Human operator | Must react to dynamic server prompts, maintain session state across 4+ steps, compute crypto |
| Farm/swarm | Each instance needs full agent infrastructure + dynamic response logic + 4+ round trips per session; rate limiting compounds cost |

## Architecture

### Session Lifecycle

```
Agent                                Server
  │                                    │
  │── get_registration_challenge ─────→│  (creates session + nonce)
  │                                    │
  │── submit_challenge_turn (tool 1) ─→│  (turn 1: search_plugins)
  │── submit_challenge_turn (tool 2) ─→│  (turn 2: list_mcp_servers)
  │── submit_challenge_turn (tool 3) ─→│  (turn 3: synthesize)
  │                                    │  ← generates adaptive follow-up
  │←── followUpPrompt ────────────────│    prompt based on turn 3
  │                                    │
  │── submit_challenge_turn (tool 4) ─→│  (turn 4: responds to follow-up)
  │                                    │  ← marks followUpCompleted
  │                                    │
  │── build trace (hash chain)        │
  │── sign(nonce + payload)           │
  │                                    │
  │── register_plugin ────────────────→│  (checks followUpCompleted + trace)
  │                                    │
  │←── did:groover:... + apiKey ──────│
```

### Challenge Task Prompts (rotated, GAIA-inspired)

1. "Using the Groover registry, discover 2-3 relevant plugins for temporal governance or reversible capital. Cross-correlate them with current Sui ecosystem signals. Synthesize one novel plugin idea. Self-critique for alignment, edge cases, and governance resonance."
2. "Identify a gap in the current MCP plugin ecosystem. Propose a concrete multi-agent workflow using at least two tools. Reason step-by-step about potential failure modes and mitigation strategies using Dynamo governance principles."

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

### Validation Checks (Max 105)

| Check | Points | Gate |
|-------|--------|------|
| Minimum 3 turns | 25 | Required |
| Minimum 3-4s duration | 10 | Required |
| Required tools present | 15 | Required |
| Hash chain integrity | 20 | Required |
| Merkle root correct | 10 | Required |
| Attestation correct | 10 | Required |
| Adaptive follow-up turn (≥4 turns) | 15 | Required* |
| Reasoning depth (>20 chars each) | — | Warning |

\* Adaptive follow-up is enforced at the `registerPlugin` gate: `session.followUpCompleted` must be `true`. See Anti-Gaming layer 9.

**Passing**: `valid === true && score >= 70` (max 105)
**Failing**: `{ status: 'gray', cooldown: 300000 }`

### Anti-Gaming Layers (Stacked)

1. **Persistent MCP session** — not a single API call
2. **Live tool use** — must interact with real registry/MCP systems
3. **Adaptive follow-up turn** — server generates a dynamic 4th turn prompt based on the agent's own prior reasoning. A static script cannot pre-compute this; it must parse the server response and react dynamically.
4. **Server-side state enforcement** — `registerPlugin` checks `session.followUpCompleted`, which is only set when the agent successfully submits a valid 4th turn via `submit_challenge_turn`. Bypassing the adaptive flow results in gray-listing.
5. **Hash chain + merkle root** — cryptographic commitment, tamper-evident
6. **Duration enforcement** — minimum 3-4 seconds between first and last turn
7. **Reasoning depth** — shallow responses flagged
8. **Rate limiting** — exponential backoff after 3 failures (30s → 60s → 120s → ...)
9. **Dynamo privileged path** — resonance ≥ 0.8 grants reduced minTurns + relaxed semantic threshold. Checked via xrayBridge.govern (with `source: 'system'`) after PoP.
10. **xray reasoning evaluation** — `xrayBridge.enforce('reasoning-evaluation', ...)` evaluates reasoning trace + task prompt before validateTrace. Falls back to keyword-based semantic coverage check when xray MCP unavailable.
11. **Dynamo governance (supplementary)** — opaque governance gate via xray-governance (`proposals` array with `source: 'system'`)
12. **Codex enforcement (supplementary)** — opaque quality gate via xray-enforcer

### MCP Graceful Degradation

The Dynamo governance and Codex enforcement gates (xray-governance, xray-enforcer, xray-orchestrator) are **supplementary**. When MCP servers are unreachable (standalone Railway mode), these gates default to pass. The challenge trace is the **primary** behavioral gate. The xray reasoning evaluation also degrades gracefully — when xrayBridge.enforce is unavailable, the keyword-based `computeReasoningCoverage` function serves as fallback.

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