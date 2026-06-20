# Minimal Domain Schema — Plan Brief

> Full plan: `context/changes/domain-schema-foundation/plan.md`
> Roadmap: `context/foundation/roadmap.md` (F-01)

## What & Why

EventBook needs a minimal Supabase data layer before any vertical slice (profile, search, lead form) can ship. This change adds tables, RLS, and a storage bucket so dekoratorzy, anonimowi klienci, and (later) admini have clear data boundaries aligned with PRD Access Control and Business Logic.

## Starting Point

Supabase Auth works (`auth.users`, SSR client, middleware). There are no migrations, domain tables, storage buckets, or seeds — only `supabase/config.toml`.

## Desired End State

Three domain tables exist with indexes and RLS: `decorator_profiles`, `portfolio_entries`, `contact_inquiries`. A `portfolio` storage bucket accepts decorator uploads. Policies allow: decorators to manage their own rows, anonymous users to read published profiles and approved portfolio + insert inquiries, admins to update moderation fields. Migrations apply cleanly locally and on the linked Supabase project.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Profile ↔ auth link | `decorator_profiles.user_id` → `auth.users` | One profile per authenticated dekorator; matches existing auth flow | Plan |
| Filter fields | `city`, `event_types[]`, `decoration_styles[]` on profile | Matches PRD search filters without a taxonomy table for MVP speed | Plan |
| Moderation model | `moderation_status` enum; default `approved`; public reads `approved` only | Post-moderation for speed; S-04 adds admin reject without blocking S-01/S-02 | Plan |
| Admin detection | JWT `app_metadata.role = 'admin'` | Minimal hook for FR-008; no admin UI in this change | Plan |
| Storage layout | Bucket `portfolio`, path `{user_id}/{entry_id}/{filename}` | Scoped uploads per dekorator; unlocks FR-003 photo uploads in S-01 | Plan |
| Scope boundary | SQL + storage only | Foundation contract from roadmap; app code in downstream slices | Roadmap |

## Scope

**In scope:** SQL migration(s), RLS policies, storage bucket + policies, optional dev seed, README note on applying migrations, verification steps.

**Out of scope:** Astro pages/API, TypeScript DB types, email delivery, admin UI, auto-moderation, CI migration automation, production data backfill.

## Architecture / Approach

Single initial migration creates enums/tables/indexes and helper SQL functions (`is_admin`, profile lookup). Second migration (or same file, ordered sections) adds RLS and storage policies. App continues using `createClient()` from `src/lib/supabase.ts`; downstream slices call `.from()` against the new tables.

```
auth.users ──1:1── decorator_profiles ──1:N── portfolio_entries
                              │
                              └──1:N── contact_inquiries

storage.portfolio ← portfolio_entries.storage_path
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Core schema | Tables, enums, indexes, `updated_at` trigger | Over-modeling beyond MVP filters |
| 2. RLS | Decorator / anon / admin policies | Misconfigured anon insert on inquiries |
| 3. Storage | Bucket + upload/read policies | Public URL leakage for non-approved assets |
| 4. Verify & apply | Local reset, remote push, smoke SQL | Remote drift if migration not pushed |

**Prerequisites:** Supabase project linked; `SUPABASE_URL` / `SUPABASE_KEY` configured locally.
**Estimated effort:** ~1–2 focused sessions across 4 phases.

## Open Risks & Assumptions

- Admin users must be assigned `app_metadata.role = 'admin'` manually in Supabase dashboard until S-04 builds tooling.
- Post-moderation default (`approved`) can be flipped to pre-moderation (`pending`) in S-04 without schema break.
- Filter values (`event_types`, `decoration_styles`) are free-text arrays, not normalized lookup tables — acceptable for MVP speed.

## Success Criteria (Summary)

- Migrations apply with `supabase db reset` locally without errors.
- RLS smoke tests pass for decorator, anon, and admin roles.
- Storage bucket accepts decorator upload and blocks cross-user access.
- Downstream `/10x-plan decorator-onboarding` can start without new foundation work.
