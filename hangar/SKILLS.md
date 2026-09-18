# Groover hangar skills

Not the 0xray 45-skill costume. Four surfaces:

| Skill | Host | What |
|-------|------|------|
| `mill` | Grok plugin `mill` (mill-plant) | Fasten mill+inspect. `@0xray/foundry` |
| `inspect` | same | Mill receipt, plant vs worn, no costume dump |
| `shop-extract` | this package | $0.02 receipted URL extract |
| `shop-witness` | this package | $0.02 proof of a GET |
| `shop-pin` | this package | $0.01 ERC-8004 card hash. Catalog list = Groover DID + this pin. Never demo 86025. Same x402 envelope as Blips (not bare `ows pay request`). |
| `shop-card` | this package | $0.05 gasless 8004 register. Hangar pays ETH, transfers token to payer. Then pin. |
| `shop-skim` | this package | $0.01 title, hash, bytes, links[]. Not markdown. Next GET. |

Plant: `npx groover-hangar` → `.grok/plugins/shop-*`, `.hermes/plugins/shop-*`, `.openclaw/skills/shop-*`, `.opencode/skills/shop-*`.

Grok marketplace: `grok plugin marketplace add htafolla/groover`.
