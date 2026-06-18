# deploy/ — Groover field shadow workers

Moltbook field workers: **consult → govern → act → Repertoire feedback**. Shared config lives in `engage-config.ts`; pipelines in `engage-core.ts`.

## Registry vs field shadow

Groover splits into two cables that ship and operate independently. **`packages/marketplace/`** is the identity/registry MCP server (DID issuance, proof-of-autonomy challenge, plugin search) — run with `npm start` or deployed to Railway. **`deploy/`** is the field shadow: scheduled Hermes cron jobs that engage on Moltbook, call Dynamo governance, and write Repertoire feedback. Registry PRs and deploy PRs are separate concerns; cron workers never substitute for the registry endpoint.

## Environment variables

### Required (production workers)

| Variable | Used by |
|----------|---------|
| `MOLTBOOK_API_KEY` | `moltbook-client.ts`, `moltbook-engage.ts`, `moltbook-other-engage.ts`, `moltbook-post.ts`, `moltbook-heartbeat.ts` |

Without this key, live workers exit with `FATAL`. Dry-run can use fixtures only; set `LIVE_READ=1` (or `--live-read`) to pull live Moltbook data during triage.

### Optional — `engage-config.ts` (single source)

| Variable | Default | Purpose |
|----------|---------|---------|
| `MOLTBOOK_API_BASE` | `https://www.moltbook.com/api/v1` | Moltbook API root |
| `DYNAMO_MCP` | `https://mcp-production-80e2.up.railway.app/call_connected_tool` | Dynamo governance MCP URL |
| `GROOVER_DID` | `did:groover:284895bead2ac15b` | Agent DID for governance calls and self-reply filtering |
| `DYNAMO_BLOCK_RESONANCE_THRESHOLD` | `0.75` | Block non-PASS actions when resonance is below this |
| `MAX_ACTIONS_PER_RUN` | `4` | Cap replies/posts per cron invocation |

### Optional — Repertoire

| Variable | Default | Purpose |
|----------|---------|---------|
| `REPERTOIRE_ROOT` | sibling `../repertoire`, then `node_modules/@0xray/repertoire` | Path to Repertoire provider for consult + post-tick feedback |

### Optional — dry-run / triage toggles

| Variable | When set | Effect |
|----------|----------|--------|
| `DRY_RUN` | `true` | Live workers log actions but do not POST to Moltbook |
| `SKIP_HERMES` | `1` | `engage-dry-run.ts`: skip Hermes inference (repertoire + guard only) |
| `SKIP_GOVERNANCE` | `1` | `engage-dry-run.ts`: skip Dynamo governance step |
| `SKIP_REPERTOIRE_FEEDBACK` | `1` | `post-tick-repertoire.ts`: skip writing feedback after a tick |
| `LIVE_READ` | `1` | `engage-dry-run.ts`: fetch live Moltbook data (needs `MOLTBOOK_API_KEY`) |
| `HERMES_TRIAGE_INFERENCE` | `1` | `triage-stack.ts`: run one live `hermes -z` smoke call |

### Optional — Hermes inference

| Variable | Default | Purpose |
|----------|---------|---------|
| `HERMES_PROVIDER` | `xai-oauth` | Provider passed to `hermes -z` (`hermes-runner.ts`) |
| `HERMES_MODEL` | `grok-4.3` | Model for Hermes inference |

### Cron sync script (`sync-hermes-cron.sh`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `GROOVER_ROOT` | parent of `deploy/` | Checkout path written into runner scripts |
| `INSTALL` | `0` (dry-run) | Set `1` to write scripts and upsert Hermes cron jobs |
| `HERMES_HOME` | `~/.hermes` | Hermes state directory |
| `DELIVER` | `local` | Cron delivery target (silent workers) |
| `HERMES_ACCEPT_HOOKS` | unset | Pass `--accept-hooks` to `hermes cron` when `1` |

## npm scripts (triage)

From the groover repo root:

```bash
# Local stack check: Repertoire consult, deploy unit tests, optional Hermes smoke
npm run triage:stack
HERMES_TRIAGE_INFERENCE=1 npm run triage:stack

# Full engage pipeline dry-run (no Moltbook POST)
npm run triage:engage-dry
npm run triage:engage-loop          # 3 loops, 8s delay (pass extra flags after --)

# Examples
SKIP_HERMES=1 npm run triage:engage-dry
LIVE_READ=1 MOLTBOOK_API_KEY=... npm run triage:engage-dry -- --live-read --max-cases 2
```

## Hermes cron sync

Schedule is declared in `hermes-cron.manifest.json` and applied on the **Hermes production host** (not via npm):

```bash
./deploy/sync-hermes-cron.sh                    # dry-run (default)
GROOVER_ROOT=/path/to/groover INSTALL=1 ./deploy/sync-hermes-cron.sh
```

Jobs installed (prefix `groover-`):

| Job | Schedule | Command |
|-----|----------|---------|
| `moltbook-engage` | every 30 min | `npx tsx deploy/moltbook-engage.ts` |
| `moltbook-other-engage` | hourly | `npx tsx deploy/moltbook-other-engage.ts` |
| `moltbook-post` | every 4 h | `npx tsx deploy/moltbook-post.ts` |

After apply: `hermes cron list && hermes cron status`.

Host must have `MOLTBOOK_API_KEY` in the environment cron inherits; optionally `REPERTOIRE_ROOT` and `DYNAMO_MCP` (see manifest `env` block).