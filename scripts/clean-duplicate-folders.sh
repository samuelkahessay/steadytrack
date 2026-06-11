#!/usr/bin/env bash
# Script to remove duplicate " 2" folders from node_modules/@types

set -e

TYPES_DIR="node_modules/@types"

if [ ! -d "$TYPES_DIR" ]; then
  echo "✓ No @types directory found, nothing to clean"
  exit 0
fi

# Find and remove folders with " 2" suffix (space before 2)
cd "$TYPES_DIR"
DUPLICATE_FOLDERS=$(ls -d *" 2" 2>/dev/null || true)

if [ -z "$DUPLICATE_FOLDERS" ]; then
  echo "✓ No duplicate ' 2' folders found"
  exit 0
fi

echo "Removing duplicate folders:"
echo "$DUPLICATE_FOLDERS" | sed 's/^/  - /'

# Remove the duplicate folders
echo "$DUPLICATE_FOLDERS" | while read -r folder; do
  rm -rf "$folder"
done

echo "✓ Duplicate folders removed successfully"
