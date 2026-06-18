# xray - Summary Logger

# Automatically logs AI-generated summaries and analysis to REFACTORING_LOG.md

# 🚨 CRITICAL RULE: REFACTORING LOG IS APPEND-ONLY 🚨

#

# The REFACTORING_LOG.md file serves as an immutable audit trail of the project's evolution.

# This file must NEVER be edited or modified after creation - only NEW entries may be appended.

#

# ❌ NEVER edit existing entries

# ❌ NEVER delete entries

# ❌ NEVER reorder entries

# ❌ NEVER modify timestamps or content

#

# ✅ ONLY append new entries to the end

# ✅ ONLY add new information, never change old information

# ✅ ONLY use this automated logging system for consistency

#

# This ensures the refactoring log remains a reliable, immutable record of all changes.

# If you need to correct information, append a new entry documenting the correction.

#

# 🚨 VIOLATION OF THIS RULE WILL BREAK THE PROJECT'S HISTORICAL RECORD 🚨

echo "📝 xray - Summary Logger" >&2
echo "====================================" >&2

# Get script directory and project root

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REFACTORING_LOG="${PROJECT_ROOT}/docs/REFACTORING_LOG.md"

# Check if summary content is provided via environment variable or stdin (XRAY_ primary)

if [ -n "$XRAY_SUMMARY_CONTENT" ]; then
SUMMARY_CONTENT="$XRAY_SUMMARY_CONTENT"
elif [ -n "$XRAY_SUMMARY_CONTENT" ]; then
SUMMARY_CONTENT="$XRAY_SUMMARY_CONTENT"
elif [ ! -t 0 ]; then
    # Read from stdin
    SUMMARY_CONTENT=$(cat)
else
echo "❌ No summary content provided. Use XRAY_SUMMARY_CONTENT environment variable or pipe content."
echo "Usage:"
echo " export XRAY_SUMMARY_CONTENT='summary content' && bash .opencode/commands/summary-logger.md"
echo " echo 'summary content' | bash .opencode/commands/summary-logger.md"
exit 1
fi

# Validate REFACTORING_LOG.md exists

if [ ! -f "$REFACTORING_LOG" ]; then
echo "❌ $REFACTORING_LOG not found"
exit 1
fi

# Generate timestamp

TIMESTAMP=$(date '+%B %Y')

# Log raw content directly without wrapper

echo "$SUMMARY_CONTENT" >> "$REFACTORING_LOG"

echo "✅ Summary successfully logged to docs/REFACTORING_LOG.md"
echo "📊 Entry added with timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
