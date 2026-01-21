# Authentication Issues Documentation

## Overview
This document tracks recurring authentication issues in the PriceGit web app.

---

## Issue 1: Login Stuck on "Loading..."

### Symptom
User clicks "Sign in" button, it shows "Loading..." indefinitely and never completes.

### Timeline of Attempts

#### Attempt 1: Changed `router.push("/")` to `window.location.href = "/"`
- **File**: `AuthForm.tsx`
- **Rationale**: Thought Next.js router was conflicting with auth state changes
- **Result**: Worked initially, then issue returned

#### Attempt 2: Added `setLoading(false)` in error branch
- **File**: `AuthForm.tsx`
- **Rationale**: Loading state wasn't being reset on errors
- **Result**: Partial fix - errors now show, but success still hangs

### Root Cause Analysis
The issue is in the `finally` block - it always runs `setLoading(false)`, but when login succeeds, we do `window.location.href = "/"` and `return`. The `finally` block STILL runs after the return, setting loading to false, but by then the page should be navigating away.

The REAL issue: `window.location.href = "/"` doesn't immediately navigate - it schedules navigation. The `finally` block runs, sets loading to false, but then... nothing happens because Supabase's `signInWithPassword` might be hanging on something.

**Looking at the code flow:**
```tsx
const { error } = await signIn(email, password);  // <-- This might be hanging
if (error) {
  // handle error
  setLoading(false);
} else {
  window.location.href = "/";
  return;
}
// finally block runs setLoading(false)
```

The `signIn` function calls `supabase.auth.signInWithPassword()`. After this returns, the `onAuthStateChange` listener fires with `SIGNED_IN` event, which then:
1. Calls `ensureUserProfile()` - async DB operation
2. Calls `fetchUserProfile()` - async DB operation

These async operations in the auth listener might be blocking or failing silently.

---

## Issue 2: Header Shows "Sign In / Sign Up" on Refresh When Logged In

### Symptom
After logging in, refreshing the page briefly shows "Sign In / Sign Up" buttons before showing the username.

### Attempted Fix
Added `loading` state check to Header - show placeholder while auth is loading.

### Result
This completely broke the auth UI because `loading` was staying `true` indefinitely (related to Issue 1).

### Root Cause
The `AuthContext` has a `loading` state that:
1. Starts as `true`
2. Gets set to `false` after `getSession()` completes

But if `getSession()` → `ensureUserProfile()` → `fetchUserProfile()` chain hangs, `loading` never becomes `false`.

---

## The Real Problem: AuthContext Complexity

The `AuthContext.tsx` is doing too much:
1. Getting session
2. Listening for auth changes
3. Creating user profiles on first login
4. Fetching user profiles
5. Handling loading states

All of these are intertwined with async operations that can fail silently or hang.

---

## Proposed Holistic Solution

### Principle: Separate Concerns

1. **Auth (Supabase)** - Just handles login/logout/session
2. **Profile Creation** - Handled by database trigger, not client code
3. **Profile Fetching** - Simple query, with fallback if fails

### Implementation Plan

#### Step 1: Simplify AuthContext
Remove profile creation from client code entirely. The database trigger should handle this.

```tsx
// AuthContext should ONLY:
// 1. Get and maintain session
// 2. Provide signIn/signUp/signOut functions
// 3. Fetch profile (with timeout/fallback)
```

#### Step 2: Add Timeout to Profile Fetch
Don't let profile fetch block the loading state forever.

```tsx
const fetchWithTimeout = async (promise, timeout = 3000) => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), timeout)
  );
  return Promise.race([promise, timeoutPromise]);
};
```

#### Step 3: Separate Loading States
- `authLoading` - Is supabase checking session? (fast, ~100ms)
- `profileLoading` - Is profile being fetched? (can be slow, shouldn't block UI)

#### Step 4: Make Login Form Simpler
Don't wait for auth state changes. Just:
1. Call `signInWithPassword`
2. If no error, redirect immediately
3. Let the new page handle fetching the profile

### Files to Modify
1. `web/src/contexts/AuthContext.tsx` - Simplify
2. `web/src/components/AuthForm.tsx` - Simplify login flow
3. `web/src/components/Header.tsx` - Only check authLoading, not profileLoading

---

## Current Code State (for reference)

### AuthForm.tsx - handleSubmit for login
```tsx
const { error } = await signIn(email, password);
if (error) {
  // handle error
  setLoading(false);
} else {
  localStorage.removeItem("pendingVerification");
  window.location.href = "/";
  return;
}
```

### AuthContext.tsx - signIn function
```tsx
const signIn = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { error };
};
```

### AuthContext.tsx - onAuthStateChange (problematic)
```tsx
if (session?.user && _event === "SIGNED_IN") {
  try {
    await ensureUserProfile(session.user.id, session.user.email!);  // <-- Can hang
    const profile = await fetchUserProfile(session.user.id);         // <-- Can hang
    setSession(session);
    setUser(session?.user ?? null);
    setUserProfile(profile);
  } catch (error) {
    // ...
  }
}
setLoading(false);  // <-- Only runs after above completes
```

The `onAuthStateChange` callback with `SIGNED_IN` event runs async code that can hang, and `setLoading(false)` is inside this callback, so it waits.
