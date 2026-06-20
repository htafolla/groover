#!/bin/bash
set -e
PROMPT_FILE="$1"
if [ ! -f "$PROMPT_FILE" ]; then
  echo "ERROR: Prompt file not found: $PROMPT_FILE" >&2
  exit 1
fi
exec hermes -z "$(cat "$PROMPT_FILE")" --provider xai-oauth --model grok-4.3
