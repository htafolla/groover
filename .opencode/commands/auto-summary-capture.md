#!/bin/bash

# xray - Auto Summary Capture

# Monitors for 'job done print summary' signal and automatically logs summaries

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

echo "📝 xray - Auto Summary Capture"
echo "======================================"
echo "Monitoring for 'job done print summary' signals..."
echo "All AI-generated summaries will be automatically logged to REFACTORING_LOG.md"
echo ""

# Create a temporary file to capture the summary

TEMP_FILE=$(mktemp)
CAPTURING=false

# Function to log captured summary

log_summary() {
if [ -s "$TEMP_FILE" ]; then
echo "📝 Captured AI summary - logging to REFACTORING_LOG.md..."

        # Log the captured content
        export XRAY_SUMMARY_CONTENT="$(cat "$TEMP_FILE")"
        tail -n +6 .opencode/commands/summary-logger.md | bash 2>/dev/null || true

        # Clear temp file
        > "$TEMP_FILE"
        CAPTURING=false

        echo "✅ Summary automatically logged!"
        echo ""
    fi

}

# Monitor for the signal (this would be integrated into the AI workflow)

# For now, demonstrate the concept

echo "🔄 Auto-capture system ready. When AI outputs 'job done print summary',"
echo " the following summary content will be automatically captured and logged."
echo ""
echo "Example usage:"
echo "1. AI completes task"
echo "2. AI outputs: 'job done print summary'"
echo "3. AI outputs summary content"
echo "4. System automatically logs to REFACTORING_LOG.md"
echo ""

# Clean up

rm -f "$TEMP_FILE"
