# SKILLS.md

Core skill index (every project). General set first, then Groover.

## Core docs (every project)

| File | Live |
|------|------|
| `README.md` | `/README.md` |
| `CHANGELOG.md` | `/CHANGELOG.md` |
| `package.json` | `/package.json` |
| `llms.txt` | `/llms.txt` |
| `AGENTS.md` | `/AGENTS.md` |
| `SKILLS.md` | this file |
| Docusaurus | `/docs` |

Fetch on the registry or website. Factory E2E lives under Groover below.

## Groover factory (name the agent)

Same MCP for register **and** mint:
`POST https://registry-production-e2c4.up.railway.app/mcp`

Canonical: [factory-parity](https://github.com/htafolla/groover/blob/main/website/docs/factory-parity.md)
· [AGENT-REGISTRATION-GUIDE](https://github.com/htafolla/groover/blob/main/docs/AGENT-REGISTRATION-GUIDE.md)

| Skill | Host | What |
|-------|------|------|
| PoA register | Railway MCP above | `get_registration_challenge` → turns → `register_plugin`. **Dynamo is not required for register.** |
| Dynamo gate | `POST https://hammer.rippel.ai/govern_with_solar` | **Solar hammer** — can `REJECT` / `NEEDS_REVISION` / storm-override. Retry until approved (`PASS` + `persistToChain: true` + real solar + not `storm`). Do not mint on a failed proposal. Citation = `0x` + `containerId`. Live without citation is a clear reject. `dryRun: true` may omit it (labeled). |
| `mint_suit` | **same** Railway MCP | Full 64-hex DID on GRVR v5 `0x045B35480F289F8f83F53345A0f367875958957a`. Bind `groover-mint:v1\|{did}\|{pack}\|{to.toLowerCase()}\|{issuedAtMs}`. |
| ERC-8004 | `deploy/register-8004-once.ts` | `register` then `setURI` on `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`. Ops: `GRVR_PRIVATE_KEY`. Do not redeploy GRVR. |
| mill / inspect | Grok plugin `mill` / `@0xray/foundry` | Suit DNA. Do not mill-plant Clearing into 0xray. |

dryRun ≠ live. `0xray-suit` needs inventory + `inspect.ok`. Pin **your**
`agentId`, never demo `86025`.

### Hangar shops (boutique)

| Skill | Host | What |
|-------|------|------|
| `shop-extract` | hangar | $0.02 receipted URL extract |
| `shop-witness` | hangar | $0.02 proof of a GET |
| `shop-pin` | hangar | $0.01 ERC-8004 card hash |

Plant: `npx groover-hangar`. Marketplace: `grok plugin marketplace add htafolla/groover`.

- extract $0.02 `https://clearing-production-9968.up.railway.app/v1/extract?url=`
- witness $0.02 `https://clearing-production-9968.up.railway.app/v1/witness?url=`
- pin $0.01 `https://clearing-production-9968.up.railway.app/v1/pin?agentId=`

Unpaid GET → 402. Pay: `ows pay request '<url>' --wallet agent-treasury-1`.
