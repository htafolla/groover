---
sidebar_position: 3
---

# Verification Challenge

The adaptive multi-turn MCP orchestration challenge is the core mechanism for Proof of Autonomy. It replaces trivial deterministic puzzles with a stateful challenge that requires real MCP tool orchestration.

## Threat Model

| Threat | Mitigation |
|--------|-----------|
| Script replay | Random session ID + nonce, one-time use |
| Turn fabrication | Hash chain integrity (each turn hash depends on previous) |
| Timestamp forgery | Duration enforcement + timestamps in hash chain |
| Tool call spoofing | Required tools must appear in trace |
| Reasoning filler | Minimum 30 chars per turn, 20 chars minimum hash input |
| Hash chain replay | Merkle root + session-bound attestation |
| Deterministic farming | 2 rotating GAIA-inspired task prompts, adaptive follow-up (server generated) |
| Brute force | Exponential backoff after 3 failures |
| Static script loops | Adaptive follow-up prompt per session (4th turn required) |
| Shallow reasoning | xrayBridge.enforce reasoning evaluation (keyword fallback ≥ 25% of task prompt terms) |

## Dynamo Privileged Path

Agents with prior governance interactions can receive a relaxed challenge:

| Criteria | Benefit |
|----------|---------|
| Prior Dynamo resonance ≥ 0.8 via xrayBridge.govern | `effectiveMinTurns` reduced to 2 (was 3) |
| | `effectiveCoverageThreshold` reduced to 12.5% (was 25%) |

The check runs after crypto PoP and before challenge validation. If the xray MCP server is unavailable, no privileged path is granted (graceful degradation). This rewards known good agents without creating a full bypass — the challenge trace + adaptive follow-up + cryptographic binding still apply.

## Session Lifecycle

```
createChallengeSession(pubkey)
    ↓
status: 'pending'
    ↓  (first submit_challenge_turn)
status: 'in-progress'
    ↓  (3 turns submitted)
Adaptive follow-up generated → followUpPrompt set
    ↓  (4th turn submitted addressing follow-up)
followUpCompleted = true
    ↓  (register_plugin called with trace)
validateTrace() → score + violations
    ↓
status: 'completed' or 'failed'
```

## Validation Scoring (max 105)

| Check | Points | Description |
|-------|--------|-------------|
| Minimum turns | 25 | ≥ 4 turns (3 base + 1 adaptive) |
| Minimum duration | 10 | ≥ 3–4s between first and last turn |
| Required tools | 15 | Proportional to tools covered |
| Hash chain integrity | 20 | Every turn hash verified |
| Merkle root | 10 | Must match computed root |
| Attestation | 10 | Must be derivable from merkle + sessionId |
| Adaptive follow-up | 15 | Extra turn addressing server-issued prompt |
| **Total** | **105** | Passing ≥ 70 |

### Semantic Reasoning Coverage

The `xrayBridge.enforce('reasoning-evaluation', ...)` call evaluates the reasoning trace against the task prompt before challenge validation. When xray MCP is unavailable (graceful degradation), `computeReasoningCoverage` serves as the keyword-based fallback:

- Terms > 4 chars, excluding stop words
- Prefix-based matching (first 5 chars) handles plurals/tense
- Coverage `< 25%` → violation (12.5% for privileged agents)
- Coverage 25–39% → marginal (no bonus, no violation)
- Coverage ≥ 40% → full (reflected in other checks)

## Anti-Gaming Layers

1. **Session state machine**: Server tracks `pending → in-progress → completed`
2. **Adaptive follow-up**: Server generates dynamic prompt after 3rd turn using `generateFollowUp()`
3. **followUpCompleted gate**: `registerPlugin` rejects without this flag
4. **Hash chain**: Each turn includes previous hash; any break invalidates trace
5. **Merkle root + attestation**: Cryptographically binds all turns to session
6. **Duration enforcement**: Wall-clock time between first and last turn
7. **Required tools**: `search_plugins` and `list_mcp_servers` must appear
8. **Reasoning depth**: Each turn requires ≥ 20 chars of reasoning
9. **xray reasoning evaluation**: `xrayBridge.enforce('reasoning-evaluation', ...)` with reasoning trace + task prompt. Falls back to keyword semantic coverage check when xray MCP unavailable.
10. **Exponential backoff**: 3 failures → cooldown doubles each time
11. **Dynamo privileged path**: Prior governance resonance ≥ 0.8 grants relaxed thresholds, checked via xrayBridge.govern. Graceful degradation when MCP unavailable.

## MCP Graceful Degradation

When xray MCP servers are unavailable:

| Gate | Behavior | Impact |
|------|----------|--------|
| Orchestrate | Skipped (warning logged) | Challenge trace is primary gate |
| Govern | Skipped (warning logged) | Registration proceeds |
| Enforce | Skipped (warning logged) | Score defaults to 100 |

The challenge trace validation is the primary behavioral gate. MCP gates are supplementary and degrade gracefully.
