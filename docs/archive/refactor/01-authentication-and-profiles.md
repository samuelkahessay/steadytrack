# Feature Analysis: Authentication and User Profiles

**Feature Name:** Authentication and User Profiles
**Priority:** P0-Critical (Foundation)
**Complexity:** ⭐⭐ (2/5)
**Estimated Effort:** 3-4 hours

---

## 1. Files Involved

### Core Files (Must Port)
```
app/(auth)/
├── login/page.tsx (34 lines) - Login page UI
└── callback/route.ts (110 lines) - OAuth callback handler

lib/supabase/
├── server.ts (38 lines) - Server-side Supabase client factory
├── client.ts (54 lines) - Browser Supabase client factory
├── middleware.ts - Middleware client factory
├── admin.ts - Admin client (service role)
└── cookies.ts - Cookie security utilities

middleware.ts (80 lines) - Route protection and auth checking

hooks/
└── getSupabaseClient.ts (40 lines) - Client-side Supabase hook

components/auth/
└── GoogleAuthButton.tsx (81 lines) - OAuth button component
```

### Supporting Files
```
lib/middleware-utils.ts - Cookie-preserving redirect utility
lib/logger.ts - Structured logging for auth events
app/(dashboard)/onboarding/page.tsx - Profile creation (next step after auth)
```

### Database Tables
```
- auth.users (Supabase Auth built-in)
- profiles (extends auth.users)
- events (analytics tracking)
```

---

## 2. Copy vs Refactor Analysis

### ✅ Copy As-Is (No Changes Needed)
These files are well-structured and can be ported directly:

1. **`lib/supabase/server.ts`** - Clean server client factory
   - Uses Next.js 15 cookies API correctly
   - Proper TypeScript types
   - Good error handling

2. **`lib/supabase/client.ts`** - Clean browser client factory
   - Environment validation with helpful errors
   - Safe for client-side use
   - Proper cookie configuration

3. **`hooks/getSupabaseClient.ts`** - Lazy-initialized hook
   - Prevents module-scope initialization errors
   - Reuses client instance
   - Good React patterns

4. **`middleware.ts`** - Route protection logic
   - Clean separation of concerns
   - Handles guest mode special case
   - Proper session refresh

### 🔧 Minor Refactoring Needed

1. **`app/(auth)/callback/route.ts`** (110 lines)
   - **Current Issues:**
     - Too many responsibilities (auth + profile check + guest migration + analytics)
     - Inline guest mode logic
   - **Improvements:**
     - Extract guest mode check to utility function
     - Move post-login redirect logic to helper
     - Consider splitting callback types (oauth vs magic link)
   - **Priority:** Low (works fine as-is)

2. **`components/auth/GoogleAuthButton.tsx`**
   - **Current Issues:**
     - Inline cookie setting for post-login redirect
     - Basic error handling (alert())
   - **Improvements:**
     - Use toast notifications instead of alert()
     - Extract cookie logic to utility
   - **Priority:** Medium

### 🚨 Critical Missing Feature

**Auth State Subscription** - NOT IMPLEMENTED
- Currently, the app does NOT listen to `onAuthStateChange`
- Users logged out in another tab remain "logged in" in current tab
- **Impact:** Security risk + poor UX

**Required Addition:**
```typescript
// contexts/AuthContext.tsx (NEW FILE)
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/hooks/getSupabaseClient';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function AuthProvider({ children, initialUser }) {
  const supabase = getSupabaseClient();
  const [user, setUser] = useState<User | null>(initialUser);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);

        // Handle logout in another tab
        if (event === 'SIGNED_OUT') {
          window.location.href = '/login';
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

---

## 3. New File Structure (Refactored)

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx ✅ (copy as-is)
│   │   └── callback/
│   │       └── route.ts 🔧 (minor cleanup)
│   │
│   └── layout.tsx 🆕 (wrap with AuthProvider)
│
├── lib/
│   ├── supabase/
│   │   ├── server.ts ✅ (copy as-is)
│   │   ├── client.ts ✅ (copy as-is)
│   │   ├── middleware.ts ✅ (copy as-is)
│   │   ├── admin.ts ✅ (copy as-is)
│   │   └── cookies.ts ✅ (copy as-is)
│   │
│   └── auth/ 🆕 (NEW - extract utilities)
│       ├── callback-utils.ts (extract from callback route)
│       ├── redirect-utils.ts (post-login redirect logic)
│       └── guest-migration.ts (guest mode detection)
│
├── hooks/
│   ├── getSupabaseClient.ts ✅ (copy as-is)
│   └── useAuth.ts 🆕 (NEW - auth context hook)
│
├── contexts/
│   └── AuthContext.tsx 🆕 (NEW - auth state subscription)
│
├── components/
│   └── auth/
│       └── GoogleAuthButton.tsx 🔧 (improve error handling)
│
└── middleware.ts ✅ (copy as-is)
```

**Legend:**
- ✅ = Copy as-is
- 🔧 = Minor refactoring
- 🆕 = New file (add during port)

---

## 4. Supabase Queries & Optimizations

### Queries Used

#### 1. Session Management
```typescript
// Get current session (middleware, server components)
const { data: { session } } = await supabase.auth.getSession();
```
**Optimization:** ✅ Already optimized (cached by Supabase SDK)

#### 2. Profile Check (Callback Route)
```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single();
```
**Optimization:** ⚠️ Can optimize
- **Current:** Fetches all profile fields (`*`)
- **Improved:** Select only needed fields:
  ```typescript
  .select('id, grade') // Only need to check existence + grade for routing
  ```

#### 3. Analytics Event (Callback Route)
```typescript
await supabase.from('events').insert({
  user_id: user.id,
  event_name: 'sign_in',
  event_data: { method: 'google' }
});
```
**Optimization:** ⚠️ Should be fire-and-forget
- **Current:** Awaits insert (blocks callback)
- **Improved:** Fire-and-forget or background job:
  ```typescript
  // Don't await - let it complete in background
  supabase.from('events').insert(...).then(null, console.error);
  ```

### Database Schema

#### `auth.users` (Supabase Built-in)
```sql
-- Managed by Supabase Auth
-- Contains email, id, created_at, etc.
```

#### `profiles` Table
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  grade INTEGER, -- 11 or 12
  timezone TEXT DEFAULT 'UTC',
  display_name TEXT, -- Optional, for parent dashboard
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

**Optimization:** ✅ Already has RLS policies, no changes needed

---

## 5. Shared Components Needed

### UI Components (from `components/ui/`)
- **Button** - Used in GoogleAuthButton
- **Card** (optional) - Could wrap login form
- **Spinner/Loading** (optional) - Loading states

### Utility Functions
- **`cn()` from `lib/utils.ts`** - Tailwind className utility
- **`serverLogger` from `lib/logger.ts`** - Structured logging
- **Cookie utilities** - Secure cookie handling

### Hooks
- **`getSupabaseClient()`** - Must port before GoogleAuthButton
- **`useAuth()`** - NEW - Must create for auth state

### Context Providers
- **`AuthProvider`** - NEW - Must create for auth state subscription

---

## 6. Step-by-Step Porting Guide

### Phase 1: Foundation (30 minutes)

**Step 1.1:** Port Supabase client factories
```bash
# Copy these files directly (no changes)
cp lib/supabase/server.ts NEW_PROJECT/lib/supabase/
cp lib/supabase/client.ts NEW_PROJECT/lib/supabase/
cp lib/supabase/middleware.ts NEW_PROJECT/lib/supabase/
cp lib/supabase/admin.ts NEW_PROJECT/lib/supabase/
cp lib/supabase/cookies.ts NEW_PROJECT/lib/supabase/
```

**Step 1.2:** Port getSupabaseClient hook
```bash
cp hooks/getSupabaseClient.ts NEW_PROJECT/hooks/
```

**Step 1.3:** Set environment variables
```bash
# Add to .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Step 1.4:** Test Supabase connection
```typescript
// Test in a server component
import { createServerClient } from '@/lib/supabase/server';

export default async function TestPage() {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from('profiles').select('count');

  return <div>{error ? 'Error' : 'Connected!'}</div>;
}
```

---

### Phase 2: Auth UI (45 minutes)

**Step 2.1:** Port GoogleAuthButton component
```bash
cp components/auth/GoogleAuthButton.tsx NEW_PROJECT/components/auth/
```

**Step 2.2:** Improve error handling (optional)
```typescript
// Replace alert() with toast
import { useToast } from '@/components/ui/toast';

const { showToast } = useToast();
// Replace: alert('Failed to sign in');
// With: showToast('Failed to sign in', 'error');
```

**Step 2.3:** Port login page
```bash
cp app/(auth)/login/page.tsx NEW_PROJECT/app/(auth)/login/
```

**Step 2.4:** Test login page
```bash
npm run dev
# Visit http://localhost:3000/login
# Should see "Continue with Google" button
```

---

### Phase 3: OAuth Callback (30 minutes)

**Step 3.1:** Port callback route
```bash
cp app/(auth)/callback/route.ts NEW_PROJECT/app/(auth)/callback/
```

**Step 3.2:** (Optional) Extract utility functions
```typescript
// lib/auth/callback-utils.ts
export function shouldRedirectToGuestMigration(cookieStore) {
  const guestModeCookie = cookieStore.get('steadytrack_guest_mode');
  return guestModeCookie?.value === 'true';
}

export function getPostLoginRedirect(cookieStore, canonicalBase) {
  const redirectCookie = cookieStore.get('post_login_redirect')?.value;
  if (!redirectCookie) return null;

  try {
    const decoded = decodeURIComponent(redirectCookie);
    // Only allow relative paths (prevent open redirects)
    if (decoded.startsWith('/') && !decoded.startsWith('//')) {
      return `${canonicalBase}${decoded}`;
    }
  } catch {}
  return null;
}
```

**Step 3.3:** Test OAuth flow
```bash
# 1. Click "Continue with Google" on login page
# 2. Authorize with Google
# 3. Should redirect to /callback
# 4. Should create session cookie
# 5. Should redirect to /onboarding (no profile) or /dashboard (has profile)
```

---

### Phase 4: Middleware (30 minutes)

**Step 4.1:** Port middleware
```bash
cp middleware.ts NEW_PROJECT/
cp lib/middleware-utils.ts NEW_PROJECT/lib/
```

**Step 4.2:** Test route protection
```bash
# Test 1: Visit /dashboard without auth → should redirect to /login
# Test 2: Visit /login with auth → should redirect to /dashboard
# Test 3: Visit /plan/guest without auth → should work (public)
```

---

### Phase 5: Auth State Subscription (60 minutes) 🆕

**Step 5.1:** Create AuthContext
```typescript
// contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/hooks/getSupabaseClient';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function AuthProvider({
  children,
  initialUser
}: {
  children: React.ReactNode;
  initialUser: User | null
}) {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(initialUser);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event);
        setUser(session?.user ?? null);

        // Handle logout in another tab
        if (event === 'SIGNED_OUT' && session === null) {
          router.push('/login');
        }

        // Handle sign-in in another tab
        if (event === 'SIGNED_IN' && session?.user) {
          router.refresh(); // Refresh server components
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

**Step 5.2:** Wrap app with AuthProvider
```typescript
// app/layout.tsx
import { AuthProvider } from '@/contexts/AuthContext';
import { createServerClient } from '@/lib/supabase/server';

export default async function RootLayout({ children }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body>
        <AuthProvider initialUser={user}>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

**Step 5.3:** Test auth state subscription
```bash
# Test 1: Open app in Tab 1, log in
# Test 2: Open app in Tab 2, log out
# Test 3: Tab 1 should detect logout and redirect to /login
```

---

## 7. Testing Checklist

### Unit Tests

```typescript
// __tests__/lib/supabase/client.test.ts
describe('createClient', () => {
  it('should throw error if env vars missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => createClient()).toThrow('Missing required Supabase');
  });
});

// __tests__/hooks/getSupabaseClient.test.ts
describe('getSupabaseClient', () => {
  it('should return same client instance on multiple calls', () => {
    const { result, rerender } = renderHook(() => getSupabaseClient());
    const client1 = result.current;
    rerender();
    const client2 = result.current;
    expect(client1).toBe(client2); // Same reference
  });
});
```

### Integration Tests

```typescript
// __tests__/auth/login-flow.test.ts
describe('Login Flow', () => {
  it('should redirect to dashboard if already logged in', async () => {
    // Mock session
    const mockSession = { user: { id: '123' } };

    // Visit /login
    const response = await fetch('http://localhost:3000/login');

    // Should redirect to /dashboard
    expect(response.redirected).toBe(true);
    expect(response.url).toContain('/dashboard');
  });

  it('should redirect to login if accessing protected route', async () => {
    // No session
    const response = await fetch('http://localhost:3000/dashboard');

    // Should redirect to /login
    expect(response.redirected).toBe(true);
    expect(response.url).toContain('/login');
  });
});
```

### Manual Testing Checklist

- [ ] **Login Flow**
  - [ ] Click "Continue with Google" opens OAuth popup
  - [ ] Successful auth redirects to callback
  - [ ] Callback creates session cookie
  - [ ] Callback redirects to /onboarding (new user) or /dashboard (existing)
  - [ ] Session persists across page refreshes

- [ ] **Route Protection**
  - [ ] Accessing /dashboard without auth redirects to /login
  - [ ] Accessing /login with auth redirects to /dashboard
  - [ ] Accessing /plan/guest without auth works (public route)
  - [ ] Post-login redirect works (e.g., /login?redirectTo=/settings)

- [ ] **Auth State Sync**
  - [ ] Logout in Tab A detects in Tab B and redirects
  - [ ] Login in Tab A detects in Tab B and refreshes
  - [ ] Auth state updates in real-time (onAuthStateChange fires)

- [ ] **Error Handling**
  - [ ] Missing PKCE cookie shows error message
  - [ ] Failed OAuth exchange shows error message
  - [ ] Invalid post-login redirect ignored (no open redirect)

- [ ] **Guest Mode Integration**
  - [ ] Guest mode cookie triggers migration flow
  - [ ] Callback redirects to /plan/guest?postAuth=1 for migration

---

## 8. Migration Risks & Mitigation

### Risk 1: Missing PKCE Cookie (OAuth Failure)
**Symptom:** OAuth callback fails with "missing_pkce" error

**Causes:**
- Cookie domain mismatch (localhost vs 127.0.0.1)
- Secure cookie required but not set (HTTPS vs HTTP)
- Third-party cookie blocking (browser settings)

**Mitigation:**
- Use `getCookieSecureOptionServer()` to auto-detect HTTPS/HTTP
- Test on both localhost:3000 and 127.0.0.1:3000
- Add detailed logging in callback route (already present)
- Consider magic link fallback (no PKCE cookies needed)

### Risk 2: Session Lost on Redirect
**Symptom:** User redirected to /login after successful OAuth

**Causes:**
- Middleware not preserving session cookies
- Missing `redirectWithCookies()` utility

**Mitigation:**
- Always use `redirectWithCookies()` in middleware (already implemented)
- Test redirects with `Set-Cookie` headers present

### Risk 3: Auth State Desync (New Feature)
**Symptom:** User logged out in one tab, still "logged in" in another

**Cause:** Missing `onAuthStateChange` subscription (current bug)

**Mitigation:**
- Implement AuthContext with subscription (Step 5 above)
- Test cross-tab logout scenario

---

## 9. Performance Considerations

### 1. Lazy Client Initialization ✅
- `getSupabaseClient()` hook uses `useRef` for lazy init
- Prevents duplicate clients in React Strict Mode

### 2. Server-Side Session Check ⚠️
- Middleware calls `getSession()` on every request
- **Impact:** Adds ~5-10ms per request
- **Acceptable:** Required for route protection
- **Optimization:** None needed (Supabase caches session)

### 3. Profile Fetch in Callback ⚠️
- Callback route fetches full profile after OAuth
- **Current:** SELECT *
- **Improved:** SELECT id, grade (only needed fields)
- **Impact:** Minimal (profiles table small)

---

## 10. Security Checklist

- [x] **PKCE flow** - Uses PKCE for OAuth (mitigates auth code interception)
- [x] **Secure cookies** - Detects HTTPS and sets `secure: true` appropriately
- [x] **SameSite=lax** - Prevents CSRF attacks
- [x] **Open redirect protection** - Post-login redirect validated (must start with `/`)
- [x] **RLS policies** - Profiles table has RLS enabled
- [ ] **Auth state subscription** - ⚠️ MISSING - must implement (Step 5)
- [x] **Session refresh** - Middleware refreshes expired sessions
- [x] **Service role isolation** - Admin client (service role) only used where needed

---

## 11. Dependencies for Next Features

### This Feature is Required By:
- ✅ **All features** - Foundation for entire app
- ✅ **Onboarding** (#2) - Creates profile after auth
- ✅ **Dashboard** (#4) - Requires user ID
- ✅ **Settings** (#9) - Profile management

### This Feature Depends On:
- ❌ **None** - Foundation feature (no dependencies)

---

## 12. Rollout Checklist

### Pre-Deployment
- [ ] Port all auth files (Phase 1-4)
- [ ] Implement AuthContext (Phase 5)
- [ ] Run all tests (unit + integration)
- [ ] Test OAuth flow end-to-end
- [ ] Test route protection
- [ ] Test cross-tab auth sync

### Deployment
- [ ] Set production environment variables
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `NEXT_PUBLIC_SITE_URL` (production domain)
- [ ] Configure OAuth redirect URLs in Supabase dashboard
  - [ ] Add `https://yourdomain.com/callback` to allowed URLs
- [ ] Test OAuth in production environment

### Post-Deployment
- [ ] Monitor Sentry for auth errors
- [ ] Check logs for PKCE cookie issues
- [ ] Verify session persistence works

---

## 13. Quick Reference: Key Files

| File | Purpose | Copy/Refactor |
|------|---------|---------------|
| `lib/supabase/server.ts` | Server-side Supabase client | ✅ Copy as-is |
| `lib/supabase/client.ts` | Browser Supabase client | ✅ Copy as-is |
| `hooks/getSupabaseClient.ts` | Supabase hook for components | ✅ Copy as-is |
| `middleware.ts` | Route protection | ✅ Copy as-is |
| `app/(auth)/login/page.tsx` | Login UI | ✅ Copy as-is |
| `app/(auth)/callback/route.ts` | OAuth callback handler | 🔧 Minor cleanup |
| `components/auth/GoogleAuthButton.tsx` | OAuth button | 🔧 Improve errors |
| `contexts/AuthContext.tsx` | Auth state subscription | 🆕 Create new |

---

## 14. Estimated Timeline

| Phase | Task | Time |
|-------|------|------|
| Phase 1 | Port Supabase clients + hook | 30 min |
| Phase 2 | Port auth UI (login page, button) | 45 min |
| Phase 3 | Port OAuth callback route | 30 min |
| Phase 4 | Port middleware + route protection | 30 min |
| Phase 5 | Implement AuthContext (NEW) | 60 min |
| Testing | Manual + unit tests | 60 min |
| **Total** | | **~4 hours** |

---

## 15. Success Criteria

✅ **Feature is successfully ported when:**
1. Users can log in with Google OAuth
2. Session persists across page refreshes
3. Protected routes redirect to /login when not authenticated
4. Login page redirects to /dashboard when authenticated
5. Auth state syncs across tabs (logout detected)
6. OAuth callback handles all edge cases (guest mode, post-login redirect)
7. All tests pass (unit + integration + manual)

---

**Next Feature:** [02-study-plan-creation.md](./02-study-plan-creation.md)
