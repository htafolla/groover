# Lean prefab

Free to start. mill + inspect only. **Not** the 45-skill costume. Clearing stays its own MCP.

The clerk you pay is already live:

| Clerk | URL | Price |
|---|---|---|
| Extract | `GET /v1/extract?url=` | $0.02 — markdown + **GET receipt** (status, content-type, body sha256, bytes) |
| Witness | `GET /v1/witness?url=` | $0.02 — receipt only, no summary |

Host: `https://clearing-production-9968.up.railway.app`

If a 200 is 106 bytes of MCP catch-all, witness says so. Extract will not lie that it was a factory.

Retry the same `paymentId` / payload: `replayed: true`, no second signature.

## Load

```bash
# mill-plant (this factory page)
# then copy this skill:
cp SKILL.md <project>/.grok/plugins/0xray/skills/lean-clerk/SKILL.md
npm i -D 0xray@4.0.9
```

Mint a Groover DID later if you want a name. The clerk does not need your DID to settle.
