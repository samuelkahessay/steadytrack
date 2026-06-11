#!/usr/bin/env bash
# Script to detect and warn about duplicate " 2" folders in node_modules/@types
# These are often accidentally created by macOS Finder copy operations

set -e

TYPES_DIR="node_modules/@types"

if [ ! -d "$TYPES_DIR" ]; then
  echo "✓ No @types directory found, skipping check"
  exit 0
fi

# Find folders with " 2" suffix (space before 2)
DUPLICATE_FOLDERS=$(cd "$TYPES_DIR" && ls -d *" 2" 2>/dev/null || true)

if [ -z "$DUPLICATE_FOLDERS" ]; then
  echo "✓ No duplicate ' 2' folders found in node_modules/@types"
  exit 0
fi

echo "⚠️  Found duplicate folders with ' 2' suffix in node_modules/@types:"
echo "$DUPLICATE_FOLDERS" | sed 's/^/  - /'
echo ""
echo "These are likely accidental duplicates created by file system operations."
echo "To remove them, run:"
echo ""
echo "  npm run clean:duplicate-folders"
echo ""

exit 1
