# Claude Code Guidelines

This document contains instructions for Claude Code when working on this project.

## ⚠️ IMPORTANT: Local-First Architecture

**This app is LOCAL-FIRST with NO AUTHENTICATION:**

- All user data (plans, progress, streaks) is stored in **localStorage**
- Supabase is used ONLY for anonymous read-only access to curriculum content
- NO user accounts, NO auth, NO server-side user data
- Storage modules are in `/lib/storage/` - use these for all user data operations

**DO NOT:**
- Add authentication code
- Create user tables or RLS policies for user data
- Use Supabase for user data storage
- Add API routes that expect authenticated users

## Development Workflow

**ALWAYS follow the branching and commit standards documented in CONTRIBUTING.md.**

Key points:
- Create feature branches from main: `git checkout -b fix/description` or `feature/description`
- Use conventional commit messages: `feat:`, `fix:`, `refactor:`, `docs:`, etc.
- Run checks before committing: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`
- Create PRs using `gh pr create --fill`
- Never push directly to main

## Branch Naming

Use appropriate prefixes:
- `fix/` - Bug fixes
- `feature/` - New features
- `hotfix/` - Urgent production fixes
- `refactor/` - Code improvements
- `docs/` - Documentation changes
- `production/` - Production-ready work (one at a time, unless hotfix)

## Commit Message Format

```
<type>: <description>

[optional body]
```

Examples:
- `fix: correct OpenGraph URLs to use canonical domain`
- `feat: add user profile export functionality`
- `refactor: simplify authentication middleware`

## Before Every Commit

1. Run linting: `npm run lint`
2. Type check: `npx tsc --noEmit`
3. Run tests: `npm test`
4. Test build: `npm run build`

## PR Process

**CRITICAL: Always sync with main before creating PR to avoid "out-of-date" warnings:**

1. **Ensure branch is up to date with main:**
   ```bash
   git fetch origin main
   git merge origin/main
   # OR use rebase: git rebase origin/main
   ```
2. Push updated branch: `git push origin your-branch-name`
3. Fill out PR template completely
4. Wait for all CI checks to pass
5. Review Vercel preview deployment
6. Merge using squash merge

See CONTRIBUTING.md for complete details.
