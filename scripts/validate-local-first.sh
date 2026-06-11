#!/bin/bash

# Lightweight local-first validation for the public archive.

set -u

ERRORS=0
WARNINGS=0

pass() {
  echo "OK: $1"
}

warn() {
  echo "WARN: $1"
  WARNINGS=$((WARNINGS + 1))
}

fail() {
  echo "FAIL: $1"
  ERRORS=$((ERRORS + 1))
}

echo "Validating SteadyTrack local-first archive..."
echo ""

for module in local plan progress streak infinite quick-checks activity; do
  if [ -f "lib/storage/${module}.ts" ]; then
    pass "storage module exists: ${module}.ts"
  else
    fail "missing storage module: ${module}.ts"
  fi
done

if grep -Eq "@supabase/|@sentry/|@upstash/|@vercel/analytics" package.json 2>/dev/null; then
  fail "hosted-service package is still listed"
else
  pass "no hosted-service runtime package"
fi

if grep -q "getLocalServerClient" lib/content/server.ts 2>/dev/null; then
  pass "server content client uses local SQLite adapter"
else
  fail "server content client is not wired to local SQLite"
fi

if grep -q "new LocalBrowserClient" lib/content/client.ts 2>/dev/null; then
  pass "browser content client has local fallback"
else
  fail "browser content client has no local fallback"
fi

AUTH_USAGE=$(grep -r "\.auth\." lib/ app/ components/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
  grep -v "^\s*//" | \
  grep -v "^\s*\*" | \
  wc -l | tr -d ' ')
if [ "$AUTH_USAGE" -gt 0 ]; then
  fail "found .auth usage outside compatibility layer"
else
  pass "no .auth usage outside compatibility layer"
fi

STALE_IMPORTS=$(grep -r "@/lib/supabase\\|@supabase/\\|@sentry/\\|@upstash/\\|@vercel/analytics" app/ components/ lib/ types/ --include="*.ts" --include="*.tsx" --include="*.md" 2>/dev/null | wc -l | tr -d ' ')
if [ "$STALE_IMPORTS" -gt 0 ]; then
  fail "found stale hosted-service import or docs reference in app/lib/components/types"
else
  pass "no stale hosted-service imports in app/lib/components/types"
fi

if grep -q "No environment variables are required" .env.example 2>/dev/null; then
  pass ".env.example documents the no-credential local path"
else
  warn ".env.example does not clearly document the no-credential local path"
fi

for path in docs/archive docs/runbooks scripts/archive scripts/database migrations lib/supabase instrumentation.ts instrumentation.client.ts sentry.server.config.ts sentry.edge.config.ts; do
  if [ -e "$path" ]; then
    fail "stale public-readiness path still exists: $path"
  else
    pass "stale path absent: $path"
  fi
done

echo ""
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo "All local-first archive checks passed."
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo "Local-first archive checks passed with ${WARNINGS} warning(s)."
  exit 0
else
  echo "Local-first archive checks failed with ${ERRORS} error(s) and ${WARNINGS} warning(s)."
  exit 1
fi
