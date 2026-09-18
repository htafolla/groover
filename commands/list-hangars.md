---
name: list-hangars
description: List hangars in the Clearing catalog (Groover DID + pin). Not MCP servers. Not plugins.
---

# /list-hangars

List hangars from the Clearing catalog. A hangar is listed only with a Groover DID + paid pin (Clearing also enforces solar + live shop). Groover does not invent shops — this tool returns what `GET /v1/catalog` returns.

Default catalog: `https://clearing.rippel.ai/v1/catalog`.

Not MCP servers (`list_mcp_servers`). Not plugins (`search_plugins`).

**Example:**
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_hangars","arguments":{}}}
```

Optional override:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_hangars","arguments":{"catalogUrl":"https://clearing.rippel.ai/v1/catalog"}}}
```

Returns `{ protocol, hangars, source }` from the catalog JSON. Fail-closed on non-200 or invalid JSON.
