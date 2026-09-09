# Admin Portfolio Moderation — Plan Brief

> Full plan: `context/changes/admin-moderation/plan.md`

## What & Why

Roadmap S-04 (PRD FR-008): an administrator can manually approve or reject decorator portfolio photos. Today the DB layer half-exists (an `is_admin()` function and a `moderation_status` enum shipped with F-01) but nothing in the app lets an admin actually see or act on pending content, and admins can't even read other decorators' non-approved rows or storage objects yet.

## Starting Point

`portfolio_entries.moderation_status` defaults to `approved` (post-publish moderation already in effect); the public profile already filters to `approved` only. Admin RLS exists for `decorator_profiles` and `contact_inquiries`, but not for `portfolio_entries` or the `portfolio` storage bucket — that's the gap this plan closes, plus building the actual UI.

## Desired End State

An admin sees a "Moderation" section on `/dashboard` listing pending portfolio entries with Approve/Reject buttons. A decorator sees a status badge on their own portfolio entries so a rejection isn't a silent mystery. Non-admins can't reach any of it — at the UI, API, and RLS layers.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope | Portfolio only | Matches FR-008 exactly; profiles/inquiries moderation would need new schema and is out of scope | Plan |
| Timing | Post-publish (default stays `approved`) | Zero changes to publish flow; matches the F-01 decision already shipped | Plan |
| "Hide" semantics | Reuse `rejected` | No migration needed; RLS already excludes non-approved from public view | Plan |
| Admin detection | Middleware sets `locals.isAdmin` from `app_metadata.role` | One source of truth, mirrors the JWT claim `is_admin()` already checks in RLS | Plan |
| UI location | Inside `/dashboard`, admin-only section (no `/admin` route) | Less new routing; admin doesn't need to be a decorator | Plan |
| Default queue | `pending` only | Admin sees exactly what needs action, no noise | Plan |
| Action | Approve/Reject, reversible | Simple, symmetric, matches the 3-value enum | Plan |
| Decorator visibility | Status badge on `/dashboard/portfolio` | Prevents "is this a bug?" confusion when an entry disappears | Plan |
| Fail mode | Fail-closed on ambiguous admin session | Security boundary — never fail-open | Plan |
| Priority cut | No counter, bulk actions, or reject-reason field | Keeps the slice thin per the "speed" north star | Plan |

## Scope

**In scope:** Admin SELECT RLS fix (table + storage), `locals.isAdmin` + `requireAdmin`, moderation queue UI + PATCH API, decorator status badge, full access-control verification.

**Out of scope:** Profile/inquiry moderation, pre-publish flow, new enum values, `/admin` route, rejection reasons, notifications, pending-count nav badge, bulk actions.

## Architecture / Approach

Two additive RLS policies (mirroring the existing `decorator_profiles`/`contact_inquiries` admin policies) close the DB gap. Middleware exposes `isAdmin` as a fast app-layer gate; RLS stays the real backstop — no service-role key involved. The queue reuses the direct-SSR-load pattern already established for `dashboard/portfolio.astro`/`dashboard/inquiries.astro`, with one new React island (`ModerationQueue.tsx`) for the Approve/Reject interactivity, and one new API route (`PATCH /api/admin/portfolio/[id]`).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. RLS gap fix + admin detection | Admin can read any portfolio row/photo; `isAdmin` flag wired, fail-closed | Getting the fail-closed default wrong would be a real security bug |
| 2. Admin moderation UI + API | Working approve/reject queue on `/dashboard` | Storage RLS gap (Phase 1) must land first or images won't load |
| 3. Decorator-facing status badge | Decorator sees why an entry vanished | Low risk — pure display change |
| 4. Verify end-to-end | Full funnel + access-control smoke confirmed | None beyond normal regression risk |

**Prerequisites:** S-01 (done); F-01 admin/RLS foundation (done).
**Estimated effort:** ~1-2 sessions across 4 phases.

## Open Risks & Assumptions

- Assumes `supabase.auth.getUser()` reliably returns `app_metadata` server-side (already relied upon implicitly by `is_admin()` in RLS) — Phase 1 manual verification confirms this empirically.
- Assumes no other slice needs an `/admin` route soon; if profile/inquiry moderation is added later, the "inside `/dashboard`" choice may need revisiting.

## Success Criteria (Summary)

- Admin can see and moderate pending portfolio entries; decorators see the outcome.
- Non-admins are blocked at every layer (UI, API, RLS) — verified, not assumed.
- No regression in existing portfolio/profile/inquiry flows.
