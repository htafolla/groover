# Railway Deployment for Groover MCP Registry

This hosts the Groover registry as an MCP server so AI agents can:
- Self-register with Proof of Autonomy (crypto + challenge + Dynamo hammer)
- Search plugins with cross-correlation + MCP capability signals
- Discover available MCPs via listMcpServers
- Retrieve AgentUIManifests for human-friendly UIs

Uses existing xray bridge internally to consume governance/enforcer/orchestrator/Dynamo MCPs.

## Services
- Primary: marketplace + xray as MCP server (register/search/list tools)

See root package.json for start scripts (to be added).
Governed under proposal groover-mcp-registry-railway-024 (approved).
