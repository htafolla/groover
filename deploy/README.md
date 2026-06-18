# deploy/ — Field engage pipeline + optional add-ons

**Core (no Moltbook required):** `engage-core.ts` runs **consult → infer → guard → govern → JSONL → Repertoire feedback + ingest**. Shared config: `engage-config.ts`, memory loop: `post-tick-repertoire.ts`.

**Moltbook is an add-on**, not a platform dependency. Groover ships reference workers (`moltbook-*.ts`) as *its* activation — Jelly, ZigZag, or any project wires the same `engage-core` pipeline to their own surface and API keys.

## Registry vs field engage

Groover splits into two cables that ship and operate independently.

| Cable | Path | Role |
|-------|------|------|
| **Registry** | `packages/marketplace/` | DID issuance, proof-of-autonomy, plugin search — `npm start` or Railway |
| **Field engage** | `deploy/engage-core.ts` | Generic governed inference + Repertoire memory loop |
| **Moltbook add-on** | `deploy/moltbook-*.ts` | Groover's optional public actuation — requires per-project `MOLTBOOK_API_KEY` |

Registry PRs and deploy PRs are separate. Cron workers never substitute for the registry endpoint.

## Environment variables

### Required for Moltbook add-on only

| Variable | Used by |
|----------|---------|
| `MOLTBOOK_API_KEY` | `moltbook-client.ts`, `moltbook-engage.ts`, `moltbook-other-engage.ts`, `moltbook-post.ts`, `moltbook-heartbeat.ts` |

Only needed when running Groover's Moltbook workers. Without this key, those scripts exit with `FATAL`. The core pipeline (`engage-dry-run`, triage, Repertoire ingest) runs without it. Set `LIVE_READ=1` to pull live Moltbook data during triage when the add-on is enabled.

### Optional — `engage-config.ts` (single source)

| Variable | Default | Purpose |
|----------|---------|---------|
| `MOLTBOOK_API_BASE` | `https://www.moltbook.com/api/v1` | Moltbook API root |
| `DYNAMO_MCP_URL` | `https://mcp-production-80e2.up.railway.app` | Dynamo base URL (P0.1 contract — derives URLs below) |
| `DYNAMO_MCP` | `${DYNAMO_MCP_URL}/call_connected_tool` | Dynamo governance MCP URL (override full URL if needed) |
| `GOVERNANCE_ENDPOINT` | `${DYNAMO_MCP_URL}/governance` | 0xRay xray-governance HTTP endpoint |
| `GROOVER_DID` | `did:groover:284895bead2ac15b` | Agent DID for governance calls and self-reply filtering |
| `DYNAMO_BLOCK_RESONANCE_THRESHOLD` | `0.75` | Block non-PASS actions when resonance is below this |
| `MAX_ACTIONS_PER_RUN` | `4` | Cap replies/posts per cron invocation |

### Optional — Repertoire

| Variable | Default | Purpose |
|----------|---------|---------|
| `REPERTOIRE_ROOT` | sibling `../repertoire`, then `node_modules/@0xray/repertoire` | Path to Repertoire for consult, post-tick feedback, and JSONL ingest |
| `REPERTOIRE_INGEST_SOURCE` | engage `logDir` (see below) | Override source directory for post-tick ingest when host paths differ |

### Optional — dry-run / triage toggles

| Variable | When set | Effect |
|----------|----------|--------|
| `DRY_RUN` | `true` | Live workers log actions but do not POST to Moltbook |
| `SKIP_HERMES` | `1` | `engage-dry-run.ts`: skip Hermes inference (repertoire + guard only) |
| `SKIP_GOVERNANCE` | `1` | `engage-dry-run.ts`: skip Dynamo governance step |
| `SKIP_REPERTOIRE_FEEDBACK` | `1` | `post-tick-repertoire.ts`: skip writing feedback after a tick |
| `SKIP_REPERTOIRE_INGEST` | `1` | `post-tick-repertoire.ts`: skip auto-ingest after JSONL append (A3.1) |
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

After each tick, `engage-core` appends enriched JSONL to `research/groover-inference-logs/` (or `logDir` override) and runs **post-tick ingest** into Repertoire (`logs/groover-inference/`), idempotent by `comment_id` / `post_id`. No Moltbook API call is required for ingest — it reads local JSONL only.