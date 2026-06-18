---
name: auto-format
description: Automated code formatting hook with Prettier and framework-specific formatters
---

#!/bin/bash

# xray - Auto Format Hook

# Ensures consistent code formatting across all files

echo "🎨 xray - Auto Format"
echo "================================================"

# Initialize status

FORMATTED=true
CHANGES_MADE=()

# Check for Prettier availability

if command -v npx &> /dev/null; then
echo "🔧 Running Prettier formatting..."

    # Format all supported file types
    if npx prettier --write "**/*.{js,jsx,ts,tsx,json,css,scss,md}" --ignore-path .gitignore > /dev/null 2>&1; then
        echo "✅ Prettier formatting completed"
        CHANGES_MADE+=("Prettier formatting applied")
    else
        echo "⚠️ Prettier formatting failed or no files to format"
    fi

else
echo "⚠️ npx/prettier not available"
FORMATTED=false
fi

# Framework-specific formatting (React/TypeScript)

if [ -f "package.json" ] && command -v npm &> /dev/null; then # ESLint auto-fix if available
if npm run lint:fix > /dev/null 2>&1 2>/dev/null; then
echo "🔨 ESLint auto-fix applied"
CHANGES_MADE+=("ESLint auto-fix applied")
fi

    # TypeScript compilation check
    if npm run typecheck > /dev/null 2>&1; then
        echo "✅ TypeScript compilation successful"
    else
        echo "⚠️ TypeScript compilation issues detected"
        FORMATTED=false
    fi

fi

# Format shell scripts if shfmt available

if command -v shfmt &> /dev/null; then
echo "🐚 Formatting shell scripts..."
find . -name "\*.sh" -type f -exec shfmt -w -i 2 {} \; > /dev/null 2>&1
if [ $? -eq 0 ]; then
echo "✅ Shell scripts formatted"
CHANGES_MADE+=("Shell scripts formatted")
fi
fi

# Format Python files if black available

if command -v black &> /dev/null; then
echo "🐍 Formatting Python files..."
black . > /dev/null 2>&1
if [ $? -eq 0 ]; then
echo "✅ Python files formatted"
CHANGES_MADE+=("Python files formatted")
fi
fi

# Check for unstaged changes

if git diff --quiet && git diff --staged --quiet; then
echo "📋 No formatting changes detected"
else
echo "📝 Formatting changes applied:"
for change in "${CHANGES_MADE[@]}"; do
echo " - $change"
done
fi

# Final status

if [ "$FORMATTED" = true ]; then
echo ""
echo "✅ Code formatting completed successfully"
echo "🎯 xray: FORMATTING OPERATIONAL"
else
echo ""
echo "⚠️ Some formatting operations failed"
echo "Manual review recommended"
fi
