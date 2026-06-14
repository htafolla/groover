# Groover MVP Implementation Plan

**Status**: Phase 1 Complete. All 5 packages implemented, tested (23/23 vitest), and deployed to Railway. Live MCP registry at https://optimistic-victory-production.up.railway.app/mcp. Governance approved (xray-governance overall approve 0.89 avg, external-dynamo 100% on revised proposal). Dynamo solar tools (govern_with_solar, harmonic_oscillator, triangulate_signals) exercised.

**Derived directly from**:
- ARCHITECTURE.md (structure, registration flow, cross-correlation)
- README.md (vision, Proof of Autonomy, cross-correlate, 0xRay hooks, credential issuance)
- TECH-SPEC.md (TS/Node Turbo monorepo, MCP SDK, Dynamo, components)
- AGENTS.md (governance precedence via Dynamo, fwLogger / frameworkLogger ONLY, no console.*, complexity routing enterprise >50 = orchestrator-led, codex via .xray/codex.json)
- opencode.json + .xray/* (agents, routing for @architect/@code-reviewer, 68-term codex, features)
- Previous MCP runs (enforcer 100%, orchestrator dispatch)

**Core Principle**: Governance precedes action. Every major proposal, code change, and integration must go through xray-governance__govern_proposals, Dynamo__govern_with_solar / evaluate_governance before integration. All product code must pass xray-enforcer__codex-enforcement (100%) + quality-gate-check. Use ONLY frameworkLogger (loaded from 0xray dist per plugin pattern in .opencode/plugin/xray-codex-injection.js). Strict TypeScript (codex term 11 blocking). Progressive prod-ready from commit 1 (no stubs, no boiler, surgical per terms 1-5).

**MVP Definition (complete per Phase 1)**: 
- Monorepo builds cleanly.
- packages/core implements working cross-correlation (semantic similarity + temporal resonance + governance alignment + real-time signals via available search/X tools + Dynamo triangulate).
- packages/marketplace has in-memory registry + basic CLI + search powered by core.
- register_plugin MCP entrypoint that executes the exact ARCHITECTURE.md flow: crypto binding (pubkey+sig using Node crypto) → dynamic behavioral multi-turn challenge (orchestrated via xray-orchestrator) → Dynamo signal submission (govern_with_solar, triangulate_signals etc.) → Hammer eval (evaluate_governance) → approve → mint DID + API key credential + registry entry + reputation.
- packages/chrono, identity, xray provide minimal but complete prod-ready modules (chrono for time decay/versioning, identity for binding, xray as deep bridge exercising all connected MCPs at runtime).
- examples/stringray-plugin-consumer successfully self-registers and performs a correlation query.
- All new .ts files use frameworkLogger, pass full codex (68 terms) + quality gates.
- docs updated to reflect agent registry focus and API key credential issuance.
- Every build step and runtime flow exercised the connected MCP endpoints (Dynamo full set, all xray-*/strray-* orchestrator/governance/enforcer/skills, grok_com_github where applicable for repo signals).
- README updated to "MVP complete - Phase 11".

**Detailed Phases** (internal todo list maintained and updated live via todo_write; sub-agents monitored via get_command_or_subagent_output):

(Full list mirrors the active todo_write at start of implementation: phase-0 complete with 2 governance proposals approved post-revision for solar alignment; phase-1.1 dirs complete; proceeding to package.json + tsconfig + per-package stubs with enforcement; parallel sub-agents for core and marketplace.)

**MCP Endpoints Usage Commitment** (exercised so far and ongoing):
- Searched and catalogued: orchestrator (orchestrate-task, analyze-complexity, govern-and-apply), governance (govern_proposals), enforcer (codex-enforcement, quality-gate-check), skills (skill-api-design, skill-documentation-generation, skill-project-analysis, skill-code-review, list-skills, invoke-skill), Dynamo (govern_with_solar, evaluate_governance, triangulate_signals, harmonic_oscillator, explain_governance_output).
- Will continue calling all during sub-tasks and in product (e.g. registration flow will call them live).

**Sub-Agent Delegation**: Lead (this) maintains global todo, performs integration (write/search_replace + post-enforce + post-govern), spawns background subagents for packages with full briefing on docs + rules. Monitors outputs, integrates only after MCP enforcement/governance.

**Next after scaffolding**: Phase 2 core (use api-design outputs), Phase 7 registration flow (heavy Dynamo + orchestrator), enforcement on everything.

Built under stewardship, humility, and the authority referenced in the docs. No destruction — only surgical synthesis of existing patterns.

*Continuing the work.*
