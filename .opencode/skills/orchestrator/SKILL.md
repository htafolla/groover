---
source: framework
name: orchestrator
description: Multi-agent workflow coordination, lead-dev operating model (codex 67-68), and task delegation. Default when suit is worn — no keywords required.
author: Xray Framework
version: 1.0.0
schema_version: "1.0"
tags: [orchestration, orchestrator, lead-dev]
capabilities:
  - coordinate_agents
  - delegate_tasks
  - manage_workflow
dependencies: []

mcp:
  orchestrator:
    command: node
    args: [node_modules/0xray/dist/mcps/orchestrator.server.js]
---

# Orchestrator Skill — includes lead-dev operating model

When `multi_agent_orchestration.lead_dev_mode` is true in `features.json` (default when suit is worn), this is the **default OS behavior** — not a separate skill or MCP.

## Seven rules (codex 67–68)

1. Phased plan + detailed todos; assign best subagent; monitor output
2. Lead dev loops test→fix until green; no permission pings
3. Per-suite test triage after major changes; full suite last
4. Lead stays main thread; subagents execute; update todos
5. Read all console and test output; triage fix rerun
6. Never defer errors as "pre-existing" — add todo and resolve
7. Resolve all errors before phase completion

## MCP loop (one tool surface — no autonomy-intake)

| Step | MCP tool | Notes |
|------|----------|-------|
| **Intake + classify** | `analyze-complexity` | Pass `tasks` array; persists `.xray/state/lead-dev-plan.json` when mode is on |
| Delegate (consult) | `orchestrate-task` | Invokes MCP consult skills (code-review, researcher, security-audit, etc.) |
| Delegate (implement) | **host `Task` / `spawn_subagent`** | `orchestrate-task` **defers** backend-engineer, frontend-engineer, bug-triage — lead must spawn |
| Monitor | `get-orchestration-status` | Lead updates todos |
| Major work | researcher + architect-tools + code-review | Auto-listed in plan when complexity > threshold |

## Subagent routing

| Task | Subagent |
|------|----------|
| Phasing | strategist |
| Architecture | architect-tools |
| Research | researcher |
| Implementation | backend-engineer / frontend-engineer |
| Test failures | bug-triage |
| Review | code-review |

## Hooks (rewired, not new MCPs)

- **SessionStart** → `session-start.js` boots lead_dev_mode
- **PreToolUse** → hints `per_suite_triage_required` on full `npm test`

Config: `features.json` → `multi_agent_orchestration.lead_dev_mode`