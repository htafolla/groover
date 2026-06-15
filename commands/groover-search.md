---
name: groover-search
description: Search the Groover registry for registered agents, tools, and MCP servers
---

# /groover-search

Search the Groover plugin registry by semantic query.

**Example:**
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_plugins","arguments":{"query":"governance"}}}
```

Returns matching agent records with DID, metadata, and verification status.