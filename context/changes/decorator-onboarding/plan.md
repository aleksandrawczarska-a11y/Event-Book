# Decorator Onboarding Implementation Plan

## Overview

Implement roadmap **S-01** (`decorator-onboarding`): wire existing Supabase auth to the F-01 domain schema so a dekorator can create/edit a public profile, upload a profile photo, and manage portfolio entries with photos. Covers PRD **FR-001** (already in baseline auth), **FR-002**, and **FR-003**.

## Current State Analysis

- **Auth:** Working SSR flow — `src/lib/supabase.ts`, `src/middleware.ts` (`PROTECTED_ROUTES = ["/dashboard"]`), `src/pages/api/auth/*`, React auth forms.
- **Dashboard:** Stub at `src/pages/dashboard.astro` — welcome message only; no domain data, no nav shell.
- **Domain schema:** `decorator_profiles` and `portfolio_entries` tables + owner RLS policies exist (F-01 Phases 1–2). `current_decorator_profile_id()` requires a profile row before portfolio INSERT.
- **Storage:** No bucket migrations on disk. F-01 Phase 3 (`portfolio` bucket) is **pending** — hard prerequisite for portfolio photo upload (Phase 5).
- **App queries:** Zero `.from()` domain queries in `src/`. No `src/types.ts`. Zod not in `package.json`.
- **API pattern:** Auth uses HTML form POST + redirect; new domain APIs should use JSON + structured errors per `.cursor/rules/api-error-format.mdc`.

### Key Discoveries:

- `createClient()` is the only Supabase entry point (`AGENTS.md`).
- Profile must exist before portfolio entries (`portfolio_entries_insert_own` uses `current_decorator_profile_id()`).
- `is_published` defaults `false` — draft profiles hidden from anon until publish.
- `profile_photo_url` is a text column — stores public/signed URL after upload, not raw file bytes.
- Reuse auth form primitives: `FormField`, `SubmitButton`, `ServerError` from `src/components/auth/`.

## Desired End State

After this plan:

1. Authenticated dekorator sees a dashboard hub with nav to Profile and Portfolio; incomplete profile shows a CTA (no forced redirect).
2. `/dashboard/profile` supports create/edit, predefined `event_types` / `decoration_styles` picklists, and publish toggle with validation (`company_name`, `city`, `description`, `contact_email` required when `is_published = true`).
3. Profile avatar uploads to Supabase Storage bucket `profiles` at `{user_id}/avatar.{ext}`; URL persisted in `profile_photo_url`.
4. `/dashboard/portfolio` lists entries; decorator can add (photo required) and delete own entries.
5. Portfolio photos upload to F-01 `portfolio` bucket at `{user_id}/{entry_id}/{filename}`; `storage_path` stored on `portfolio_entries`.
6. `npm run lint` and `npm run build` pass; manual smoke confirms publish visibility per RLS.

### Verification

- Sign up → dashboard hub → complete profile → publish → add portfolio photo → anon cannot see draft; can see published profile + approved entry (SQL or Supabase client with anon key).

## What We're NOT Doing

- Client search / public profile pages (S-02).
- Contact inquiry form or decorator inquiry panel (S-03).
- Admin moderation UI (S-04).
- F-01 `portfolio` bucket migration (stays in `domain-schema-foundation` Phase 3 — prerequisite only).
- Generated `database.types.ts` (optional follow-up).
- Profile row DELETE / account teardown.
- Email notifications, OAuth, payments, chat.

## Implementation Approach

Build incrementally: shared types and dashboard shell first, then profile API/UI, then profile photo storage (new `profiles` bucket in this change), then portfolio metadata CRUD, finally portfolio photo upload once F-01 Phase 3 is complete. Use Astro pages for SSR data fetch + React islands for interactive forms. New domain endpoints return JSON with zod validation.

## Critical Implementation Details

**Profile-before-portfolio:** Any portfolio INSERT fails RLS until `decorator_profiles` row exists for `auth.uid()`. Profile API should upsert on first save; portfolio page should show a link back to profile if none exists.

**Publish validation:** Server-side zod schema enforces required fields when `is_published` is true. Client mirrors rules for immediate feedback.

**Storage upload on Workers:** Upload via server API route (not direct browser-to-storage with service key). Cap upload size in API (e.g. 5 MB) to avoid Worker limits.

## Phase 1: Types and dashboard shell

### Overview

Introduce shared domain types, decorator taxonomy constants, zod dependency, and replace the dashboard stub with a hub + sub-page navigation shell.

### Changes Required:

#### 1. Shared types and taxonomy

**File**: `src/types.ts`

**Intent**: Define DTOs matching F-01 schema columns for profile and portfolio entities used across pages and API routes.

**Contract**: Export `DecoratorProfile`, `PortfolioEntry`, `CreateProfileInput`, `UpdateProfileInput`, `CreatePortfolioEntryInput` aligned to migration columns in `supabase/migrations/20260620120000_domain_schema.sql`.

**File**: `src/lib/decorator-taxonomy.ts`

**Intent**: Centralize predefined MVP picklists for profile filter fields.

**Contract**: Export `EVENT_TYPE_OPTIONS` and `DECORATION_STYLE_OPTIONS` as readonly string arrays:

- Event types: `Wesele`, `Urodziny`, `Baby shower`, `Event firmowy`, `Wieczór panieński`, `Komunia`, `Chrzest`
- Decoration styles: `Boho`, `Klasyczny`, `Rustykalny`, `Nowoczesny`, `Glamour`, `Minimalistyczny`, `Vintage`

#### 2. Zod dependency

**File**: `package.json`

**Intent**: Add server-side validation for new JSON API routes per AGENTS.md convention.

**Contract**: Add `zod` to `dependencies`; run `npm install`.

#### 3. Dashboard layout shell

**File**: `src/layouts/DashboardLayout.astro` (new)

**Intent**: Shared authenticated panel chrome — nav links to hub, profile, portfolio; sign-out; responsive layout consistent with cosmic theme.

**Contract**: Accept `title` prop; render slot for page content; show active nav state from `Astro.url.pathname`.

**File**: `src/pages/dashboard.astro`

**Intent**: Hub page — welcome, profile completion CTA when no `decorator_profiles` row, quick links to profile/portfolio.

**Contract**: Server-fetch profile via `createClient().from('decorator_profiles').select('id, company_name, is_published').eq('user_id', user.id).maybeSingle()`; pass `hasProfile`, `isPublished` to template.

**File**: `src/middleware.ts`

**Intent**: Ensure all `/dashboard/*` routes remain protected.

**Contract**: `PROTECTED_ROUTES` already uses prefix `/dashboard` — verify sub-routes covered; no change unless new non-prefixed routes added.

### Success Criteria:

#### Automated Verification:

- `npm install` succeeds after zod add
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Authenticated user sees dashboard hub with Profile and Portfolio nav links
- User without profile row sees completion CTA on hub

**Implementation Note**: Pause for human confirmation after automated checks before Phase 2.

---

## Phase 2: Profile CRUD

### Overview

JSON API and `/dashboard/profile` page for creating and editing `decorator_profiles`, including publish toggle with validation.

### Changes Required:

#### 1. Profile API

**File**: `src/pages/api/profile/index.ts`

**Intent**: GET own profile; POST create; PUT update. Authenticated only.

**Contract**:

- `GET` → 200 with profile row or 404 `{ error: { code: "PROFILE_NOT_FOUND", ... } }`
- `POST` / `PUT` → zod-validated body; map `user_id` from session; INSERT or UPDATE via `decorator_profiles`
- When `is_published: true`, require `company_name`, `city`, `description`, `contact_email` (return `VALIDATION_FAILED` 400 otherwise)
- `event_types` / `decoration_styles` must be subsets of taxonomy constants
- Errors per `api-error-format.mdc`; `export const prerender = false`

#### 2. Profile form UI

**File**: `src/pages/dashboard/profile.astro`

**Intent**: Server-render profile data; mount interactive edit form.

**Contract**: Fetch profile server-side; pass initial values to React island; redirect link to hub.

**File**: `src/components/decorator/ProfileForm.tsx`

**Intent**: Controlled form with predefined multi-select for event types and decoration styles, publish toggle, fetch to `/api/profile`.

**Contract**: `client:load` island; reuse `FormField`, `SubmitButton`; display API errors from structured JSON; call POST on first save, PUT thereafter.

#### 3. Auth redirect tweak (optional UX)

**File**: `src/pages/api/auth/signin.ts`

**Intent**: After sign-in, land on decorator panel instead of homepage.

**Contract**: Success redirect changes from `/` to `/dashboard` (one-line behavior change).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes
- Add `src/pages/api/profile/index.test.ts` or zod schema unit test for publish validation rules

#### Manual Verification:

- New user creates profile with required fields and saves draft (`is_published = false`)
- Publish blocked without `description` or `contact_email`; succeeds when all four required fields present
- Anon cannot SELECT unpublished profile (Supabase SQL or client test)

**Implementation Note**: Pause for human confirmation before Phase 3.

---

## Phase 3: Profile photo storage

### Overview

Add `profiles` storage bucket with owner-scoped policies and avatar upload flow updating `profile_photo_url`.

### Changes Required:

#### 1. Storage migration

**File**: `supabase/migrations/<timestamp>_profiles_storage.sql`

**Intent**: Private `profiles` bucket; decorator can upload/read/update/delete own objects under `{auth.uid()}/` prefix.

**Contract**:

- Bucket id: `profiles`, `public: false`
- Object path: `{auth.uid()}/avatar.{ext}` (single avatar per user; overwrite on re-upload)
- Policies on `storage.objects`: authenticated INSERT/UPDATE/DELETE/SELECT where `(storage.foldername(name))[1] = auth.uid()::text`

#### 2. Avatar upload API

**File**: `src/pages/api/profile/avatar.ts`

**Intent**: Accept multipart image upload; store in `profiles` bucket; update `profile_photo_url` on profile row.

**Contract**:

- `POST` only; require authenticated user + existing profile row
- Validate MIME (`image/jpeg`, `image/png`, `image/webp`) and max size 5 MB
- Upload path `{user_id}/avatar.{ext}`; persist signed or public URL in `profile_photo_url`
- Return updated profile JSON

#### 3. Avatar UI

**File**: `src/components/decorator/ProfileAvatarUpload.tsx`

**Intent**: File input with preview; POST to avatar API; show current photo from `profile_photo_url`.

**Contract**: Integrated into `ProfileForm` or profile page; client-side size/type pre-check.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` applies `profiles` bucket migration without error
- `npm run lint` and `npm run build` pass

#### Manual Verification:

- Decorator uploads avatar; `profile_photo_url` updates and image displays on profile page
- Second user cannot delete or overwrite first user's avatar object

**Implementation Note**: Pause for human confirmation before Phase 4.

---

## Phase 4: Portfolio CRUD

### Overview

Portfolio list and metadata management at `/dashboard/portfolio` — create and delete entries. Photo file upload deferred to Phase 5; this phase may use a placeholder `storage_path` only if needed for DB constraints, otherwise UI prepares entry without photo until Phase 5.

### Changes Required:

#### 1. Portfolio API

**File**: `src/pages/api/portfolio/index.ts`

**Intent**: `GET` list own entries; `POST` create entry (metadata only in this phase if photo upload is Phase 5).

**Contract**: Scope queries to `decorator_profile_id` from session user's profile; return 403 if no profile exists.

**File**: `src/pages/api/portfolio/[id].ts`

**Intent**: `DELETE` own entry by id.

**Contract**: Verify row belongs to `current_decorator_profile_id()` via RLS; return structured errors.

#### 2. Portfolio UI

**File**: `src/pages/dashboard/portfolio.astro`

**Intent**: List portfolio entries; link to add new entry.

**Contract**: Server-fetch entries for authenticated user's profile.

**File**: `src/components/decorator/PortfolioList.tsx`

**Intent**: Display entries with metadata; delete action.

**Contract**: Fetch API; confirm before delete.

**File**: `src/components/decorator/PortfolioEntryForm.tsx`

**Intent**: Form for optional metadata fields (`event_description`, `decoration_style`, `location`, `tags`); photo input present but disabled or labeled "available after storage setup" until Phase 5 if F-01 Phase 3 not done.

**Contract**: If F-01 Phase 3 complete mid-implementation, enable photo in Phase 5 instead.

### Success Criteria:

#### Automated Verification:

- `npm run lint` and `npm run build` pass

#### Manual Verification:

- Decorator with profile can add portfolio entry metadata and delete it
- Decorator without profile sees prompt to complete profile first
- Decorator B cannot delete decorator A's entry

**Implementation Note**: Pause for human confirmation before Phase 5.

---

## Phase 5: Portfolio photo upload

### Overview

Wire portfolio photo upload to F-01 `portfolio` storage bucket and complete end-to-end FR-003.

### Prerequisite

**F-01 Phase 3 must be complete:** `supabase/migrations/*_portfolio_storage.sql` exists and `npx supabase db reset` succeeds. Do not start this phase until `domain-schema-foundation` Progress shows Phase 3 automated checks done.

### Changes Required:

#### 1. Portfolio upload API

**File**: `src/pages/api/portfolio/upload.ts`

**Intent**: Accept multipart image + entry metadata; create `portfolio_entries` row with `storage_path`.

**Contract**:

- Path pattern: `{user_id}/{entry_id}/{filename}` per F-01 plan
- `storage_path` stores full bucket-relative path
- Photo required — reject without file (`VALIDATION_FAILED`)
- Optional metadata fields accepted in same request
- MIME/size validation same as avatar

#### 2. Portfolio form integration

**File**: `src/components/decorator/PortfolioEntryForm.tsx`

**Intent**: Enable photo upload; POST to upload API; show image preview from signed URL.

**Contract**: Replace metadata-only flow; photo required on submit.

#### 3. Image display helper

**File**: `src/lib/storage-url.ts`

**Intent**: Resolve `storage_path` to displayable URL for owner and (later) public gallery.

**Contract**: Function `getPortfolioImageUrl(supabase, storagePath)` using signed URL or policy-appropriate public URL.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` includes both `profiles` and `portfolio` bucket migrations
- `npm run lint` and `npm run build` pass

#### Manual Verification:

- Decorator adds portfolio entry with photo; entry appears in list with image
- Published profile + approved entry visible to anon SELECT per RLS
- Upload rejected without photo file

**Implementation Note**: Pause for human confirmation after Phase 5 — slice complete.

---

## Testing Strategy

### Unit Tests:

- Zod schemas for profile publish validation and portfolio upload required photo
- Taxonomy subset validation for array fields

### Integration Tests:

- Optional: API route tests with mocked Supabase client (defer if time-constrained)

### Manual Testing Steps:

1. Sign up new user → sign in → land on `/dashboard`
2. Hub shows profile CTA → open `/dashboard/profile` → save draft profile
3. Attempt publish without `contact_email` → blocked
4. Fill required fields → publish → verify anon cannot see profile until published (then can)
5. Upload avatar → verify `profile_photo_url` displays
6. Add portfolio entry with photo → verify list + image
7. Sign in as second user → confirm cannot access first user's profile/portfolio data

## Performance Considerations

- Cap image uploads at 5 MB server-side.
- Portfolio list query: single `select` with `decorator_profile_id` filter; no N+1.
- Signed URLs: generate on render; short TTL acceptable for dashboard.

## Migration Notes

- `profiles` bucket migration ships in S-01 Phase 3.
- `portfolio` bucket migration remains in F-01 — apply F-01 before Phase 5.
- No changes to existing F-01 table schemas required.

## References

- Roadmap S-01: `context/foundation/roadmap.md`
- PRD FR-001/002/003: `context/foundation/prd.md`
- F-01 schema plan: `context/changes/domain-schema-foundation/plan.md`
- Auth patterns: `src/pages/api/auth/signin.ts`, `src/components/auth/SignInForm.tsx`
- API errors: `.cursor/rules/api-error-format.mdc`
- React conventions: `.cursor/rules/react-conventions.mdc`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Types and dashboard shell

#### Automated

- [x] 1.1 `npm run lint` passes — 7bd1b62
- [x] 1.2 `npm run build` passes — 7bd1b62

#### Manual

- [x] 1.3 Dashboard hub shows Profile and Portfolio nav with completion CTA — 7bd1b62

### Phase 2: Profile CRUD

#### Automated

- [x] 2.1 `npm run lint` passes
- [x] 2.2 `npm run build` passes
- [x] 2.3 Publish validation unit test passes

#### Manual

- [x] 2.4 Profile create, edit, and publish validation work in UI
- [x] 2.5 Anon cannot read unpublished profile

### Phase 3: Profile photo storage

#### Automated

- [ ] 3.1 `npx supabase db reset` applies profiles bucket migration
- [ ] 3.2 `npm run lint` and `npm run build` pass

#### Manual

- [ ] 3.3 Avatar upload updates profile photo and blocks cross-user access

### Phase 4: Portfolio CRUD

#### Automated

- [ ] 4.1 `npm run lint` and `npm run build` pass

#### Manual

- [ ] 4.2 Portfolio metadata create and delete work for profile owner
- [ ] 4.3 Cross-decorator portfolio access blocked

### Phase 5: Portfolio photo upload

#### Automated

- [ ] 5.1 `npx supabase db reset` includes portfolio bucket (F-01 Phase 3)
- [ ] 5.2 `npm run lint` and `npm run build` pass

#### Manual

- [ ] 5.3 Portfolio photo upload end-to-end works
- [ ] 5.4 Published profile and approved portfolio visible to anon
