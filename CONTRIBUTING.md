# Contributing to SteadyTrack

Thank you for your interest in contributing! This document outlines our development workflow and best practices.

## Development Workflow (GitHub Flow)

We use **GitHub Flow** - a simple, branch-based workflow optimized for continuous deployment:

```
main (production) ← always deployable, protected
  ↑
  PR ← feature/fix branches (short-lived)
```

### Quick Start

```bash
# 1. Create a feature branch from main
git checkout main && git pull
git checkout -b feature/your-feature-name

# 2. Make your changes
# ... edit files ...

# 3. Commit and push
git add .
git commit -m "feat: add your feature"
git push origin feature/your-feature-name

# 4. Sync with main before creating PR (IMPORTANT!)
git fetch origin main
git merge origin/main
git push origin feature/your-feature-name

# 5. Open a pull request
gh pr create --fill

# 6. Wait for checks and review preview
# - Vercel automatically creates a preview deployment
# - GitHub Actions runs lint, typecheck, test, build
# - Review the preview URL in the PR

# 7. Merge (after all checks pass)
gh pr merge --squash  # or use GitHub UI
```

**Important:** Step 4 (syncing with main) prevents the "This branch is out-of-date with the base branch" warning on GitHub. Always merge or rebase main before creating a PR.

## Branch Naming Conventions

Use descriptive branch names with a category prefix:

- `production/description` - Production-ready features (see hybrid strategy below)
- `feature/description` - New features (work in progress)
- `fix/description` - Bug fixes
- `hotfix/description` - Urgent production fixes
- `refactor/description` - Code improvements
- `docs/description` - Documentation changes
- `test/description` - Test additions/updates
- `experiment/description` - Exploratory work

**Examples:**
- `production/phase2-analytics-dashboard`
- `feature/add-user-profiles`
- `fix/auth-redirect-loop`
- `hotfix/critical-db-connection`
- `refactor/simplify-api-routes`
- `experiment/test-new-ui`

## Production Branch Strategy

We use a **hybrid approach** for production-ready work to balance focused development with hotfix flexibility.

### Primary Production Work

**One `production/*` branch at a time:**

```bash
# Start new production work
git checkout main && git pull
git checkout -b production/phase2-feature-name

# ... develop, test, iterate ...

# Merge to main when ready
gh pr create --fill
# Wait for checks, then merge
```

**When to merge:**
- ✅ All CI checks pass
- ✅ Vercel preview tested
- ✅ Core acceptance criteria met
- ⚠️ Configuration tasks (monitoring setup, etc.) can be done post-merge

**After merge:**
- Complete any configuration tasks from checklist
- Start next `production/*` branch from updated `main`

### Hotfixes (Emergency Path)

**Can create `production/hotfix-*` anytime:**

```bash
# Branch from main, not from other production branches
git checkout main && git pull
git checkout -b production/hotfix-critical-issue

# Fix, test, merge immediately
gh pr create --title "HOTFIX: Critical issue" --label "hotfix"
# Merge as soon as checks pass (don't wait for other branches)

# If other production branches exist, rebase them afterward:
git checkout production/other-branch
git fetch origin
git rebase origin/main
```

**Hotfix priority:** Critical bugs, security issues, data corruption, service outages

### Experiments (WIP Work)

**Use `feature/*` or `experiment/*` for unfinished work:**

```bash
# NOT production/* (that signals production-ready)
git checkout -b feature/experiment-new-ui
git checkout -b experiment/ab-test-dashboard

# Can have multiple WIP branches simultaneously
# Promote to production/* only when ready for production:
git checkout -b production/new-ui-rollout
```

**Guidelines:**
- `production/*` = Production-ready, merge-ready, well-tested
- `feature/*` = Work in progress, may or may not merge
- `experiment/*` = Exploratory, may be discarded

## Pull Request Process

### Before Opening a PR

1. **Run checks locally:**
   ```bash
   npm run lint        # ESLint checks
   npx tsc --noEmit    # Type checking
   npm test            # Unit tests
   npm run build       # Production build
   ```

2. **CRITICAL: Sync with main to avoid "out-of-date" warnings:**
   ```bash
   git fetch origin main
   git merge origin/main  # Or: git rebase origin/main
   git push origin your-branch-name
   ```

   **Why this matters:** GitHub requires branches to be up-to-date before merging. Syncing before creating the PR prevents the "This branch is out-of-date with the base branch" warning.

### Opening a PR

1. **Use the PR template** (auto-populated when you create a PR)
2. **Fill out all sections:**
   - What: Brief description
   - Why: Problem/feature rationale
   - How to Test: Steps to verify on preview
   - Environment Changes: New env vars, migrations, etc.
   - Checklist: Complete all items

3. **Review your own PR first:**
   - Check the Files Changed tab
   - Verify no unintended changes
   - Add inline comments explaining complex logic

### PR Review & Checks

Your PR must pass these checks before merging:

✅ **Required Checks:**
- **Vercel** - Preview deployment succeeds
- **lint** - ESLint passes
- **typecheck** - TypeScript types are valid
- **test** - Unit tests pass
- **build** - Production build succeeds

✅ **Required Rules:**
- All conversations resolved
- Branch up-to-date with main
- No direct pushes (even admins)

### Testing Your Changes

1. **Check the Vercel preview deployment:**
   - Vercel comments on every PR with a preview URL
   - Test your changes on the preview
   - Verify no console errors

2. **Test across devices/browsers (if UI changes):**
   - Desktop, tablet, mobile
   - Chrome, Firefox, Safari

### Merging

Once all checks pass:

```bash
gh pr merge --squash  # Squash-merge to main
```

Or use the GitHub UI "Squash and merge" button.

**The branch is automatically deleted after merge.**

## Branch Maintenance & Cleanup

Keeping your local git repository clean prevents confusion and keeps your workflow efficient.

### Regular Cleanup (Recommended Monthly)

**1. Prune stale remote references:**
```bash
# Remove references to remote branches that have been deleted on GitHub
git remote prune origin

# Or use fetch with prune:
git fetch --prune
```

**2. Delete local branches with deleted remotes:**
```bash
# List branches with gone remotes
git branch -vv | grep ': gone]'

# Delete them (replace <branch-name> with actual name)
git branch -D <branch-name>
```

**3. Delete merged local branches:**
```bash
# List branches merged to main
git branch --merged main

# Delete them safely (excluding main and current branch)
git branch --merged main | grep -v '^\*\|main' | xargs git branch -d
```

### Quick Cleanup Commands

**Clean script (add to your aliases):**
```bash
# Add to ~/.zshrc or ~/.bashrc
alias git-cleanup='git remote prune origin && git branch -vv | grep ": gone]" | awk "{print \$1}" | xargs -r git branch -D'
```

**Check branch health:**
```bash
# See all branches with their tracking status
git branch -vv

# Count branches
echo "Local branches: $(git branch | wc -l)"
echo "Remote branches: $(git branch -r | wc -l)"
```

### Best Practices

✅ **Do:**
- Prune stale remotes monthly: `git remote prune origin`
- Delete local branches after they're merged
- Keep your branch list under 20 local branches
- Review and delete old experiment/feature branches

❌ **Don't:**
- Keep branches "just in case" - git history preserves all work
- Leave branches with `[gone]` remotes indefinitely
- Accumulate 40+ local branches

### What Gets Cleaned Up Automatically

✅ **GitHub auto-deletes:**
- Branches after PR merge (if "Automatically delete head branches" is enabled)

✅ **You need to manually clean:**
- Local references to deleted remote branches
- Local branches that were merged
- Untracked local branches

### When NOT to Delete

Keep branches that have:
- Uncommitted or unpushed work
- Work you're actively reviewing or referencing
- Experimental code you plan to return to soon
- Unique commits not yet merged to main

### Recovering Deleted Branches

If you accidentally delete a branch:

```bash
# Find the commit SHA
git reflog

# Recreate the branch
git checkout -b <branch-name> <commit-sha>
```

## Commit Message Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>

[optional body]

[optional footer]
```

### Types

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code change that neither fixes a bug nor adds a feature
- `docs:` - Documentation only
- `style:` - Formatting, missing semicolons, etc.
- `test:` - Adding missing tests
- `chore:` - Maintenance tasks

### Examples

```bash
feat: add user profile export functionality

fix: resolve auth redirect loop on mobile

refactor: simplify study plan generation logic

docs: update API documentation for analytics endpoint

test: add coverage for middleware redirect helpers
```

## Hotfix Process

For urgent production issues:

1. **Still create a PR** (fast, but not skipping checks):
   ```bash
   git checkout -b hotfix/critical-issue
   # ... make fix ...
   git push origin hotfix/critical-issue
   gh pr create --title "HOTFIX: Critical issue" --label "hotfix"
   ```

2. **Review Vercel preview and wait for checks**
3. **Merge immediately after checks pass**

**Never push directly to main, even for hotfixes.**

## Rollback Strategy

If a deployment causes issues:

### Option 1: Vercel Instant Rollback
1. Go to Vercel dashboard
2. Find the previous good deployment
3. Click "Promote to Production"

### Option 2: Git Revert
```bash
git checkout -b fix/revert-bad-deployment
git revert <bad-commit-sha>
git push origin fix/revert-bad-deployment
gh pr create --title "Revert: Bad deployment"
# Wait for checks, then merge
```

## Local Development

### Setup

```bash
# Clone and install
git clone https://github.com/samuelkahessay/steadytrack.git
cd steadytrack
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

### Available Scripts

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm start            # Start production server
npm run lint         # Run ESLint
npm test             # Run Vitest tests
npm run typecheck    # Run TypeScript compiler check
```

### Environment Variables

Required for local development:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SENTRY_AUTH_TOKEN: your Sentry auth token
```

See `.env.example` for full list.

## Code Style

### TypeScript

- Use TypeScript for all new files
- Avoid `any` types - use proper typing
- Export types/interfaces for reusability

### React

- Use functional components with hooks
- Use `async`/`await` for server components
- Keep components small and focused
- Extract shared logic into hooks

### File Organization

```
app/              # Next.js app router pages
├── (dashboard)/  # Dashboard pages
└── api/          # API routes

components/       # React components
├── ui/           # Shadcn UI components
└── ...

lib/              # Shared utilities
├── supabase/     # Supabase clients
├── shared/       # Shared business logic
└── ...

data/             # Static data
migrations/       # Database migrations
```

## Database Migrations

When adding database changes:

1. **Create migration file** in `migrations/`
2. **Update `supabase-schema.sql`** with schema changes
3. **Test locally** against your Supabase project
4. **Document in PR** what the migration does

## Getting Help

- **Documentation Issues**: Open an issue with the `docs` label
- **Bug Reports**: Open an issue with the `bug` label
- **Feature Requests**: Open an issue with the `enhancement` label
- **Questions**: Open a discussion in GitHub Discussions

## Code of Conduct

- Be respectful and constructive
- Focus on the code, not the person
- Help others learn and grow

---

**Ready to contribute? Start by picking an issue labeled `good first issue` or `help wanted`!**
