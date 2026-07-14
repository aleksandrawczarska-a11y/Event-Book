# Decorator Onboarding — Plan Brief

> Full plan: `context/changes/decorator-onboarding/plan.md`
> Roadmap: `context/foundation/roadmap.md` (S-01)
> Prerequisite: `context/changes/domain-schema-foundation/plan.md` (F-01 Phases 1–3)

## What & Why

EventBook needs a decorator supply side before client discovery (S-02). This slice wires existing auth to the F-01 domain schema so a dekorator can complete a public profile, upload a profile photo, and add portfolio entries with photos — covering FR-001, FR-002, and FR-003.

## Starting Point

Auth works end-to-end (signup, signin, middleware, stub `/dashboard`). Domain tables and RLS exist (`decorator_profiles`, `portfolio_entries`). No app code queries domain tables, no decorator UI/API, no storage buckets in migrations yet (F-01 Phase 3 pending). Zod is not installed.

## Desired End State

An authenticated dekorator lands on a dashboard hub, edits profile at `/dashboard/profile` (with publish toggle requiring `company_name`, `city`, `description`, `contact_email`), uploads an avatar to a `profiles` bucket, and manages portfolio at `/dashboard/portfolio` with photo upload to the F-01 `portfolio` bucket. Published profiles are visible to anon per existing RLS.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Publish required fields | `company_name`, `city`, `description`, `contact_email` | Enough for a credible public profile without blocking MVP speed | Plan |
| Profile photo | Upload to dedicated `profiles` bucket (`{user_id}/avatar.{ext}`) | Matches portfolio upload pattern; keeps avatars separate from gallery assets | Plan |
| Panel UX | Dashboard hub + `/dashboard/profile` + `/dashboard/portfolio` | Clear nav for non-dev stakeholders; room to add inquiries in S-03 | Plan |
| Post-login flow | Hub with CTA when profile incomplete — no forced redirect | Less friction than gate; decorator chooses when to complete profile | Plan |
| Filter taxonomy | Predefined picklists for `event_types` / `decoration_styles` | Consistent filters for S-02 without normalized DB tables | Plan |
| Portfolio create | Photo required; metadata optional | Fast onboarding per NFR; aligns with MVP validation surface | Plan |
| F-01 portfolio bucket | Hard prerequisite — not implemented in S-01 | S-01 Phase 5 only wires app upload; bucket migration stays in F-01 | Plan |
| New JSON APIs | Structured `{ error: { code, message, context } }` + zod | First domain APIs; follows `api-error-format.mdc` | Plan |

## Scope

**In scope:** `src/types.ts`, dashboard shell/nav, profile CRUD API + UI, `profiles` storage bucket migration, portfolio CRUD API + UI, portfolio photo upload (after F-01 Phase 3), predefined MVP picklists, publish validation.

**Out of scope:** Client search (S-02), contact form / inquiries panel (S-03), admin moderation UI (S-04), inquiry email delivery, generated Supabase TypeScript types (optional follow-up), profile delete/teardown, OAuth.

## Architecture / Approach

Astro SSR pages under `/dashboard/*` fetch domain data server-side via `createClient()`. Interactive forms are React islands posting to new JSON API routes in `src/pages/api/`. Profile row is created on first save (INSERT) or lazily when decorator opens profile page. Storage uploads go through server API routes that write to Supabase Storage then persist `profile_photo_url` / `portfolio_entries.storage_path`.

```
auth.users ──► decorator_profiles ◄── ProfileForm (/dashboard/profile)
                      │
                      └──► portfolio_entries ◄── PortfolioForm (/dashboard/portfolio)
                                    │
storage.profiles ◄── avatar upload    storage.portfolio ◄── gallery upload (F-01)
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Types & dashboard shell | Shared types, nav, hub CTA | Dashboard layout drift from existing cosmic theme |
| 2. Profile CRUD | API + profile page + publish rules | RLS INSERT fails if `user_id` mismatch |
| 3. Profile photo storage | `profiles` bucket + avatar upload | New bucket policies; separate from F-01 portfolio bucket |
| 4. Portfolio CRUD | List/add/delete entries (metadata) | Profile must exist before portfolio INSERT |
| 5. Portfolio photo upload | Wire `storage_path` via F-01 `portfolio` bucket | **Blocked until F-01 Phase 3 lands** |

**Prerequisites:** F-01 Phases 1–2 applied locally; **F-01 Phase 3 (`portfolio` bucket) complete before Phase 5.**
**Estimated effort:** ~3–4 focused sessions across 5 phases.

## Open Risks & Assumptions

- F-01 Phase 3 not done → Phases 1–4 can proceed; Phase 5 is blocked.
- Predefined picklist values are hardcoded in `src/lib/decorator-taxonomy.ts` — changing them later does not migrate existing array data.
- `moderation_status` defaults to `approved` (post-moderation); S-04 may add admin reject without schema change.
- Cloudflare Workers body size limits may affect large image uploads — keep client-side size cap (e.g. 5 MB).

## Success Criteria (Summary)

- Dekorator can sign up, complete profile, publish it, upload avatar, and add at least one portfolio photo.
- Unpublished profile is not visible to anon; published profile + approved portfolio entry is (RLS smoke).
- `npm run lint` and `npm run build` pass after each phase.
