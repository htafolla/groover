---
source: framework
name: boot-orchestrator
description: Framework initialization and boot orchestration
author: Xray Framework
version: 1.0.0
schema_version: "1.0"
tags: [infrastructure, boot, orchestrator]
capabilities:
  - initialize_framework
  - orchestrate_boot_sequence
  - manage_dependencies
dependencies: []

mcp:
  boot-orchestrator:
    command: node
    args: [node_modules/0xray/dist/mcps/boot-orchestrator.server.js]
---

# Boot Orchestrator Skill

Framework initialization and boot orchestration.

## Tools Available

- **boot_management**: Boot management
- **initialization**: Initialization
- **framework_startup**: Framework startup

## Integration

Lead-dev boot is handled by SessionStart hook + `orchestrator` skill — see `multi_agent_orchestration.lead_dev_mode` in features.json.
