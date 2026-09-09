<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Admin Portfolio Moderation Implementation Plan

- **Plan**: context/changes/admin-moderation/plan.md
- **Mode**: Deep
- **Date**: 2026-08-10
- **Verdict**: SOUND (after triage)
- **Findings**: 1 critical, 3 warnings, 1 observation — all FIXED

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | FAIL |

## Grounding

Grounding: 8/8 paths ✓ (`src/middleware.ts`, `src/env.d.ts`, `src/lib/api-auth.ts`, `src/pages/api/portfolio/[id].ts`, `src/components/decorator/PortfolioPanel.tsx`, `src/pages/dashboard.astro`, `src/lib/storage-url.ts`, `supabase/migrations/20260716010000_portfolio_storage.sql`), 6/6 symbols ✓ (`requireAuth`, `requireDecoratorProfile`, `ModerationStatus`, `is_admin()` ×5 occurrences), brief↔plan ✓

## Findings

### F1 — Phase 2 Progress mismatch (4 Manual bullets, only 3 Progress rows)

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Manual Verification / `## Progress` → Phase 2 → Manual
- **Detail**: Phase 2's "Manual Verification" bullet list has 4 items (Moderation section visible only to admin; Approve→visible on public profile; Reject→stays hidden; non-admin PATCH rejected), but the `## Progress` section's Phase 2 Manual subsection only enumerates 3 rows (`2.4`, `2.5`, `2.6`). The mechanical Phase↔Progress contract requires one Progress row per Success Criteria bullet — `/10x-implement` follows Progress as the checklist, so the 4th criterion (Reject hides from public profile) has no checkbox to flip.
- **Fix**: Add a 4th Progress row so Phase 2 Manual reads `2.4` (moderation section visibility), `2.5` (approve→public), `2.6` (reject→hidden), `2.7` (non-admin PATCH rejected).
- **Decision**: FIXED — split into 2.4-2.7 in `plan.md`.

### F2 — Admin role JWT staleness can block Phase 2's own manual verification

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 / Phase 2 — Critical Implementation Details, Manual Verification
- **Detail**: `context.locals.isAdmin` (app layer) is derived from `getUser()`, which always reflects the current `raw_app_meta_data` row. RLS's `is_admin()` (DB layer) reads `auth.jwt() -> 'app_metadata'`, which is only as fresh as the session's last token mint/refresh. If a tester assigns `app_metadata.role = "admin"` to a user with an already-live session (the exact manual-testing sequence Phase 1/2 describe), the app will show the Moderation section immediately (`isAdmin: true`) while the PATCH/SELECT against the DB still gets RLS-denied until the token refreshes — a confusing false-negative during the plan's own manual verification, not a security hole (fail-closed direction is preserved, DB is just laggy-safe).
- **Fix**: Add one sentence to "Critical Implementation Details" noting this, and prepend a step to the Manual Testing Steps: "sign out and back in after assigning the admin role, before testing the queue" — this is a testing-sequence note, not a code change.
- **Decision**: FIXED — added to Critical Implementation Details and Manual Testing Steps step 1 in `plan.md`.

### F3 — Phase 2's `client:load` breaks from the established island-mounting convention

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — "Wire into `/dashboard`" Contract
- **Detail**: The plan specifies mounting `ModerationQueue` with `client:load`, but the one existing equivalent island in this codebase — `PortfolioPanel.tsx`, same shape (SSR-loaded list + signed image URLs + optimistic local-state actions) — is mounted with `client:only="react"` in `dashboard/portfolio.astro`. Introducing a second hydration strategy for the same kind of component, with no stated reason, is an unplanned pattern split.
- **Fix**: Use `client:only="react"` for `ModerationQueue`, matching `PortfolioPanel`'s convention.
- **Decision**: FIXED — `client:only="react"` in `plan.md`.

### F4 — Q3-style precedent citation for the batch-fetch pattern is inaccurate

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — "Wire into `/dashboard`" Contract
- **Detail**: The contract cites `dashboard/inquiries.astro` as demonstrating "the codebase's no-embedded-relations pattern" for batch-fetching `decorator_profiles.company_name` by id list. `inquiries.astro` actually does two sequential single-row queries (own profile, then own inquiries) — it never batch-fetches a related table by a list of ids from a prior query's results. There is no batch-by-id-list precedent anywhere in the codebase; the underlying decision (avoid embedded-relation selects, do a second plain query) is still correct on its own merits, just not evidenced by that file.
- **Fix**: Reword to "no file in this codebase uses Supabase's embedded-relation select syntax (`select("*, table(...)")`) — do a second plain query keyed by the distinct `decorator_profile_id`s from the first result" and drop the `inquiries.astro` citation.
- **Decision**: FIXED — reworded in `plan.md`, `inquiries.astro` citation removed.

### F5 — No existing precedent for an admin-wide storage SELECT policy

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 — Migration Contract
- **Detail**: The `profiles` storage bucket (`supabase/migrations/20260715010000_profiles_storage.sql`) has the same four owner-scoped policies as `portfolio` and no admin-wide SELECT policy — so `portfolio_select_admin` would be the first storage-layer admin policy in this repo, not a mirrored one. The design itself is sound (correctly omits the folder-prefix check, is gated by the same `is_admin()` used at the table-RLS layer), just worth knowing it's new ground rather than an established pattern.
- **Fix**: No action needed — noting for the implementer's awareness; the migration Contract text doesn't need to change.
- **Decision**: FIXED — note added to the migration Contract in `plan.md` for implementer awareness.

## Notes

- Grounding on `user.app_metadata` is solid: `getUser()`'s `User` type includes `app_metadata`, and it's a live DB read (not JWT-decoded), so it's actually *more* current than the RLS-side JWT claim — the one gap is captured in F2.
- `requireAdmin`'s planned addition to `src/lib/api-auth.ts` is purely additive; all 5 current callers of `requireAuth`/`requireDecoratorProfile` (`api/portfolio/index.ts`, `api/portfolio/upload.ts`, `api/portfolio/[id].ts`, `api/profile/index.ts`, `api/profile/avatar.ts`) are unaffected.
- No naming collision for the new `portfolio_entries_select_admin` policy; all existing migrations use plain `CREATE POLICY` (no `IF NOT EXISTS`) — the plan's new migration already matches this convention.
- End-state alignment and lean execution are both solid — every Desired End State claim has a backing phase, and no phase does more than the stated outcome requires.
