#!/usr/bin/env bash
# Sync deploy/hermes-cron.manifest.json → Hermes cron on the production host.
#
# Dry-run by default (prints planned actions). Set INSTALL=1 to apply.
#
# Run on the machine where Hermes cron runs (hermes CLI on PATH; gateway
# recommended: `hermes gateway install` or `hermes gateway`).
#
# Usage:
#   ./deploy/sync-hermes-cron.sh
#   GROOVER_ROOT=/path/to/groover INSTALL=1 ./deploy/sync-hermes-cron.sh
#
# Environment:
#   GROOVER_ROOT          groover checkout (default: parent of deploy/)
#   INSTALL=1             write runner scripts + create/update Hermes cron jobs
#   HERMES_HOME           Hermes state dir (default: ~/.hermes)
#   DELIVER               cron delivery target (default: local — silent workers)
#   HERMES_ACCEPT_HOOKS=1 passed through for non-interactive hermes cron calls
#
# Required on host for workers (see manifest env):
#   MOLTBOOK_API_KEY
# Optional:
#   REPERTOIRE_ROOT, DYNAMO_MCP

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GROOVER_ROOT="${GROOVER_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
MANIFEST="$SCRIPT_DIR/hermes-cron.manifest.json"
INSTALL="${INSTALL:-0}"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
HERMES_SCRIPTS="$HERMES_HOME/scripts"
JOBS_FILE="$HERMES_HOME/cron/jobs.json"
JOB_PREFIX="groover-"
DELIVER="${DELIVER:-local}"

log() { printf '%s\n' "$*"; }
dry() { log "[dry-run] $*"; }
run() {
  if [[ "$INSTALL" == "1" ]]; then
    log "+ $*"
    "$@"
  else
    dry "$*"
  fi
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "error: required command not found: $1" >&2
    exit 1
  fi
}

require_cmd node
require_cmd hermes

if [[ ! -f "$MANIFEST" ]]; then
  log "error: manifest not found: $MANIFEST" >&2
  exit 1
fi

if [[ ! -d "$GROOVER_ROOT" ]]; then
  log "error: GROOVER_ROOT is not a directory: $GROOVER_ROOT" >&2
  exit 1
fi

hermes_cron() {
  if [[ "${HERMES_ACCEPT_HOOKS:-}" == "1" ]]; then
    hermes cron --accept-hooks "$@"
  else
    hermes cron "$@"
  fi
}

log "=== sync hermes cron (groover field shadow) ==="
log "manifest:     $MANIFEST"
log "groover root: $GROOVER_ROOT"
log "hermes home:  $HERMES_HOME"
log "mode:         $([[ "$INSTALL" == "1" ]] && echo apply || echo dry-run)"
log ""

MANIFEST_ENV="$(node -e "
const m = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
for (const [k, v] of Object.entries(m.env || {})) console.log(k + '\t' + v);
" "$MANIFEST")"
if [[ -n "$MANIFEST_ENV" ]]; then
  log "manifest env (must be set on host):"
  while IFS=$'\t' read -r key note; do
    log "  - $key: $note"
  done <<<"$MANIFEST_ENV"
  log ""
fi

if [[ -z "${MOLTBOOK_API_KEY:-}" ]]; then
  log "warning: MOLTBOOK_API_KEY is not set in this shell (required at job runtime)" >&2
fi

read_jobs_json() {
  if [[ -f "$JOBS_FILE" ]]; then
    cat "$JOBS_FILE"
  else
    printf '%s\n' '{"jobs":[]}'
  fi
}

find_job_id_by_name() {
  local name="$1"
  node -e "
const jobs = JSON.parse(process.argv[1]).jobs || [];
const hit = jobs.find(j => (j.name || '') === process.argv[2]);
process.stdout.write(hit ? hit.id : '');
" "$(read_jobs_json)" "$name"
}

write_runner_script() {
  local script_name="$1"
  local command="$2"
  local dest="$HERMES_SCRIPTS/$script_name"

  local body
  body="$(cat <<EOF
#!/usr/bin/env bash
set -euo pipefail
GROOVER_ROOT="${GROOVER_ROOT}"
cd "\$GROOVER_ROOT"
${command}
EOF
)"

  if [[ "$INSTALL" == "1" ]]; then
    mkdir -p "$HERMES_SCRIPTS"
    printf '%s\n' "$body" >"$dest"
    chmod +x "$dest"
    log "  wrote $dest"
  else
    dry "write $dest"
    dry "  #!/usr/bin/env bash"
    dry "  cd $GROOVER_ROOT"
    dry "  $command"
  fi
}

upsert_cron_job() {
  local job_name="$1"
  local schedule="$2"
  local script_name="$3"
  local description="$4"
  local existing_id

  existing_id="$(find_job_id_by_name "$job_name")"

  if [[ -n "$existing_id" ]]; then
    dry "update cron job $job_name ($existing_id)"
    run hermes_cron edit "$existing_id" \
      --name "$job_name" \
      --schedule "$schedule" \
      --script "$script_name" \
      --no-agent \
      --workdir "$GROOVER_ROOT" \
      --deliver "$DELIVER"
  else
    dry "create cron job $job_name"
    run hermes_cron create "$schedule" \
      --name "$job_name" \
      --script "$script_name" \
      --no-agent \
      --workdir "$GROOVER_ROOT" \
      --deliver "$DELIVER" \
      "$description"
  fi
}

while IFS=$'\t' read -r id schedule command cwd description; do
  [[ -z "$id" ]] && continue

  if [[ "$cwd" != "groover-root" ]]; then
    log "error: unsupported cwd '$cwd' for job $id (expected groover-root)" >&2
    exit 1
  fi

  job_name="${JOB_PREFIX}${id}"
  script_name="${job_name}.sh"

  log "job: $id ($description)"
  log "  schedule: $schedule"
  log "  command:  $command"

  write_runner_script "$script_name" "$command"
  upsert_cron_job "$job_name" "$schedule" "$script_name" "$description"
  log ""
done < <(node -e "
const m = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
for (const job of m.jobs || []) {
  const cols = [
    job.id,
    job.schedule,
    job.command,
    job.cwd,
    job.description || '',
  ].map(v => String(v ?? '').replace(/\t/g, ' '));
  console.log(cols.join('\t'));
}
" "$MANIFEST")

log "done."
if [[ "$INSTALL" != "1" ]]; then
  log ""
  log "Dry-run only. Re-run with INSTALL=1 on the Hermes host to apply."
  log "Verify after apply: hermes cron list && hermes cron status"
fi