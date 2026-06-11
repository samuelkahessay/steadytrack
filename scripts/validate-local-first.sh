#!/bin/bash

# Validation script for local-first refactoring
# Ensures all auth remnants are removed and localStorage is properly configured

echo "🔍 Validating Local-First Refactoring..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Check 1: No zombie routes
echo "📁 Check 1: Zombie routes deleted..."
if [ -d "app/share" ] || [ -d "app/parent" ] || [ -d "components/parent" ]; then
  echo -e "${RED}❌ Share/parent routes still exist${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✓ No zombie routes found${NC}"
fi

# Check 2: Storage modules exist
echo ""
echo "💾 Check 2: localStorage modules..."
MISSING_MODULES=()
for module in local plan progress streak infinite quick-checks activity; do
  if [ ! -f "lib/storage/${module}.ts" ]; then
    MISSING_MODULES+=("${module}.ts")
  fi
done

if [ ${#MISSING_MODULES[@]} -gt 0 ]; then
  echo -e "${RED}❌ Missing storage modules: ${MISSING_MODULES[*]}${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✓ All storage modules present${NC}"
fi

# Check 3: No auth helpers packages
echo ""
echo "📦 Check 3: Auth packages removed..."
if grep -q "@supabase/auth-helpers" package.json 2>/dev/null; then
  echo -e "${RED}❌ Auth helpers still in package.json${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✓ No auth-helpers packages found${NC}"
fi

# Check 4: Supabase clients are anonymous
echo ""
echo "🔐 Check 4: Supabase clients are anonymous..."
if grep -q "persistSession: false" lib/supabase/client.ts && grep -q "persistSession: false" lib/supabase/server.ts; then
  echo -e "${GREEN}✓ Supabase clients configured for anonymous access${NC}"
else
  echo -e "${YELLOW}⚠️  Warning: Check Supabase client configuration${NC}"
  WARNINGS=$((WARNINGS + 1))
fi

# Check 5: No .auth calls outside supabase config (ignore comments and test files)
echo ""
echo "🚫 Check 5: No .auth usage..."
AUTH_USAGE=$(grep -r "\.auth\." lib/ app/ components/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
  grep -v "lib/supabase" | \
  grep -v "app/test/" | \
  grep -v "^\s*//" | \
  grep -v "^\s*\*" | \
  wc -l | tr -d ' ')
if [ "$AUTH_USAGE" -gt 0 ]; then
  echo -e "${RED}❌ Found .auth calls outside supabase config:${NC}"
  grep -r "\.auth\." lib/ app/ components/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
    grep -v "lib/supabase" | \
    grep -v "app/test/" | \
    grep -v "^\s*//" | \
    grep -v "^\s*\*" | \
    head -3
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✓ No auth method calls found${NC}"
fi

# Check 6: .env.example updated
echo ""
echo "⚙️  Check 6: Environment config..."
if grep -q "Content Only - No Authentication" .env.example 2>/dev/null; then
  echo -e "${GREEN}✓ .env.example updated for local-first${NC}"
else
  echo -e "${YELLOW}⚠️  Warning: .env.example may need updating${NC}"
  WARNINGS=$((WARNINGS + 1))
fi

# Check 7: Build succeeds
echo ""
echo "🏗️  Check 7: Build test..."
if npm run build > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Build succeeds${NC}"
else
  echo -e "${RED}❌ Build failed - run 'npm run build' to see errors${NC}"
  ERRORS=$((ERRORS + 1))
fi

# Check 8: No userId props in components
echo ""
echo "🧹 Check 8: userId prop cleanup..."
USERID_PROPS=$(grep -r "userId.*string" components/ app/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "user_id" | wc -l | tr -d ' ')
if [ "$USERID_PROPS" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Warning: Found userId props (${USERID_PROPS} occurrences)${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "${GREEN}✓ No userId props found${NC}"
fi

# Check 9: localStorage has SSR guards
echo ""
echo "🛡️  Check 9: SSR safety..."
UNSAFE_STORAGE=$(grep -r "localStorage\." app/ components/ --include="*.tsx" 2>/dev/null | grep -v "useEffect" | grep -v "typeof window" | grep -v "lib/storage" | wc -l | tr -d ' ')
if [ "$UNSAFE_STORAGE" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Warning: Found ${UNSAFE_STORAGE} potentially unsafe localStorage access${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "${GREEN}✓ All localStorage access is SSR-safe${NC}"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅ All validation checks passed!${NC}"
  echo ""
  echo "Local-first refactoring is complete and ready for deployment."
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠️  Validation passed with ${WARNINGS} warnings${NC}"
  echo ""
  echo "Review warnings above before deploying to production."
  exit 0
else
  echo -e "${RED}❌ Validation failed with ${ERRORS} errors and ${WARNINGS} warnings${NC}"
  echo ""
  echo "Fix errors above before deploying."
  exit 1
fi
