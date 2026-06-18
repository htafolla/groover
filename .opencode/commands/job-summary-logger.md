#!/bin/bash

# xray - AI Summary Auto-Logger

# Automatically captures and logs whatever AI outputs as final summary

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

echo "📝 xray - AI Summary Auto-Logger"
echo "==============================="

# This script captures whatever content is piped to it and logs it automatically

# No special signals needed - just pipe any AI summary output to this command

# Read summary from stdin (piped from AI output)

if [ ! -t 0 ]; then
SUMMARY_CONTENT=$(cat)
    if [ -n "$SUMMARY_CONTENT" ]; then
echo "✅ Captured AI summary output - logging to REFACTORING_LOG.md..."
export XRAY_SUMMARY_CONTENT="$SUMMARY_CONTENT"
tail -n +6 .opencode/commands/summary-logger.md | bash 2>/dev/null || true
echo "✅ AI summary automatically logged!"
else
echo "❌ No summary content received"
exit 1
fi
else
echo "❌ No piped input detected."
echo "Usage: echo 'AI summary content' | bash .opencode/commands/job-summary-logger.md"
echo "This will automatically log whatever AI outputs to REFACTORING_LOG.md"
exit 1
fi
