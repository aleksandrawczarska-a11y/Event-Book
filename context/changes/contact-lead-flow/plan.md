# Contact Lead Flow Implementation Plan

## Overview

Implement roadmap **S-03** (`contact-lead-flow`): anonymous (or authenticated) clients submit a contact inquiry from a published decorator profile; the inquiry is stored in `contact_inquiries`, the decorator is notified by email (Resend), and the decorator views inquiries in `/dashboard/inquiries`. Covers PRD **US-01**, **FR-006**, **FR-007**.

## Current State Analysis

- **Schema + RLS (F-01):** `contact_inquiries` exists with columns `decorator_profile_id`, `client_name`, `client_email`, `client_phone`, `event_date`, `needs_description`, `created_at`. Anon/authenticated INSERT only when target profile `is_published`; decorator SELECT own; no UPDATE/DELETE policies.
- **Public profile (S-02):** `/d/[id]` shows published profile + disabled “Contact — coming soon” CTA; static contact fields remain.
- **Dashboard (S-01):** `DashboardLayout` nav: Panel / Profile / Portfolio; portfolio list+API pattern (`requireAuth` → `requireDecoratorProfile` → `.from().select()`).
- **Email:** No transactional provider. `SUPABASE_KEY` is the **anon** key — no safe `auth.users` lookup for another user without a service role.
- **API pattern:** JSON routes + zod + `jsonError` (`.cursor/rules/api-error-format.mdc`); do not leak raw Supabase/Resend messages to clients.

### Key Discoveries:

- Publish already requires `contact_email` (`profile-schema.ts`) — reliable notify target for published profiles.
- Inquiry INSERT RLS is already the access gate for “published only”; API must still validate UUID + published and return stable errors.
- Contact form was explicitly deferred in `client-discovery` plan; CTA slot is ready at `src/pages/d/[id].astro`.

## Desired End State

1. On `/d/[id]`, CTA enables an inline contact form (name, email, optional phone, event date, needs).
2. Submit → `POST /api/inquiries` validates (zod + honeypot), inserts row, attempts Resend email to decorator `contact_email`, returns success JSON even if email fails (logged server-side).
3. Client sees inline success confirmation (no account required).
4. Decorator opens `/dashboard/inquiries`, sees newest-first list with expand for full needs text; nav includes Inquiries.
5. Unit tests cover schema + rate/honeypot helpers + mocked API handler paths; `npm run lint` / `npm run build` pass.

### Verification

- Published profile: submit inquiry → row in DB → decorator sees it in panel → email arrives at `contact_email` (or skip+log if Resend misconfigured in local-only smoke).
- Unpublished / invalid profile id: API rejects; no row.
- Honeypot filled: return success-shaped response without insert (silent drop — do not reveal detection).

## What We're NOT Doing

- Inquiry status workflow (read/unread/archived) or UPDATE/DELETE policies.
- Auth.users email fallback / Supabase service role.
- Cloudflare Turnstile (honeypot + light rate limit only).
- Dedicated `/d/[id]/contact` route or modal-only UX.
- Playwright e2e in CI; admin inquiry views beyond existing RLS.
- Realtime chat, payments, calendar (PRD non-goals).
- Changing F-01 inquiry schema columns (no new fields).
- GET `/api/inquiries` list endpoint (panel uses direct SSR like portfolio page).

## Implementation Approach

Server-owned submit boundary (`POST /api/inquiries`) mirrors profile/portfolio APIs so Resend secrets stay on the Worker. Public page uses a React island for the form; dashboard inquiries page **direct SSR** loads own rows in `dashboard/inquiries.astro` (same pattern as `dashboard/portfolio.astro` — no list GET API). Resend via raw `fetch` to `https://api.resend.com/emails` (no SDK). Rate limit: best-effort in-memory Map keyed by IP + profile id (document Workers isolate limits). Env: add `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (and optional `RESEND_TO_OVERRIDE` for dev) via Astro `env.schema` + wrangler secrets.

## Critical Implementation Details

**Email fail-soft:** Insert commits first; Resend errors are logged and do not fail the client response. Panel remains source of truth.

**Notify address:** Only `decorator_profiles.contact_email`. If null on a published profile (legacy/anomaly), skip send + log; still return success after insert.

**Honeypot:** Hidden field (e.g. `company_website`); if non-empty, return 204/200 success-shaped response without insert (do not reveal detection).

**Self-inquiry:** Allowed by RLS for authenticated users; no special block in MVP (Q12).

**Addendum (Phase 3):** `InquiriesPanel.tsx` React island was skipped — the expand-for-full-needs-text interaction is implemented with a native `<details>/<summary>` element directly in `dashboard/inquiries.astro`, since no client-side state beyond native disclosure toggling is required. This keeps the panel a plain SSR Astro page per `react-conventions` (React only when interactivity needs JS state).

## Phase 1: Inquiry submit API + email

### Overview

Add types, zod schema, Resend helper, rate/honeypot helpers, and `POST /api/inquiries` that inserts and notifies.

### Changes Required:

#### 1. Types and zod schema

**File**: `src/types.ts`

**Intent**: Add `ContactInquiry` DTO matching F-01 columns for API/UI.

**Contract**: Fields aligned to `contact_inquiries` migration; include `id`, `decorator_profile_id`, client fields, `event_date`, `needs_description`, `created_at`.

**File**: `src/lib/inquiry-schema.ts` (+ `*.test.ts`)

**Intent**: Validate public submit body.

**Contract**: Required `decorator_profile_id` (uuid), `client_name`, `client_email` (email), `event_date` (ISO date string / date), `needs_description` (min length); optional `client_phone`; honeypot field stripped before insert. Export `parseInquiryBody`.

#### 2. Resend + env

**File**: `astro.config.mjs`, `.env.example`, README

**Intent**: Declare server secrets for Resend; document `wrangler secret put`.

**Contract**: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` as optional server secrets (graceful skip when unset in local). **No `resend` npm package** — use raw `fetch` only.

**File**: `src/lib/inquiry-email.ts`

**Intent**: Send one transactional email to decorator with lead summary + reply-to client email.

**Contract**: `POST https://api.resend.com/emails` via `fetch` with `Authorization: Bearer ${RESEND_API_KEY}`. Export `sendInquiryNotification({ to, inquiry, profileCompanyName })` → `{ sent: boolean }`; never throw to caller — catch/log internally or return `{ sent: false }`.

#### 3. Abuse helpers

**File**: `src/lib/inquiry-abuse.ts` (+ tests)

**Intent**: Honeypot check + best-effort rate limit.

**Contract**: e.g. max N submits per IP+profile per window (document constants); rate-limit exceeded → `429` with stable `jsonError` code.

#### 4. POST API

**File**: `src/pages/api/inquiries/index.ts`

**Intent**: Public JSON endpoint: validate → verify published profile → insert → notify → return `{ inquiry: { id } }` (minimal).

**Contract**: `prerender = false`; no `requireAuth`. Use `createClient` from request cookies; if null → `jsonError("SUPABASE_NOT_CONFIGURED", …, 503)` before validation (mirror `api-auth.ts`). On insert failure / unpublished target → stable 4xx/404 without raw DB messages. Log email failures server-side only.

**File**: `src/pages/api/inquiries/index.test.ts`

**Intent**: Mock Supabase + email helper; verify validate → insert → notify ordering and fail-soft email path.

**Contract**: Cover happy path, honeypot short-circuit, unpublished target, and email failure after insert.

### Success Criteria:

#### Automated Verification:

- Unit tests for inquiry zod schema, honeypot, and rate-limit helper pass: `npm test -- --run src/lib/inquiry-schema.test.ts src/lib/inquiry-abuse.test.ts`
- Mocked POST handler unit tests pass: `npm test -- --run src/pages/api/inquiries/index.test.ts`
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- With Resend configured: POST valid body creates row and delivers email
- With Resend unset: POST still creates row; server logs skip; client gets success
- Honeypot / rate limit behave as designed

**Implementation Note**: Pause for human confirmation of manual checks before Phase 2.

---

## Phase 2: Public contact form UX

### Overview

Replace disabled CTA with inline form + success state on `/d/[id]`.

### Changes Required:

#### 1. Contact form island

**File**: `src/components/discovery/ContactInquiryForm.tsx` (or `src/components/contact/`)

**Intent**: Interactive form posting to `/api/inquiries`; shows field errors and success confirmation.

**Contract**: Props: `decoratorProfileId`, `companyName`. Fields match schema; include visually hidden honeypot. On success, replace form with thank-you copy (Q3). Reuse auth-ish field primitives where practical (`FormField`, etc.) without pulling dashboard-only chrome.

#### 2. Wire public profile

**File**: `src/pages/d/[id].astro`

**Intent**: Enable Contact CTA (scroll/focus to form section); mount island with profile id.

**Contract**: Remove disabled “coming soon” button behavior; keep static contact details section. Form only on published profiles (page already 404s otherwise).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Submit happy path on `/d/[id]` shows success without account
- Validation errors surface on empty/invalid fields
- CTA discovers/focuses the form section on click

**Implementation Note**: Pause for human confirmation before Phase 3.

---

## Phase 3: Decorator inquiries panel

### Overview

List own inquiries newest-first with expand detail; add nav + dashboard hub entry.

### Changes Required:

#### 1. Panel page + UI (direct SSR — locked)

**File**: `src/pages/dashboard/inquiries.astro`

**Intent**: SSR load decorator’s inquiries via `createClient` + own profile lookup — **mirror `dashboard/portfolio.astro`**, not the unused portfolio GET API.

**Contract**: Resolve profile id from `Astro.locals.user`; query `contact_inquiries` where `decorator_profile_id = profile.id`, order `created_at` desc, limit 50. Empty state when none. Do not instantiate Supabase in React components (per react-conventions).

**File**: `src/components/decorator/InquiriesPanel.tsx` (optional island if expand needs client state)

**Intent**: Present inquiry cards: client name, email, phone, event date, truncated needs + expand. Receive inquiries as props from SSR page.

#### 2. Nav + hub

**File**: `src/layouts/DashboardLayout.astro`

**Intent**: Add “Inquiries” nav item beside Portfolio.

**File**: `src/pages/dashboard.astro`

**Intent**: Hub card/link to inquiries (count optional if cheap).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- After a submit, owning decorator sees the inquiry on `/dashboard/inquiries`
- Other decorator’s session does not see it (RLS)
- Nav highlights Inquiries route

**Implementation Note**: Pause for human confirmation before Phase 4.

---

## Phase 4: Verify end-to-end

### Overview

Close automated gates and run full manual funnel smoke.

### Changes Required:

#### 1. Tests and docs polish

**File**: tests under `src/lib/*.test.ts`, README env section

**Intent**: Ensure Phase 1 tests remain green; document Resend secrets and local skip behavior.

#### 2. Roadmap / change status (when implement completes)

**Intent**: Implement skill will stamp Progress; after full done, roadmap S-03 → done (not in this planning write except initial `in-progress`).

### Success Criteria:

#### Automated Verification:

- `npm test` (inquiry-related + regression) passes
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Full funnel: search/profile → submit → success UI → panel list → email received (or documented skip in local)
- Unpublished profile cannot be targeted via API
- Spam path: honeypot does not create rows

---

## Testing Strategy

### Unit Tests:

- `parseInquiryBody` — required fields, email, date, honeypot stripping
- Rate limit / honeypot helpers
- Email helper returns `{ sent: false }` when key missing (no throw)
- API handler with mocked Supabase + email (`src/pages/api/inquiries/index.test.ts`)

### Integration Tests:

- Not required in CI for S-03; manual RLS/email smoke covers boundaries

### Manual Testing Steps:

1. Publish decorator with `contact_email`; open `/d/{id}`; submit inquiry
2. Confirm success UI; check Supabase row; check Resend inbox
3. Sign in as decorator → `/dashboard/inquiries` → expand needs
4. Sign in as other decorator → confirm isolation
5. POST with honeypot filled → no new row
6. Unset Resend key locally → submit still succeeds; log shows skip

## Performance Considerations

- Rate limit is best-effort per Worker isolate — acceptable for MVP; Turnstile later if abused
- List limited to ~50 newest inquiries

## Migration Notes

- No new migrations; reuse F-01 `contact_inquiries` + RLS
- New secrets: Resend (local `.dev.vars` / production wrangler)

## References

- PRD: `context/foundation/prd.md` (US-01, FR-006, FR-007)
- Roadmap: `context/foundation/roadmap.md` S-03
- Schema: `supabase/migrations/20260620120000_domain_schema.sql`, `..._domain_rls.sql`
- Prior slices: `context/changes/client-discovery/`, `context/changes/decorator-onboarding/`
- CTA slot: `src/pages/d/[id].astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Inquiry submit API + email

#### Automated

- [x] 1.1 Unit tests for inquiry schema and abuse helpers pass
- [x] 1.2 Mocked POST handler unit tests pass
- [x] 1.3 `npm run lint` passes
- [x] 1.4 `npm run build` passes

#### Manual

- [x] 1.5 POST creates row; email delivers when Resend configured (or skip logged when unset)
- [x] 1.6 Honeypot / rate limit behave as designed

### Phase 2: Public contact form UX

#### Automated

- [x] 2.1 `npm run lint` passes
- [x] 2.2 `npm run build` passes

#### Manual

- [x] 2.3 Happy-path submit shows success without account
- [x] 2.4 Validation errors and CTA→form focus work

### Phase 3: Decorator inquiries panel

#### Automated

- [x] 3.1 `npm run lint` passes
- [x] 3.2 `npm run build` passes

#### Manual

- [x] 3.3 Owner sees inquiry; other decorator does not
- [x] 3.4 Nav / hub link to Inquiries works

### Phase 4: Verify end-to-end

#### Automated

- [ ] 4.1 `npm test` (inquiry-related + regression) passes
- [ ] 4.2 `npm run lint` passes
- [ ] 4.3 `npm run build` passes

#### Manual

- [ ] 4.4 Full funnel smoke (submit → panel → email/skip)
- [ ] 4.5 Unpublished target and honeypot produce no stray rows
