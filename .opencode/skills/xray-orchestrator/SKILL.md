---
name: xray-orchestrator
description: |
  Main orchestration skill for xray agents.
  Provides commands to coordinate agent work and invoke xray APIs
  through the local HTTP API server.
metadata:
  openclaw:
    primaryEnv: XRAY_API_KEY
    emoji: 🤖
  author: xray
  tags:
    - ai
    - orchestration
    - agent
user-invocable: true
---

# xray Orchestrator Commands

## /xray

Display xray status and available commands.

**Usage:** `/xray`

**Example:**
```
/xray
```

## /xray-status

Get detailed status of xray integration including connection status.

**Usage:** `/xray-status`

**Example:**
```
/xray-status
```

## /xray-analyze

Analyze code using xray code analysis capabilities.

**Usage:** `/xray-analyze <file-path>`

**Arguments:**
- `file-path`: Path to file to analyze (required)

**Example:**
```
/xray-analyze src/index.ts
```

## /xray-code

Perform code review on a file.

**Usage:** `/xray-code <file-path> [options]`

**Arguments:**
- `file-path`: Path to file to review (required)
- `--fix`: Attempt to fix issues automatically (optional)

**Example:**
```
/xray-code src/utils/helper.ts
/xray-code src/utils/helper.ts --fix
```

## /xray-file

Read file using xray file tools.

**Usage:** `/xray-file <file-path> [line-start:line-end]`

**Arguments:**
- `file-path`: Path to file to read (required)
- `line-start:line-end`: Line range to read (optional)

**Example:**
```
/xray-file src/index.ts
/xray-file src/index.ts 1:50
```

## /xray-exec

Execute arbitrary xray command or script.

**Usage:** `/xray-exec <command>`

**Arguments:**
- `command`: Command to execute (required)

**Example:**
```
/xray-exec list files src/
```

## /xray-help

Show this help message.

**Usage:** `/xray-help [command]`

**Arguments:**
- `command`: Specific command to get help for (optional)

**Example:**
```
/xray-help
/xray-help xray-analyze
```

# Implementation Notes

This skill acts as the main interface between OpenClaw channels and xray agents.
It processes user commands and forwards them to the xray API server running on localhost:18431.

## API Endpoints

- `POST /api/agent/invoke` - Invoke xray agent
- `GET /api/agent/status` - Get agent status
- `GET /health` - Health check

## Authentication

The skill reads the `XRAY_API_KEY` environment variable for authentication.

## Error Handling

All errors are caught and formatted as user-friendly messages.
Detailed error information is logged for debugging.

# Dependencies

- xray API server running on localhost:18431
- XRAY_API_KEY environment variable
