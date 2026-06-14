# Groover MCP Servers Index

**Generated during MVP build (2026-06-13)**  
**Updated**: 2026-06-14 (MCP compliance: source field, proposals array, JSON-RPC error codes, configurable paths, HMAC identity fix, input schemas)
**Purpose**: Index of all discovered MCP servers and their tools for Groover's marketplace, registration flow, cross-correlation, and agent capabilities. 
**Method**: `search_tool` queries (broad + targeted). 10 servers, 100+ tools.
**Integration**: `packages/xray` bridge `listMcpServers()` + `getMcpToolSchema`. Marketplace augments signals with MCPs for correlation. Plugins declare in uiManifest. Use via orchestrator/Dynamo call_connected_tool. 
**Integration**: `packages/xray` bridge `listMcpServers()` (now returns 10) + `getMcpToolSchema`. Marketplace augments signals with MCPs for correlation. Plugins declare in uiManifest. Use via orchestrator/Dynamo call_connected_tool.

MCP servers appear in **xray-** (0xRay, primary) and **strray-** (parallel) + core externals (Dynamo, grok_com_github). Full 10 in listMcpServers().

### 1. Dynamo (Core Governance, Signals, Physics/Math)
- **Role in Groover**: External SSOT governance (Dynamo Hammer), signal triangulation for cross-correlation (semantic + temporal + governance + X/web), isotopic calculations, proxy for other tools. Exercised in gov-021 (solar 81% PASS), harmonic, triangulate during continue.
- **Key Tools** (20 total; use `Dynamo__get_docs` or `Dynamo__call_connected_tool` for full):
  - `Dynamo__govern_with_solar`: Enhanced governance with solar context (NOAA GOES). Used for proposals. (gov-021: PASS 81%).
  - `Dynamo__evaluate_governance`: Full pipeline (emit -> cross-correlate -> triangulate -> fuse -> decide).
  - `Dynamo__triangulate_signals`: Multi-signal analysis, isotopic fingerprints, correlation matrix. (Exercised 2026-06-13).
  - `Dynamo__call_connected_tool`: Universal proxy to any other Dynamo tool (e.g., `compute_tdf`, `govern_with_solar`).
  - `Dynamo__list_isotopes`, `Dynamo__get_docs`, `Dynamo__explain_term`, `Dynamo__explain_governance_output`.
  - `Dynamo__harmonic_oscillator`: P_o = sin(2pi * 528 * t + pi / PHI). (Exercised t=0.13 -> P_o~-0.367; prior ~0.95).
  - `Dynamo__black_hole_sequence`, `Dynamo__validate_tlm`, `Dynamo__compute_tptt`, `Dynamo__optimize_cascade`, `Dynamo__wave_function`, `Dynamo__cross_correlate`, `Dynamo__emit_isotopic_signal`, `Dynamo__compute_tdf`, `Dynamo__kuramoto_sync`, `Dynamo__fuse_symbiotic`, `Dynamo__get_phase_coherence`, etc.
- **Usage in Groover**: Registration flow (Dynamo signal submission + Hammer), core ranking (Dynamo-weighted), temporal resonance (harmonic). Schemas fetched and used in build.
- **Schema Note**: Many have simple params (numbers, objects); `call_connected_tool` takes `tool_name` + `params`.

### 2. grok_com_github (GitHub Integration)
- **Role in Groover**: External signals (repo data for correlation), repo ops for marketplace (fork, create branch, releases for versioning), user context. 44 tools.
- **Key Tools** (44 total):
  - `grok_com_github__get_me`, `grok_com_github__search_code` (exercised post-021, 0 hits on narrow query due to limits), `grok_com_github__get_file_contents`.
  - `grok_com_github__list_pull_requests`, `grok_com_github__list_branches`, `grok_com_github__list_releases`, `grok_com_github__list_issue_types`, `grok_com_github__get_latest_release`.
  - `grok_com_github__fork_repository`, `grok_com_github__create_branch`, `grok_com_github__create_repository`, `grok_com_github__create_or_update_file`, `grok_com_github__delete_file`.
  - `grok_com_github__search_issues`, `grok_com_github__search_pull_requests`, `grok_com_github__search_repositories`, `grok_com_github__search_commits`, `grok_com_github__search_users`.
  - `grok_com_github__pull_request_review_write`, `grok_com_github__add_comment_to_pending_review`, `grok_com_github__merge_pull_request`, `grok_com_github__add_reply_to_pull_request_comment`.
  - `grok_com_github__run_secret_scanning`, `grok_com_github__get_commit`, `grok_com_github__list_commits`, `grok_com_github__list_tags`, `grok_com_github__get_tag`, `grok_com_github__get_release_by_tag`, `grok_com_github__list_repository_collaborators`, `grok_com_github__list_teams`, `grok_com_github__get_team_members`, `grok_com_github__issue_read`, `grok_com_github__issue_write`, `grok_com_github__sub_issue_write`, `grok_com_github__update_pull_request`, `grok_com_github__update_pull_request_branch`, `grok_com_github__request_copilot_review`, `grok_com_github__push_files`, etc.
- **Usage in Groover**: Signal ingestion for cross-correlation, GitHub MCP for agent marketplace ops. Fetched AgentUIManifest ref via this.
- **Schema Note**: Most require `owner` + `repo`; pagination via `page`/`perPage`. Query supports qualifiers.

### 3. xray-enforcer (primary) / strray-enforcer (parallel)
- **Role in Groover**: Enforce AGENTS.md/codex (68 terms, zero-tolerance on stubs/errors/loops/type-safety), quality gates before integration. Used on every file write + post-edit (gov-021, mcp-10 expansion, console purge). Pre-commit 85 ALLOWED (pre-existing AGENTS warnings non-blocking).
- **Key Tools** (7 each):
  - `xray-enforcer__codex-enforcement` / `strray-enforcer__codex-enforcement`: Validate (operation, files, newCode, focusAreas).
  - `xray-enforcer__quality-gate-check` / `strray-enforcer__quality-gate-check`: Pre-commit (context, strictMode).
  - `xray-enforcer__get-enforcement-status` / `strray-enforcer__get-enforcement-status`.
  - `xray-enforcer__run-pre-commit-validation` / `strray-enforcer__run-pre-commit-validation`: autoFix, strictBlocking. (Exercised on 6 files post-021: passed true, blocked false, score 85, ALLOWED).
  - Others: rule-validation, context-analysis-validation, security-scan.
- **Usage in Groover**: Every change passed. Post 10-server update: re-enforce planned.
- **Schema Note**: `context` object for rich validation.

### 4. xray-governance (primary) / strray-governance (parallel)
- **Role in Groover**: Run proposals through 0xRay system (internal skills + Dynamo Solar SSOT). "Governance precedes action" (AGENTS.md). 021 approved here (xray-gov: approve 0.89 avg, external-dynamo 100%).
- **Key Tools** (3 each):
  - `xray-governance__govern_proposals` / `strray-governance__govern_proposals`: proposals[] (id, type enum fix/refactor/guard/automate/codify/strategic/compliance, title, description, evidence[], source, confidence). options {require_external:true}.
  - `xray-governance__govern_reflection` / `strray-governance__govern_reflection`.
  - `xray-governance__get_active_codex` / `strray-governance__get_active_codex`.
- **Usage in Groover**: All phases + 021 for continue + MCP 10. ID enforced.
- **Schema Note**: Returns decisions + votes + external-dynamo.

### 5. xray-orchestrator (primary) / strray-orchestrator (parallel)
- **Role in Groover**: thinDispatch 7-flow orchestration, complexity, delegation. Used for subagent + continuation (orchestrate-task post-021: SUCCESS all 7 cont tasks via code-reviewer delegation, session_1781391469226).
- **Key Tools** (6 each):
  - `xray-orchestrator__orchestrate-task` / `strray-orchestrator__orchestrate-task` (exercised).
  - analyze-complexity, govern-and-apply, optimize, cancel, get-orchestration-status.
- **Usage in Groover**: Plan execution, subagent (019ec335-... reviewer/MCP runner spawned), validation.
- **Schema Note**: sessionId tracking, optimized mode.

### 6. xray-skills (primary) / strray-skills (parallel)
- **Role in Groover**: Specialized skills for design, analysis, review, generation. Routed via list-skills + invoke-skill. Aligns with opencode agents. Exercised post-021: list-skills (33 returned: api-design, code-reviewer x2, project-analysis, testing-strategy, ui-ux-design, researcher, security-audit, ...), skill-code-review (97/100 on listMcpServers expansion snippet, 2 issues/3 recs).
- **Key Tools** (13 each):
  - `xray-skills__list-skills` / `strray-skills__list-skills`: category all/core/registry/knowledge -> 33 skills.
  - `xray-skills__invoke-skill` / `strray-skills__invoke-skill`.
  - Specific: skill-code-review, skill-project-analysis, skill-testing-strategy, skill-ui-ux-design, skill-api-design, skill-documentation-generation, skill-security-audit, skill-performance-optimization, architect, researcher, testing-lead, etc.
- **Usage in Groover**: Reviews, analysis, docs, UI during build + continue.
- **Schema Note**: Generic invoke.

## Additional Notes
- **xray-* vs strray-**: xray primary (AGENTS.md); strray parallel for resilience. Both fully indexed/usable.
- **Discovery in Groover**: 
  - `Dynamo__call_connected_tool` universal.
  - `xray-skills__list-skills` + invoke-skill.
  - xray-orchestrator / strray-orchestrator for routing + thinDispatch.
- **Integration Points**:
  - `@groover/xray` bridge: `listMcpServers()` (10 entries) / getMcpToolSchema. Updated in gov-021.
  - Marketplace: search/register augment with MCP names from list (for capability correlation); register uses xrayBridge.govern with exact ID.
  - Core: rankWithDynamo + chrono temporal use MCP signals (harmonic/triangulate).
  - Example/CLI: --mcps, mcp-aware demo, full registration flow.
- **Governance Identification**: All xrayBridge.govern() proposals include `source: 'system'` per 0xRay GovernanceProposal schema requirement. Submitter: `groover-marketplace`.
- **Governance/Codex**: All tool use + edits enforced. frameworkLogger only (no console.* in source). Governance proposals sent as `{ proposals: [proposal] }` with `source: 'system'` per 0xRay protocol.
- **Sources**: Connected MCP announcement (10), search_tool batches, governed proposals, npx runs, subagent.


**Total Indexed**: 10 servers, 100+ tools. listMcpServers() runtime truth.

## Railway MCP Registry

**Live URL**: https://registry-production-e2c4.up.railway.app
**Endpoints (6 tools)**:
- POST /mcp JSON-RPC: initialize, tools/list, tools/call (register_plugin, get_registration_challenge, submit_challenge_turn, search_plugins, get_plugin_ui_manifest, list_mcp_servers)
- JSON-RPC 2.0 error codes: -32700 (parse), -32601 (method not found), -32602 (invalid params), -32603 (internal)
- Error messages sanitized via SAFE_ERROR_TOKENS whitelist
- SIGTERM/SIGINT graceful shutdown
- Health check: GET /health

See also: .xray/ (codex/routing), AGENTS.md, IMPLEMENTATION-PLAN.md, packages/xray/src/index.ts (listMcpServers), packages/marketplace/src/mcp-server.ts (HTTP MCP server).

*Built under authority. All actions governed.*
