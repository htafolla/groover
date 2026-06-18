# 0xRay AI Agents — Groover

Quick reference for the 0xRay AI orchestration framework (v16 MCPs-centric three-subsystem).

## Groover cable split (registry ≠ field)

| Cable | Path | Role |
|-------|------|------|
| **Identity / registry** | `packages/marketplace/` | DID + PoA MCP server (`npm start` / Railway) |
| **Field shadow** | `deploy/` | Moltbook workers — consult → govern → act → Repertoire feedback |
| **Cron manifest** | `deploy/hermes-cron.manifest.json` | 30m engage / 1h other / 4h post |

Registry PRs and deploy PRs are separate concerns. Field scripts use `engage-core.ts` (`runEngagePipeline`, `runPostPipeline`).

## Available MCP Servers

| Server | Role |
|--------|------|
| `xray-governance` | Proposal governance, codex snapshot, quality gates |
| `xray-skills` | Skill invocation, agent-specific knowledge servers |
| `xray-enforcer` | Codex compliance enforcement, rule validation |
| `xray-orchestrator` | Multi-agent workflow coordination, task delegation |

## CLI Commands

| Command | Description |
|---------|-------------|
| `xray setup` | Full framework setup (hooks, Hermes, symlinks) |
| `xray validate` | Validate codex compliance |
| `xray codex check` | Check codex rules |
| `xray health` | Framework health check |
| `xray hooks` | Manage lifecycle hooks |

## Governance

xray operates under the three-subsystem model: Inference + External Governance (Dynamo Solar SSOT) + Autonomous Engine (thinDispatch 7-flow in MCP orchestrator). All actions are validated against the Universal Development Codex before execution.

**Codex**: The codex lives in `.xray/codex.json` and enforces 60 terms across all agent interactions.

## thinDispatch Routing

- Simple (≤15): Single agent
- Moderate (≤25): Single agent with tools
- Complex (≤50): Multi-agent coordination
- Enterprise (>50): Orchestrator-led team

## File Organization

| File Type | Save To |
|-----------|---------|
| Reflections | `docs/reflections/` |
| Logs | `logs/` |
| Scripts | `scripts/` or `scripts/bash/` |
| Test Files | `src/__tests__/` |
| Source Code | `src/` |
| Config | `config/` or `.xray/` |
