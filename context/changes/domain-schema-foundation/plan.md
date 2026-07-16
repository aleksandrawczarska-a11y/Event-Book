# Minimal Domain Schema Implementation Plan

## Overview

Create the minimal Supabase schema (tables, RLS, storage) for EventBook marketplace lead-gen: decorator profiles, portfolio entries, and contact inquiries. This is roadmap **F-01** (`domain-schema-foundation`) — a foundation change with no application UI/API. It unblocks `decorator-onboarding`, `client-discovery`, and `contact-lead-flow`.

## Current State Analysis

- **Auth:** Supabase SSR client in `src/lib/supabase.ts`; middleware sets `context.locals.user` and protects `/dashboard` (`src/middleware.ts`).
- **Data:** No `supabase/migrations/` directory; `supabase/config.toml` has migrations enabled but `schema_paths = []`; referenced `seed.sql` missing.
- **App queries:** No `.from()` domain queries — auth only (`signUp`, `signInWithPassword`, `getUser`).
- **README:** Still states no database tables required (`README.md` ~L114) — must update after this change.

### Key Discoveries:

- `createClient()` must remain the only Supabase entry point per `AGENTS.md`.
- PRD requires anonymous client read/search + inquiry insert; decorator CRUD on own profile/portfolio; admin moderation (FR-008) deferred in app but schema should support it.
- Roadmap `main_goal: speed` favors post-moderation defaults and free-text filter arrays over normalized taxonomy tables.

## Desired End State

After this plan:

1. Migration files exist under `supabase/migrations/`.
2. Tables `decorator_profiles`, `portfolio_entries`, `contact_inquiries` are queryable with appropriate indexes.
3. RLS enforces role boundaries (decorator / anon / admin).
4. Storage bucket `portfolio` exists with policies scoped to owning dekorator.
5. Optional `supabase/seed.sql` provides one dev profile for manual smoke tests.
6. README documents how to apply migrations locally and to remote Supabase.

### Verification

- `npx supabase db reset` succeeds locally.
- SQL smoke script (documented in Phase 4) confirms RLS behavior for three roles.
- `npm run build` still passes (no app breakage).

## What We're NOT Doing

- Astro pages, API routes, or React forms (S-01+).
- Generated TypeScript types (`database.types.ts`) — optional follow-up in S-01.
- Email sending for inquiries (S-03).
- Admin moderation UI (S-04).
- Normalized lookup tables for cities, event types, or styles.
- GitHub Actions migration automation.
- Changing auth provider or middleware behavior.

## Implementation Approach

One ordered migration file (or two if RLS section is easier to review split) following Supabase CLI conventions. Use SQL helper functions for RLS readability. Keep column set aligned to FR-002, FR-003, FR-004, FR-006 field lists — no speculative columns.

## Critical Implementation Details

**RLS and anon access:** Anonymous clients use the publishable key without a JWT. Public SELECT policies must reference `is_published = true` on profiles and `moderation_status = 'approved'` on portfolio. INSERT on `contact_inquiries` must validate that `decorator_profile_id` points to a published profile — use a CHECK via trigger or policy subquery to prevent spam to draft profiles.

**Admin role:** Policies reference `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`. Document in README that admin assignment is manual via Supabase Dashboard → Authentication → Users → Edit user → `app_metadata: {"role":"admin"}`.

## Phase 1: Core schema migration

### Overview

Create enums, tables, foreign keys, indexes, and `updated_at` maintenance.

### Changes Required:

#### 1. Initial migration file

**File**: `supabase/migrations/<timestamp>_domain_schema.sql`

**Intent**: Define the three domain entities and supporting enum for moderation status.

**Contract**:

- Enum `moderation_status`: `pending`, `approved`, `rejected`.
- Table `decorator_profiles`:
  - `id` uuid PK default `gen_random_uuid()`
  - `user_id` uuid UNIQUE NOT NULL references `auth.users(id)` ON DELETE CASCADE
  - `company_name` text NOT NULL
  - `profile_photo_url` text
  - `description` text
  - `city` text NOT NULL
  - `instagram_url` text
  - `contact_email` text
  - `contact_phone` text
  - `event_types` text[] NOT NULL DEFAULT `'{}'`
  - `decoration_styles` text[] NOT NULL DEFAULT `'{}'`
  - `is_published` boolean NOT NULL DEFAULT false
  - `created_at`, `updated_at` timestamptz NOT NULL DEFAULT now()
- Table `portfolio_entries`:
  - `id` uuid PK
  - `decorator_profile_id` uuid NOT NULL references `decorator_profiles(id)` ON DELETE CASCADE
  - `storage_path` text NOT NULL
  - `event_description` text
  - `decoration_style` text
  - `location` text
  - `tags` text[] NOT NULL DEFAULT `'{}'`
  - `moderation_status` moderation_status NOT NULL DEFAULT `'approved'`
  - `created_at` timestamptz NOT NULL DEFAULT now()
- Table `contact_inquiries`:
  - `id` uuid PK
  - `decorator_profile_id` uuid NOT NULL references `decorator_profiles(id)` ON DELETE CASCADE
  - `client_name` text NOT NULL
  - `client_email` text NOT NULL
  - `client_phone` text
  - `event_date` date NOT NULL
  - `needs_description` text NOT NULL
  - `created_at` timestamptz NOT NULL DEFAULT now()
- Indexes:
  - `decorator_profiles(city)`
  - GIN on `decorator_profiles(event_types)`, `decorator_profiles(decoration_styles)`
  - `portfolio_entries(decorator_profile_id)`
  - `contact_inquiries(decorator_profile_id, created_at DESC)`
- Trigger function `set_updated_at()` + trigger on `decorator_profiles` BEFORE UPDATE.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` completes without SQL errors
- `\dt public.*` shows three new tables (via `supabase db execute` or psql)

#### Manual Verification:

- Inspect migration SQL for FR-002/003/004/006 field coverage against PRD

**Implementation Note**: Pause for human confirmation after automated checks before Phase 2.

---

## Phase 2: Row Level Security

### Overview

Enable RLS and add policies for decorator, anonymous, and admin access patterns.

### Changes Required:

#### 1. Helper functions

**File**: same migration file (section after tables) or `supabase/migrations/<timestamp>_domain_rls.sql`

**Intent**: Centralize role checks used in policies.

**Contract**:

- `public.is_admin()` returns boolean from JWT `app_metadata.role`.
- `public.current_decorator_profile_id()` returns uuid for `auth.uid()` or NULL.

#### 2. RLS policies

**Intent**: Enforce PRD Access Control at the database layer.

**Contract**:

| Table | Role | Operations |
| --- | --- | --- |
| `decorator_profiles` | Decorator (owner) | SELECT/INSERT/UPDATE own row |
| `decorator_profiles` | Anon | SELECT where `is_published = true` |
| `decorator_profiles` | Admin | SELECT all; UPDATE moderation-related fields if needed later |
| `portfolio_entries` | Decorator (owner) | CRUD on rows linked to own profile |
| `portfolio_entries` | Anon | SELECT where parent profile published AND `moderation_status = 'approved'` |
| `portfolio_entries` | Admin | UPDATE `moderation_status` on any row |
| `contact_inquiries` | Decorator (owner) | SELECT inquiries for own profile |
| `contact_inquiries` | Anon | INSERT where target profile is published |
| `contact_inquiries` | Admin | SELECT all (optional, for support) |

Enable RLS on all three tables. Default deny — no policy without explicit grant.

### Success Criteria:

#### Automated Verification:

- Documented SQL smoke script in `context/changes/domain-schema-foundation/verification.sql` runs under `supabase db reset` test harness

#### Manual Verification:

- Confirm anon cannot SELECT unpublished profiles
- Confirm decorator A cannot read decorator B inquiries

**Implementation Note**: Pause for human confirmation after RLS smoke tests.

---

## Phase 3: Storage bucket

### Overview

Add Supabase Storage bucket for portfolio photos referenced by `portfolio_entries.storage_path`.

### Changes Required:

#### 1. Bucket migration

**File**: `supabase/migrations/<timestamp>_portfolio_storage.sql`

**Intent**: Create private-by-default bucket with scoped access.

**Contract**:

- Bucket id: `portfolio`, public: false (signed URLs or authenticated read for approved assets — use authenticated read for owner, public read for approved entries via policy on `storage.objects`).
- Object path pattern: `{auth.uid()}/{portfolio_entry_id}/{filename}`.
- Policies:
  - Decorator INSERT/UPDATE/DELETE own prefix (`auth.uid()` matches first folder segment).
  - Anon SELECT objects where linked `portfolio_entries.storage_path` matches and entry is approved + profile published (via join subquery or storage folder convention documented for S-01).

**Note:** Keep storage policies as simple as owner-scoped upload in this foundation; public gallery URLs can be refined in S-02 if signed URLs are preferred.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` includes storage policy migration without error

#### Manual Verification:

- Upload test file as decorator user via Supabase dashboard or CLI
- Verify second user cannot delete first user's object

---

## Phase 4: Seed, docs, and remote apply

### Overview

Dev seed data, README update, remote migration push, and handoff to S-01.

### Changes Required:

#### 1. Seed file

**File**: `supabase/seed.sql`

**Intent**: Optional dev fixture — commented instructions if no stable test user UUID.

**Contract**: Either skip seed (document manual profile creation after signup) OR seed with placeholder comment block explaining post-signup insert steps.

#### 2. README update

**File**: `README.md`

**Intent**: Replace "no database tables required" with migration workflow.

**Contract**: Document `npx supabase db reset`, `npx supabase db push`, admin role assignment, link to `plan-brief.md`.

#### 3. Remote apply

**Intent**: Apply migrations to hosted Supabase project used by production Worker.

**Contract**: Run `npx supabase link` (if not linked) and `npx supabase db push` against project `fdabbrkiwajpogvzrxhh` (from existing `.env` — do not commit secrets).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Remote Supabase Table Editor shows three tables
- Assign test admin via dashboard; verify admin policy with smoke SQL on remote (optional)

---

## Testing Strategy

### Unit Tests:

- None in this change (SQL-only). Optional future: pgTAP if team adopts it — out of scope.

### Integration Tests:

- `verification.sql` acts as integration smoke for RLS (run manually or via script).

### Manual Testing Steps:

1. `npx supabase start` → `npx supabase db reset`
2. Create two auth users via app signup
3. Insert profile for user A; confirm user B cannot read unpublished profile
4. Publish profile; confirm anon SELECT works via SQL role simulation
5. Insert inquiry as anon; confirm decorator A sees it, B does not
6. Set user C as admin; confirm moderation_status UPDATE on portfolio entry

## Performance Considerations

- GIN indexes on array filter columns sufficient for MVP small scale.
- `max_rows = 1000` in `config.toml` already caps API payloads.

## Migration Notes

- First migration in repo — no backfill needed.
- Rollback: `supabase migration repair` / revert migration file and reset — document in change notes if push fails.

## References

- Roadmap F-01: `context/foundation/roadmap.md`
- PRD Access Control & Business Logic: `context/foundation/prd.md`
- Supabase client: `src/lib/supabase.ts`
- AGENTS.md — Supabase client rules

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Core schema migration

#### Automated

- [x] 1.1 `npx supabase db reset` completes without SQL errors — a609e58
- [x] 1.2 Three domain tables visible after reset — a609e58

#### Manual

- [x] 1.3 Migration fields cover FR-002/003/004/006 requirements — a609e58

### Phase 2: Row Level Security

#### Automated

- [x] 2.1 RLS migration applies cleanly on db reset
- [x] 2.2 `verification.sql` smoke script passes locally

#### Manual

- [ ] 2.3 Anon cannot read unpublished profiles
- [ ] 2.4 Cross-decorator inquiry isolation confirmed

### Phase 3: Storage bucket

#### Automated

- [x] 3.1 Storage migration applies cleanly on db reset — afd7830

#### Manual

- [x] 3.2 Decorator upload scoped to own folder — afd7830
- [x] 3.3 Cross-user storage delete blocked — afd7830

### Phase 4: Seed, docs, and remote apply

#### Automated

- [x] 4.1 `npm run lint` passes — 6db71a1
- [x] 4.2 `npm run build` passes — 6db71a1

#### Manual

- [x] 4.3 README migration docs updated — 6db71a1
- [x] 4.4 Remote Supabase shows new tables after `db push` — 6db71a1
