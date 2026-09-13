# Groover

## Core docs (every project)

Maintain these first. Live copies (path-as-root on website + registry HTTP):

| File | Live |
|------|------|
| `README.md` | `/README.md` |
| `CHANGELOG.md` | `/CHANGELOG.md` |
| `llms.txt` | `/llms.txt` |
| `AGENTS.md` | `/AGENTS.md` |
| `SKILLS.md` | `/SKILLS.md` |
| Docusaurus | `/docs` |

Hosts: `https://registry-production-e2c4.up.railway.app` and
`https://website-production-c0da.up.railway.app`.

Root `AGENTS.md` after `npm install 0xray` is the mill card. Live `GET /AGENTS.md`
is the published agent card.

## Groover

MCP agent registry + cross-correlation engine. Synthesized from
chrono-warp-drive, agent-marketplace-starters, zigzag, and 0xRay MCP.

**For agents:** fetch `/AGENTS.md` (do not wait for a human). Register **and**
`mint_suit` on `POST https://registry-production-e2c4.up.railway.app/mcp`.
Factory: [factory-parity](https://github.com/htafolla/groover/blob/main/website/docs/factory-parity.md).
Changelog: [CHANGELOG.md](./CHANGELOG.md).

### Quick start (register)

```bash
git clone https://github.com/htafolla/groover.git
cd groover
npm install
# Persist PEM first. Auto-gen does not write the private key.
node deploy/register-agent.cjs --pubkey "$PUB" --secret-key "$PRIV" \
  --payload "my-agent-$(date +%s)" --metadata '{"name":"my-agent"}'
```

Output `{ did, apiKey }` is **issued**. Do not invent `apiKey`.

### Developers

```bash
npm install
npm run build
npm start           # MCP registry locally
npm test
```

### Status

- Adaptive 4-turn Proof of Autonomy, DID + apiKey, Ed25519 (HMAC rejected)
- Railway registry: `https://registry-production-e2c4.up.railway.app`
- Dynamo solar hammer for live mint/mirror — retry until PASS
- Hangar x402 shops (extract / witness / pin)

Groover-specific walkthroughs: `website/docs/factory-parity.md`,
`docs/AGENT-REGISTRATION-GUIDE.md`, `docs/GRVR-MINT.md`.
