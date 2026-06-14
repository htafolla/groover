---
name: hermes-agent
description: Manage 0xRay framework from Hermes Agent via the native strray-hermes plugin. Covers the 4 plugin tools (validate, codex_check, health, hooks), lifecycle hooks, slash commands, bridge architecture, and CLI fallback.
version: 2.1.0
author: 0xRay AI
metadata:
  hermes:
    tags: [0xRay, Plugin, Validation, Codex, GitHooks, Bridge]
    related_skills: []
---

# 0xRay Hermes Plugin (strray-hermes)

Native Hermes plugin providing 0xRay framework integration — quality gates, codex enforcement, git hooks, and full pre/post processing pipeline. Runs via a Node.js bridge to compiled framework components.

## When to Use

- User asks about 0xRay health, validation, or codex checks
- User wants to install/manage git hooks for automated enforcement
- User asks about the plugin's tools, hooks, or slash commands
- User asks about bridge errors or framework not loading
- User wants to validate files before committing or pushing

## Plugin Architecture

```
~/.hermes/plugins/strray-hermes/
├── __init__.py         # Plugin registration, hooks, slash commands
├── tools.py            # 4 tool handlers (validate, codex_check, health, hooks)
├── schemas.py          # JSON schemas the LLM sees
├── bridge.mjs          # Node.js bridge to compiled 0xRay framework
├── plugin.yaml         # Plugin metadata (name, version, tools, hooks)
├── types.py            # TypeScript-equivalent type definitions
├── after-install.md    # Post-install instructions
└── test_plugin.py      # Tests
```

**Bridge protocol:** JSON over stdin/stdout to `bridge.mjs` (Node.js). The bridge lazy-loads compiled framework modules from `dist/`:
- `dist/plugin/quality-gate.js` — codex violation detection
- `dist/processors/processor-manager.js` — pre/post processor pipeline
- `dist/state/state-manager.js` — persistent state
- `dist/core/features-config.js` — feature flags

**Fallback:** When bridge is unavailable, tools fall back to `npx 0xray` CLI commands.

**Config path resolution:** `STRRAY_CONFIG_DIR/` > `.xray/` > `.opencode/xray/` > built-in defaults.

## 4 Tools

### strray_validate

Run pre-commit validation on files. Uses bridge quality gate + processor pipeline, falls back to CLI.

```
strray_validate(files=["src/my-module.ts"], operation="commit")
strray_validate(files=["src/auth.ts", "src/auth.test.ts"], operation="modify")
```

Parameters:
- `files` (required, array of strings) — file paths to validate
- `operation` (string) — commit, create, modify, refactor (default: commit)

Returns: pass/fail with per-file results and violations.

### strray_codex_check

Validate code against the 60-term Universal Development Codex. Checks error-handling, type-safety, performance, security, architecture.

```
strray_codex_check(code="const x: any = foo()", operation="create")
strray_codex_check(code=snippet, operation="modify", focus_areas=["security", "error-handling"])
```

Parameters:
- `code` (string) — code snippet to check. If omitted, returns framework health instead.
- `operation` (required, string) — create, modify, refactor
- `focus_areas` (array) — error-handling, type-safety, performance, security, architecture

Returns: violations list with actionable remediation.

### strray_health

Framework health check. Returns version, loaded components, project root.

```
strray_health()
```

Returns: framework status, version, component availability, node version.

### strray_hooks

Manage 0xRay git hooks (install, uninstall, list, status).

```
strray_hooks(action="install")
strray_hooks(action="status")
strray_hooks(action="list")
strray_hooks(action="uninstall", hooks=["pre-commit"])
```

Parameters:
- `action` (required, string) — install, uninstall, list, status
- `hooks` (array) — which hooks to manage (default: all four)

Hooks available: pre-commit, post-commit, pre-push, post-push.

| Hook | Type | What it does |
|------|------|-------------|
| `pre-commit` | Blocking | TypeScript check + Codex validation before commit |
| `post-commit` | Non-blocking | Log archival + cleanup after commit |
| `pre-push` | Blocking | Full validation suite before push |
| `post-push` | Non-blocking | Comprehensive monitoring after push |

## 2 Lifecycle Hooks

These fire automatically — no action needed from the user or agent.

### pre_tool_call

Fires before ANY tool executes:
1. Tracks session stats
2. Logs tool-start event to `logs/framework/plugin-tool-events.log`
3. For code-producing tools (write_file, patch, execute_code, write, edit): runs quality gate + pre-processors via bridge
4. For other tools: nudges when a 0xRay MCP alternative exists (e.g., grep → search_codebase, eslint → strray_lint)

### post_tool_call

Fires after ANY tool returns:
1. Logs tool-complete event
2. For code-producing tools: runs post-processors via bridge

### on_session_start (graceful fallback)

Fires when a new session starts. Resets stats and logs to disk. Registration is wrapped in try/except for hosts that don't support it yet.

## Slash Command

```
/strray status    — Plugin and framework health (calls bridge)
/strray stats     — Session pipeline statistics
/strray help      — Show available commands
/sr status        — Alias
```

## Session Stats (tracked automatically)

The plugin tracks per-session counters visible via `/strray stats`:
- total_tool_calls, code_operations, strray_mcp_calls, native_tool_calls
- quality_gate_runs, quality_gate_blocks
- pre_processor_runs, post_processor_runs
- bridge_calls, bridge_errors

## Logging

All logs go to `logs/framework/` in the project root:

| File | Content |
|------|---------|
| `activity.log` | All pipeline events (quality gates, processors, nudges, errors) |
| `plugin-tool-events.log` | Tool start/complete events with durations |

## Quick Decision Guide

| User Says | Tool / Command |
|----------|---------------|
| "Is 0xRay working?" | `strray_health()` or `/strray status` |
| "Check these files before I commit" | `strray_validate(files=[...], operation="commit")` |
| "Is this code codex compliant?" | `strray_codex_check(code=..., operation="create")` |
| "Set up git hooks" | `strray_hooks(action="install")` |
| "What hooks are installed?" | `strray_hooks(action="status")` |
| "Show session stats" | `/strray stats` |
| "Why is the bridge failing?" | Check `strray_health()` → if `framework: "not_loaded"`, verify `dist/` symlink |

## Bridge Commands (internal)

These are called by the Python tools via `bridge.mjs`, not directly by the LLM:

| Command | What it does |
|---------|-------------|
| `health` | Framework health check |
| `validate` | Run quality gate on files |
| `codex-check` | Check code against codex rules |
| `pre-process` | Quality gate + pre-processors before tool |
| `post-process` | Post-processors after tool |
| `hooks` | Git hook management |
| `stats` | Bridge/framework statistics |

Bridge can be invoked directly for debugging:
```bash
echo '{"command":"health"}' | node ~/.hermes/plugins/strray-hermes/bridge.mjs
node ~/.hermes/plugins/strray-hermes/bridge.mjs health --cwd /path/to/project
```

## Relationship to MCP Servers

The plugin and MCP servers are complementary:
- **Plugin tools** = offline-first, always available, lightweight (validate, codex check, health, hooks)
- **MCP servers** = deeper analysis requiring running Node.js (lint, security scan, architecture assessment, orchestration, codebase search)

The plugin's pre_tool_call hook nudges when an MCP alternative exists (e.g., "use mcp_strray_lint_lint instead of raw eslint"). This is advisory, not blocking.

## Pitfalls

- Plugin requires restart after install/edit: Hermes loads plugins once at session start.
- Bridge needs `dist/` symlink: The bridge loads compiled `.js` from `dist/` → `node_modules/0xray/dist/`. If the symlink breaks, bridge returns `framework: "not_loaded"`.
- `strray_codex_check` without `code` param returns health, not a codex check. Pass `code` for actual validation.
- CLI fallback requires `npx 0xray` in PATH. If bridge fails and CLI isn't available, tools return errors.
- Quality gate blocks are logged but NOT enforced (advisory). The tool returns violations; the agent decides what to do.
- Git hooks use symlinks from `.git/hooks/` → `hooks/`. If the `hooks/` directory doesn't exist in the project, `strray_hooks(action="install")` skips those hooks.
- Project root detection walks up from CWD looking for `node_modules/0xray`, `.opencode/xray/features.json`, or `package.json`. Override with `STRRAY_PROJECT_ROOT` env var.
- `logs/framework/` is created automatically. Never breaks the agent if permissions fail.
