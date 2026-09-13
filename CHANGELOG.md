# Changelog

Core project log (every project). Newest first. Groover-specific notes stay
in the same file after the general heading.

## 2026-09-13 — agent-docs publish surface (Task C2)

### General (core seven)

- Live entrypoints now serve the general set: `GET /README.md`,
  `/CHANGELOG.md`, `/package.json`, `/AGENTS.md`, `/SKILLS.md`, `/llms.txt`
  on the registry HTTP server (`text/markdown` / `text/plain` /
  `application/json` for package.json, not the MCP catch-all banner).
- `package.json` is part of the general core list (with README, CHANGELOG,
  llms.txt, AGENTS.md, SKILLS.md, Docusaurus). Root + marketplace packages
  align at version `0.1.1-mvp`; description and `files` list the published
  docs-serve surface.
- Matching files at `website/static/` (path-as-root after website deploy).
- Docusaurus sidebar leads with **Core docs**, then Groover-specific pages.
- CI starts the Railway `mcp-server.ts` entrypoint and fails if those GETs
  are missing or return `Groover MCP Registry active`.
- **Ship-ready Task C2** still requires live curl evidence after registry +
  website deploy: `npx tsx deploy/check-agent-docs.ts` (AGENTS / SKILLS /
  llms on both hosts must be 200 factory markdown, not the banner).
  README, CHANGELOG, and `package.json` must also be 200, not the banner.

### Groover

- Factory E2E in agent cards: PoA register → Dynamo PASS citation →
  `mint_suit` (full 64-hex DID, GRVR v5 `0x045B35480F289F8f83F53345A0f367875958957a`)
  on `https://registry-production-e2c4.up.railway.app/mcp` → ERC-8004
  register/setURI → hangar pin.
- Dynamo is a **solar hammer**: `REJECT` / `NEEDS_REVISION` / storm can fail
  the proposal. Retry until approved. PoA `register_plugin` does not require
  Dynamo; live mint/mirror do (fail-closed).
- `.gitignore` allowlists published `AGENTS.md` / `SKILLS.md` so 0xray mill
  ignore rules cannot drop them.
