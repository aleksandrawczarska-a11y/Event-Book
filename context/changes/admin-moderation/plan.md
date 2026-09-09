# Admin Portfolio Moderation Implementation Plan

## Overview

Implement roadmap **S-04** (`admin-moderation`): an administrator can review pending portfolio entries and approve or reject (hide) them. Covers PRD **FR-008**. Scope is portfolio only — no admin moderation of decorator profiles or contact inquiries in this slice.

## Current State Analysis

- **DB layer already built (F-01):** `public.is_admin()` reads `app_metadata.role = 'admin'` from the JWT; `portfolio_entries.moderation_status` enum (`pending | approved | rejected`, default `approved`); RLS `portfolio_entries_admin_update_moderation` already grants admins UPDATE; public SELECT (`portfolio_entries_select_public_approved`) already filters to `approved` + published profile.
- **Gap 1 — no admin SELECT on `portfolio_entries`:** an admin cannot list other decorators' pending/rejected rows today; only their own-profile SELECT policy and the public-approved SELECT policy exist.
- **Gap 2 — no admin SELECT on Storage:** the `portfolio` bucket (`supabase/migrations/20260716010000_portfolio_storage.sql`) only grants owner-scoped (`authenticated` + folder-prefix-matches-`auth.uid()`) SELECT/INSERT/UPDATE/DELETE. An admin can't `createSignedUrl` another decorator's photo to review it.
- **No app-layer admin concept at all:** `src/middleware.ts` only resolves `context.locals.user` (logged in or not); `src/env.d.ts` `Locals` has no `isAdmin` field; no `requireAdmin` helper alongside `requireAuth`/`requireDecoratorProfile` in `src/lib/api-auth.ts`.
- **Portfolio CRUD pattern:** `src/pages/api/portfolio/{index,upload,[id]}.ts` — zod-free simple validation, `requireAuth` → `requireDecoratorProfile` → Supabase call → `jsonError` on failure. `src/pages/dashboard/portfolio.astro` loads own entries via direct SSR + `resolvePortfolioEntriesImages` (signs URLs), renders `PortfolioPanel.tsx` (`client:only="react"`) for the interactive list + delete + create form.
- **Dashboard shell:** `DashboardLayout.astro` renders a static `navItems` array; `dashboard.astro` is the hub with profile/portfolio/inquiries cards. Neither has any per-role branching today.

### Key Discoveries:

- `user.app_metadata.role` is already present on the `User` object returned by `supabase.auth.getUser()` (used in `middleware.ts`) — no extra JWT decoding needed; this mirrors exactly what `is_admin()` checks server-side in RLS, so the app-layer flag and the DB-layer gate read the same source of truth.
- Admin RLS already exists for `decorator_profiles` (SELECT/UPDATE) and `contact_inquiries` (SELECT) per the F-01 migration — only `portfolio_entries` and its storage bucket are missing the admin SELECT policy, so this plan's schema change is narrowly scoped to those two gaps.
- `getPortfolioImageUrl` / `resolvePortfolioEntriesImages` (`src/lib/storage-url.ts`) already handle signed-URL generation and the `pending/` placeholder case; the admin queue reuses these unchanged once the storage RLS gap is fixed.

## Desired End State

1. A user whose Supabase `app_metadata.role` is `admin` sees a "Moderation" section in `/dashboard` (visible only to them); other users never see it.
2. That section lists portfolio entries with `moderation_status = 'pending'` across all decorators (photo, event description, decorator company name, submitted date), with Approve / Reject buttons.
3. Approve sets `moderation_status = 'approved'`; Reject sets `moderation_status = 'rejected'` (this is "hide" — RLS already excludes non-`approved` rows from the public profile). Both actions are reversible by re-visiting the queue with a status filter.
4. A decorator viewing `/dashboard/portfolio` sees a small status badge (Pending / Approved / Rejected) on each of their own entries.
5. A non-admin cannot load the moderation UI or call the moderation API, regardless of what URL they try — enforced at both the app layer (fail-closed) and the DB layer (existing RLS).

### Verification

- Seed/assign a Supabase user with `app_metadata: {"role":"admin"}`; sign in; `/dashboard` shows the Moderation section; a non-admin session does not.
- A decorator creates a portfolio entry (default `pending`... see "What We're NOT Doing" — default stays `approved`, so seed a `pending` row directly for this test); admin sees it in the queue, approves it → decorator's badge flips to Approved, entry appears on the public profile.
- Admin rejects an `approved` entry → decorator's badge flips to Rejected, entry disappears from the public profile (RLS `portfolio_entries_select_public_approved` already enforces this).
- Non-admin hitting the moderation API directly (e.g. via curl) gets a 403/401, not a 500 or silent success.

## What We're NOT Doing

- Moderating `decorator_profiles` text content or `contact_inquiries` (portfolio only, per Q1).
- Pre-publish moderation / changing the `moderation_status` column DEFAULT away from `approved` (per Q2 — stays post-publish).
- A new moderation-status enum value for "hide" — reuses `rejected` (per Q3).
- A dedicated `/admin` route — moderation lives inside `/dashboard`, admin-gated (per Q5).
- Rejection reason / notes field, or emailing the decorator on status change (per Q7, Q12 priority cut).
- A pending-count badge in the nav, bulk approve/reject, or any filter beyond the default `pending` queue (per Q6, Q12 priority cut).
- Requiring an admin to have their own decorator profile (per Q9 — admin access is independent of `decorator_profiles`).
- Any change to the existing public portfolio/profile RLS policies — only additive admin-SELECT policies are introduced.

## Implementation Approach

Two additive RLS policies close the DB-layer gap (admin SELECT on `portfolio_entries` and on the `portfolio` storage bucket) — both mirror the existing admin-UPDATE / admin-SELECT policies already shipped for `decorator_profiles`/`contact_inquiries`, using the same `is_admin()` function. App-layer admin detection is a single middleware read of `user.app_metadata.role`, exposed as `context.locals.isAdmin`, fail-closed (absent/ambiguous → `false`). The moderation queue reuses the direct-SSR-load pattern from `dashboard/portfolio.astro` / `dashboard/inquiries.astro` (no new list API), joined with `decorator_profiles.company_name` for context. Approve/Reject is one small `PATCH /api/admin/portfolio/[id]` endpoint plus a new `ModerationQueue.tsx` React island (interactivity needed for optimistic remove-from-list on action, same shape as `PortfolioPanel.tsx`'s delete flow).

## Critical Implementation Details

**Admin flag is fail-closed:** `context.locals.isAdmin` must default to `false` whenever `context.locals.user` is `null`, `supabase` is unavailable, or `app_metadata.role` is anything other than exactly `"admin"`. Never infer admin from the absence of an error. This is a security boundary, not a convenience flag (per Q11).

**Two independent gates, both required:** the moderation page/API check `locals.isAdmin` (fast, app-layer UX gate — redirect/403 without an extra round trip) AND the underlying Supabase queries still run through the request-scoped anon/cookie client, so RLS (`is_admin()`) is the real backstop if the app-layer check is ever bypassed or buggy. Never use a service-role key to skip RLS for the admin queue.

**Admin-role JWT staleness:** `locals.isAdmin` (app layer) comes from `getUser()`, which always reflects the current `raw_app_meta_data` row. RLS's `is_admin()` (DB layer) reads `auth.jwt()`, which is only as fresh as the session's last token mint/refresh. If `app_metadata.role` is assigned to a user with an already-live session, the app will show admin UI immediately while DB calls still get RLS-denied until the token refreshes. Not a security gap (fail-closed direction preserved) — but sign out and back in after assigning the admin role, before testing the queue, or the manual verification below will show confusing false negatives.

## Phase 1: RLS gap fix + admin detection

### Overview

Close the two DB-layer gaps (admin SELECT on portfolio rows and on their storage objects) and wire app-layer admin detection through the middleware, fail-closed.

### Changes Required:

#### 1. Migration: admin SELECT policies

**File**: `supabase/migrations/20260807010000_admin_moderation_rls.sql`

**Intent**: Let an admin session read any portfolio entry (any `moderation_status`) and sign URLs for any portfolio storage object, mirroring the existing `is_admin()`-gated admin policies on `decorator_profiles`/`contact_inquiries`.

**Contract**: Two `CREATE POLICY` statements: `portfolio_entries_select_admin` (SELECT, `authenticated`, `USING (is_admin())`) on `public.portfolio_entries`; `portfolio_select_admin` (SELECT, `authenticated`, `USING (bucket_id = 'portfolio' AND is_admin())`) on `storage.objects`. No changes to existing policies, no new columns, no enum changes. Note: neither the `portfolio` bucket nor the sibling `profiles` bucket (`20260715010000_profiles_storage.sql`) has an existing admin-wide storage policy — this is the first one in the repo, not a mirrored pattern; it's still consistent with the `is_admin()`-gated approach already used at the table-RLS layer.

#### 2. Admin detection

**File**: `src/env.d.ts`

**Intent**: Add `isAdmin: boolean` to `App.Locals` alongside the existing `user` field.

**Contract**: `interface Locals { user: ...; isAdmin: boolean; }`.

**File**: `src/middleware.ts`

**Intent**: Derive `context.locals.isAdmin` from the same `user` object already fetched for `context.locals.user`, fail-closed.

**Contract**: `context.locals.isAdmin = context.locals.user?.app_metadata?.role === "admin"`. No new Supabase call — reuses the `getUser()` result already in scope. `PROTECTED_ROUTES` stays `["/dashboard"]` (moderation lives inside `/dashboard`, not a separate protected prefix).

**File**: `src/lib/api-auth.ts` (+ `*.test.ts`)

**Intent**: Add a `requireAdmin` helper matching the shape of `requireAuth`/`requireDecoratorProfile`, for the Phase 2 API route.

**Contract**: `requireAdmin(context)` calls `requireAuth(context)` first; if that fails, propagate its error. Otherwise check `auth.user.app_metadata?.role === "admin"`; if not, return `{ error: jsonError("ADMIN_REQUIRED", "Admin access required", 403) }`. On success, return `{ supabase, user }` (same shape as `requireAuth`'s success branch) so call sites compose identically to the existing helpers.

### Success Criteria:

#### Automated Verification:

- Unit tests for `requireAdmin` pass: `npm test -- --run src/lib/api-auth.test.ts`
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- With a non-admin session, `context.locals.isAdmin` is `false` (verify via a temporary log or the Phase 2 UI once built)
- Assign `app_metadata: {"role":"admin"}` to a test user in the local Supabase dashboard; confirm `is_admin()` returns `true` for that session via `select is_admin();` in a `psql` session authenticated as that user, or via the Phase 2 UI once built
- Admin session can `select * from portfolio_entries where moderation_status = 'pending';` via the anon/cookie-scoped client (confirms the new RLS policy); non-admin session querying the same gets zero rows for entries that aren't their own

**Implementation Note**: Pause for human confirmation of manual checks before Phase 2.

---

## Phase 2: Admin moderation UI + API

### Overview

Build the moderation queue: an admin-only SSR section inside `/dashboard` listing pending portfolio entries, with Approve/Reject actions wired to a new API route.

### Changes Required:

#### 1. Approve/Reject API

**File**: `src/pages/api/admin/portfolio/[id].ts` (+ `*.test.ts`)

**Intent**: Let an admin flip one portfolio entry's `moderation_status`.

**Contract**: `export const prerender = false; export const PATCH: APIRoute`. Body `{ moderation_status: "approved" | "rejected" }` (reuse the existing `ModerationStatus` type from `src/types.ts`, no new zod schema needed for a two-value literal — validate with a plain `Array.includes` check, `jsonError("VALIDATION_FAILED", ...)` on anything else). Auth via the new `requireAdmin` (Phase 1). Update by `id` with `.select().single()`-free plain update (mirror `api/portfolio/[id].ts`'s error handling: `jsonError("MODERATION_UPDATE_FAILED", ..., 500)` on DB error, `jsonError("PORTFOLIO_NOT_FOUND", ..., 404)` if no row matched). Return `{ entry: { id, moderation_status } }`.

#### 2. Moderation queue island

**File**: `src/components/admin/ModerationQueue.tsx`

**Intent**: Render the pending-entries list with Approve/Reject buttons; on action, `PATCH` the API and remove the entry from the local list (queue empties as items are actioned — no need to re-fetch or show post-action status since it's leaving the `pending` view).

**Contract**: Props: `initialEntries: (PortfolioEntry & { image_url: string | null; companyName: string })[]`. Default export (top-level island, mounted directly from the dashboard page). Mirrors `PortfolioPanel.tsx`'s `useState` + `fetch` + optimistic-list-update shape; reuse `Button`/`ServerError` from existing component library.

#### 3. Wire into `/dashboard`

**File**: `src/pages/dashboard.astro`

**Intent**: When `Astro.locals.isAdmin` is true, SSR-load pending portfolio entries (joined with `decorator_profiles.company_name`) and render a "Moderation" section above (or alongside) the existing profile/portfolio/inquiries cards, mounting `ModerationQueue` with `client:only="react"` (matches `PortfolioPanel.tsx`'s mount strategy in `dashboard/portfolio.astro` — same shape: SSR-fetched signed image URLs + optimistic local-state actions). Non-admins see the page exactly as today — this section renders nothing.

**Contract**: Query: `portfolio_entries` where `moderation_status = 'pending'`, order `created_at` desc, limit 50. No file in this codebase uses Supabase's embedded-relation select syntax (`select("*, table(...)")`) — do a second plain query keyed by the distinct `decorator_profile_id`s from the first result to batch-fetch `decorator_profiles(id, company_name)`. Resolve image URLs via the existing `resolvePortfolioEntriesImages`.

**File**: `src/layouts/DashboardLayout.astro`

**Intent**: No nav item is added (moderation lives on the `/dashboard` hub page itself per Q5/Q9, not a separate route) — this file is listed for completeness only; skip if no change is needed. If the section warrants deep-linking later, revisit in a follow-up.

### Success Criteria:

#### Automated Verification:

- Mocked API handler unit tests pass: `npm test -- --run src/pages/api/admin/portfolio/[id].test.ts`
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Admin session sees the Moderation section on `/dashboard` with a seeded `pending` entry; non-admin session does not see the section at all
- Approve removes the entry from the queue and it becomes visible on the decorator's public profile (if published)
- Reject removes the entry from the queue and it stays hidden from the public profile
- Non-admin `curl PATCH /api/admin/portfolio/<id>` gets a 401/403, not a 500

**Implementation Note**: Pause for human confirmation of manual checks before Phase 3.

---

## Phase 3: Decorator-facing status badge

### Overview

Show the decorator their own entries' moderation status on `/dashboard/portfolio`, so a rejected entry doesn't look like a silent bug.

### Changes Required:

#### 1. Badge in the existing panel

**File**: `src/components/decorator/PortfolioPanel.tsx`

**Intent**: Render a small status badge (Approved / Pending / Rejected) next to each entry, using the `moderation_status` field already present on `PortfolioEntryView` (it flows through from `PortfolioEntry` — confirm the type already carries it before adding new plumbing).

**Contract**: Three-way badge styling (e.g. emerald/approved, amber/pending, red/rejected) consistent with the existing status-coloring pattern used in `dashboard.astro`'s profile-published/draft sections. No new props needed if `moderation_status` is already on the entry shape passed in from `dashboard/portfolio.astro`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- A decorator with a `pending`, an `approved`, and a `rejected` entry sees three distinct badges on `/dashboard/portfolio`

**Implementation Note**: Pause for human confirmation of manual checks before Phase 4.

---

## Phase 4: Verify end-to-end

### Overview

Close automated gates and run the full manual moderation funnel + access-control smoke.

### Changes Required:

#### 1. Regression pass

**File**: existing tests under `src/lib/*.test.ts`, `src/pages/api/**/*.test.ts`

**Intent**: Confirm nothing in Phases 1-3 broke prior slices' tests.

### Success Criteria:

#### Automated Verification:

- `npm test` (full suite) passes
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Full funnel: decorator's pending entry → admin queue → approve → visible on public profile → decorator sees Approved badge
- Full funnel: approved entry → admin rejects → disappears from public profile → decorator sees Rejected badge
- Non-admin cannot see the Moderation section, cannot load `/api/admin/portfolio/<id>` successfully, and a direct Supabase query for other decorators' non-approved rows returns nothing (RLS still the backstop)
- Admin account with no `decorator_profiles` row of its own can still access and use the moderation queue (per Q9)

---

## Testing Strategy

### Unit Tests:

- `requireAdmin` — admin user passes; non-admin user gets 403; unauthenticated gets 401 (delegates to `requireAuth`)
- `PATCH /api/admin/portfolio/[id]` handler with mocked Supabase — valid approve, valid reject, invalid status value, not-found id, non-admin caller

### Integration Tests:

- Not required in CI for S-04; manual RLS smoke (Phase 1 + Phase 4) covers the DB boundary, consistent with S-02/S-03 precedent

### Manual Testing Steps:

1. In local Supabase Studio, set a test user's `app_metadata` to `{"role":"admin"}`. If that user already has a live session, sign out and back in now — the DB-side RLS check reads the JWT, which only picks up the new role on re-login.
2. Seed one `pending` portfolio entry for a different (non-admin) decorator
3. Sign in as admin → `/dashboard` → see Moderation section with the seeded entry → Approve
4. Sign in as the entry's owning decorator → `/dashboard/portfolio` → confirm Approved badge; confirm entry now shows on `/d/{their-id}` if published
5. Sign in as admin again → reject the same entry → confirm it disappears from the public profile and the decorator sees a Rejected badge
6. Sign in as a non-admin decorator → confirm no Moderation section on `/dashboard`; `curl` the PATCH endpoint directly → expect 401/403

## Performance Considerations

- Queue capped at 50 pending entries, matching the existing `portfolio`/`inquiries` list caps — acceptable for MVP moderation volume.
- Batch-fetching `decorator_profiles.company_name` per queue load is a second bounded query (≤50 ids), not N+1 per row.

## Migration Notes

- New migration `20260807010000_admin_moderation_rls.sql` is additive-only (two new SELECT policies); no data backfill, no column changes, no default changes.

## References

- PRD: `context/foundation/prd.md` (FR-008)
- Roadmap: `context/foundation/roadmap.md` S-04
- Schema/RLS: `supabase/migrations/20260620120000_domain_schema.sql`, `20260620130000_domain_rls.sql`, `20260716010000_portfolio_storage.sql`
- Prior slices: `context/changes/domain-schema-foundation/`, `context/changes/decorator-onboarding/`
- Admin role doc: `README.md` § "Admin role (FR-008 hook)"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: RLS gap fix + admin detection

#### Automated

- [x] 1.1 Unit tests for `requireAdmin` pass
- [x] 1.2 `npm run lint` passes
- [x] 1.3 `npm run build` passes

#### Manual

- [x] 1.4 `isAdmin` fail-closed for non-admin/unauthenticated sessions
- [x] 1.5 `is_admin()` returns true for an assigned admin user
- [x] 1.6 Admin RLS SELECT on `portfolio_entries` works; non-admin still scoped to own rows

### Phase 2: Admin moderation UI + API

#### Automated

- [ ] 2.1 Mocked API handler unit tests pass
- [ ] 2.2 `npm run lint` passes
- [ ] 2.3 `npm run build` passes

#### Manual

- [ ] 2.4 Moderation section visible only to admin; queue shows seeded pending entry
- [ ] 2.5 Approve updates status and entry becomes visible on public profile
- [ ] 2.6 Reject updates status and entry stays hidden from public profile
- [ ] 2.7 Non-admin PATCH to admin API is rejected (401/403)

### Phase 3: Decorator-facing status badge

#### Automated

- [ ] 3.1 `npm run lint` passes
- [ ] 3.2 `npm run build` passes

#### Manual

- [ ] 3.3 Badge shows correct state for pending/approved/rejected entries

### Phase 4: Verify end-to-end

#### Automated

- [ ] 4.1 `npm test` (full suite) passes
- [ ] 4.2 `npm run lint` passes
- [ ] 4.3 `npm run build` passes

#### Manual

- [ ] 4.4 Full approve funnel (queue → public profile → badge)
- [ ] 4.5 Full reject funnel (public profile removal → badge)
- [ ] 4.6 Non-admin access denied at UI, API, and RLS layers
- [ ] 4.7 Admin without own decorator profile can moderate
