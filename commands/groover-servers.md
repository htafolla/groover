---
name: groover-servers
description: List all available MCP servers registered in the Groover correlation engine
---

# /groover-servers

List all MCP servers available for cross-correlation through the Groover registry.

**Example:**
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_mcp_servers","arguments":{}}}
```

Returns server names, descriptions, and connection details.