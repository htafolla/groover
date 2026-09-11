# Load this mill into the CLI

This tarball is mill plant only (`mill` + `inspect`) plus `install.mjs`. Not the 0xray costume.

Run from **your project root**, never passwd-home `~/.grok/plugins/0xray`.

```bash
tar xzf mill-plant.tgz
# put factory-config.json (from the configurator) in the repo root
node mill-plant/install.mjs
# or: node mill-plant/install.mjs --from factory-config.json --mint
```

The script:

1. Fastens mill+inspect skills on `.opencode/skills`, `.hermes/plugins/xray-hermes/skills`, `.openclaw/skills`, and project `.grok/plugins/0xray/skills` (skips `.grok` if cwd is passwd home)
2. Fastens mill+inspect agents to `.opencode/agents`
3. Writes `foundry-inventory.json`, `features.json`, `config.json`, `codex.json` from `factory-config.json` (plant path + `.xray/`)
4. `npm i -D 0xray@4.0.9` (mill CLI remains `npx @0xray/foundry`)
5. Prints `npx @0xray/foundry mint` and `npx @0xray/foundry inspect` (or runs them with `--mint`)

Manual equivalent is in the factory page. Isolated HOME must not clobber machine `~/.grok`.
