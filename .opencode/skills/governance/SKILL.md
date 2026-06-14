---
source: framework
name: governance
description: Proposal governance, codex snapshot, and Dynamo solar governance integration
author: StrRay Framework
version: 1.0.0
schema_version: "1.0"
tags: [governance, codex, dynamo]
capabilities:
  - govern_proposals
  - evaluate_governance
  - codex_reflection
  - resonance_checks
dependencies:
  - xray-enforcer
  - dynamo

mcp:
  governance:
    command: node
    args: [node_modules/0xray/dist/mcps/xray-governance.server.js]
---

# Governance Skill

External Governance via Dynamo Solar SSOT (codex.json). Proposal lifecycle, resonance checks, and governance decisions that precede all actions per AGENTS.md.

## Tools Available

- **govern_proposals**: Full proposal lifecycle (create, evaluate, approve, reject, reflect)
- **evaluate_governance**: Governance alignment scoring against codex terms
- **get_active_codex**: Retrieve current codex snapshot with all 68 terms and enforcement levels
- **govern_reflection**: Resonance-based governance reflection cycle

## Integration

All governance actions must precede code changes (AGENTS.md Line 16: "Governance precedes action"). Connect via the xray-bridge (`XrayBridge.govern()` in `packages/xray/src/index.ts`).

Governance results are logged via `frameworkLogger` under the `xray` module with event `govern-proposal`.
