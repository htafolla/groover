---
source: framework
name: researcher
description: Multi-repo analysis, documentation lookup, and implementation examples
author: Xray Framework
version: 1.0.0
schema_version: "1.0"
tags: [research, researcher]
capabilities:
  - search_repositories
  - find_implementations
  - analyze_documentation
dependencies: []

mcp:
  researcher:
    command: node
    args: [node_modules/0xray/dist/mcps/researcher.server.js]
---

# Researcher Skill

Multi-repo analysis, documentation lookup, and implementation examples.

## Tools Available

- **search_repositories**: Search repositories
- **find_implementations**: Find implementations
- **analyze_documentation**: Analyze documentation

## When to invoke (autonomy-command)

Lead dev dispatches researcher **before** major planning, refactors, or cross-repo work — not only when user says "research."

| Trigger | Action |
|---------|--------|
| Major refactor / new phase | `search_codebase`, `get_documentation`, `find_implementation` |
| Prior art / patterns | Search sibling repos (xray, groover, repertoire) |
| Proposal analysis | `analyze_proposal` via xray-researcher MCP |

## MCP tools (xray-researcher)

- `get_documentation` — module/class docs (`target` required)
- `search_codebase` — text search in workspace
- `find_implementation` — locate implementations
- `analyze_proposal` — governance-aware proposal review

## Return shape for lead

Summarize: findings (3–5 bullets), file paths, recommended next todos. Do not defer work back to lead without concrete patches or todos.
