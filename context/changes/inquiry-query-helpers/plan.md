# Inquiry query helpers Implementation Plan

## Overview

Extract the duplicated published-by-id profile read and the decorator inbox list into `lib` helpers (`fetchPublishedDecoratorProfile`, `listInquiriesForProfile`), matching the existing `discovery-query.ts` pattern. SSR pages stay SSR. Characterization tests lock published-only and owner-list query shape **before** callers switch, so the move is not just relocating SQL.

## Current State Analysis

The inquiry north star already has leaf helpers for schema, abuse, and email. The two user-visible ends and the POST publish check still inline PostgREST:

- `src/pages/d/[id].astro` loads `decorator_profiles` with `.eq("id", id).eq("is_published", true)` and `select("*")`, then 404s if missing.
- `src/pages/api/inquiries/index.ts` uses the same filter with `select("id, company_name, contact_email")`, then 500 on query error / 404 when unpublished.
- `src/pages/dashboard/inquiries.astro` loads own `decorator_profiles.id` by `user_id`, then `contact_inquiries` for that id, newest first, limit 51 / show 50.

Search already owns published-list queries in `src/lib/discovery-query.ts` (injected `SupabaseClient`, characterized in `discovery-query.test.ts`). There is no inquiry query module. `requireDecoratorProfile` in `api-auth.ts` is the same “user → profile id” lookup but returns `jsonError` and is used only by portfolio APIs — out of this slice.

Research classification (`inquiry-flow-analysis` §④): C-query-helpers is the locked refactor. “No GET list API” is an intentional S-03 constraint; duplicated published-by-id SQL is accidental. The ranking counter still applies: extracting SQL without a characterization of published-only / owner-list shape is just moving queries.

## Desired End State

- One `lib` module (analog of `discovery-query.ts`) exports `fetchPublishedDecoratorProfile` and `listInquiriesForProfile`.
- Public profile page and POST `/api/inquiries` both call the published-by-id helper. Inbox page calls the list helper. User → profile id stays inline on the inbox page.
- Characterization tests prove: published-only filter + `maybeSingle`; inbox list table / owner `eq` / newest-first / limit+1 / slice + `hasMoreThanLimit`.
- No new HTTP surface. Guest form, honeypot, limiter, and email path unchanged.

Verify: helper unit file is green; handler unit suite still green; `from("decorator_profiles")` published-by-id and `from("contact_inquiries")` list no longer appear in the two `.astro` shells / POST (only via the helpers).

### Key Discoveries:

- Same published-by-id filter, different columns: page `select("*")` vs handler `select("id, company_name, contact_email")` (`d/[id].astro` vs `api/inquiries/index.ts`). Helper must accept a column list so results stay equivalent.
- Inbox cap contract is “fetch one extra row, display 50, set overflow flag” (`dashboard/inquiries.astro`) — the helper should own that shape so the page does not re-slice.
- Existing test analog is a chained query-builder mock (`discovery-query.test.ts`), not a live Supabase / RLS session. Risk #4 e2e is not cheap from these pages (no Vitest for `.astro`; existing e2e is owner-only happy path).
- `requireDecoratorProfile` blast includes `api-auth` and four portfolio handlers — research keeps it out of the first step.

## What We're NOT Doing

- No `GET /api/inquiries` (or any inquiry list API).
- No KV / Durable Object limiter; leave `inquiry-rate-limit-proof` unimplemented.
- No 204 vs 201 thanks-UI change.
- No `FormField` move.
- No `submitInquiry` / `src/lib/services/` extract.
- No folding `requireDecoratorProfile` / portfolio / other dashboard `user_id` lookups into this helper.
- No full test-plan risk #4 e2e (decorator A vs B against live RLS) unless a page already makes that cheap — it does not.
- No payments, chat, calendars; no new Supabase client constructors; no TS strictness relaxation; Cloudflare stays.

## Implementation Approach

Follow `discovery-query.ts`: helpers take `SupabaseClient`, pages/handler keep `createClient()` from `@/lib/supabase`. Characterize both helpers with a builder mock **before** any caller rewrite (mechanism green). Then switch published-by-id sites, then the inbox list (enforcement). Each phase compiles and tests alone.

### m4l4 plan bars (self-check)

- **Characterization before uncovered code:** Phase 1 writes helper tests and the helpers only. Callers stay inline until those tests are green.
- **Committable phases:** Phase 1 is an unused (but tested) module; Phase 2 is a behavior-preserving published-by-id rewire; Phase 3 is a behavior-preserving inbox rewire.
- **Auto + manual per phase:** every phase has commands an agent can run and a short human smoke (no UI change / profile 404 / inbox states).
- **Mechanism green then enforcement:** tests + helpers first; POST and pages switch only after the helper contract is proven.

## Critical Implementation Details

The published helper must pass the caller’s `select` list through (default `*` for the profile page; handler keeps `id, company_name, contact_email`). Unifying on `*` would change the handler payload vs today’s query and weaken “same results.”

Do not mock `@/lib/inquiry-query` inside `api/inquiries/index.test.ts`. Keep the existing `createClient` / `from` chain so the helper runs against the same mock client; otherwise the published-only filter can drift from the handler test.

Inbox `user_id` → profile id stays in `dashboard/inquiries.astro`. Extracting it here would pull `api-auth` / portfolio into the blast radius.

## Phase 1: Characterize and add query helpers

### Overview

Lock the query contracts with characterization tests, then add `fetchPublishedDecoratorProfile` and `listInquiriesForProfile`. No page or handler rewire in this phase.

### Changes Required:

#### 1. Inquiry query module

**File**: `src/lib/inquiry-query.ts`

**Intent**: Own the two reads that today live inline in the profile page, POST handler, and inbox page, so later phases can switch callers without rewriting SQL.

**Contract**: Export `fetchPublishedDecoratorProfile(client, id, columns?)` — `from("decorator_profiles")`, caller columns (default `*`), `.eq("id", id)`, `.eq("is_published", true)`, `maybeSingle`; return `{ data, error }` (null data when unpublished). Export `listInquiriesForProfile(client, profileId, limit?)` — `from("contact_inquiries")`, `select("*")`, `.eq("decorator_profile_id", profileId)`, newest `created_at` first, `limit + 1`, return `{ inquiries, hasMoreThanLimit, error }` with inquiries sliced to `limit` (default 50). Accept `SupabaseClient`. Do not throw on PostgREST error (handler distinguishes 500 vs 404; inbox currently ignores list errors).

#### 2. Characterization tests

**File**: `src/lib/inquiry-query.test.ts`

**Intent**: Prove the helpers issue the same filters and list shape as today’s inline queries, so extraction is not a silent behavior change.

**Contract**: Mirror the chained-builder mock in `discovery-query.test.ts`. Published helper: table, both `eq`s, `maybeSingle`, default vs explicit columns, found row, unpublished `data: null`, surfaced `error`. List helper: table, owner `eq`, `order("created_at", { ascending: false })`, `limit(limit + 1)`, slice + `hasMoreThanLimit` for 51 vs ≤50 rows, empty list, surfaced `error` with empty inquiries. No Playwright / live RLS session.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/lib/inquiry-query.test.ts` passes (published-only, same filter/columns/`maybeSingle`, owner list shape).
- `src/lib/inquiry-query.ts` exports both helpers; `d/[id].astro`, `api/inquiries/index.ts`, and `dashboard/inquiries.astro` still contain their inline queries.
- Existing `npm test -- src/pages/api/inquiries/index.test.ts` still passes (no handler rewrite yet).

#### Manual Verification:

- Confirm this phase adds no user-visible route or copy change (helpers unused by pages).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Switch published-by-id callers

### Overview

Point POST `/api/inquiries` and the public profile page at `fetchPublishedDecoratorProfile`. Handler HTTP mapping (500 vs 404) and page 404 stay at the call site.

### Changes Required:

#### 1. Inquiry POST publish check

**File**: `src/pages/api/inquiries/index.ts`

**Intent**: Use the characterized published-by-id helper so the write gate and the public page share one filter.

**Contract**: After rate-limit, call `fetchPublishedDecoratorProfile(supabase, parsed.data.decorator_profile_id, "id, company_name, contact_email")`. Keep `PROFILE_FETCH_FAILED` on `error`, `PROFILE_NOT_FOUND` on missing data, then insert + notify unchanged. Do not add GET/PATCH/DELETE. Do not extract `submitInquiry`.

#### 2. Public profile page

**File**: `src/pages/d/[id].astro`

**Intent**: Load the published profile through the same helper; keep SSR, gallery, and `ContactInquiryForm` mount as they are.

**Contract**: Replace the inline `decorator_profiles` published-by-id select with `fetchPublishedDecoratorProfile(supabase, id)` (default columns). Still 404 when client/id missing or `{ error || !data }`. Do not move portfolio / photo queries.

#### 3. Handler unit (only if the mock chain breaks)

**File**: `src/pages/api/inquiries/index.test.ts`

**Intent**: Keep the existing unpublished/happy-path proofs on the live helper + mocked client.

**Contract**: Adjust the query-builder mock only if the helper needs a method the current chain already exposes (`select` / `eq` / `maybeSingle`). Do not `vi.mock` the new helper module.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/lib/inquiry-query.test.ts src/pages/api/inquiries/index.test.ts` passes.
- POST and `d/[id].astro` import and call `fetchPublishedDecoratorProfile`; neither inlines `.eq("is_published", true)` for the by-id profile read.
- No `GET` / `PATCH` / `DELETE` export under `src/pages/api/inquiries/`.

#### Manual Verification:

- A published `/d/:id` still renders company name + contact form; an unknown or unpublished id still 404s. POST inquiry from that page still returns 201 for a valid body (local env).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Switch inbox list caller

### Overview

Point `/dashboard/inquiries` at `listInquiriesForProfile`. Keep the session gate, “complete your profile” empty state, and inline `user_id` → profile id lookup.

### Changes Required:

#### 1. Decorator inbox page

**File**: `src/pages/dashboard/inquiries.astro`

**Intent**: Display the same newest-50 list through the characterized helper so the inbox read is on-graph and testable at the query seam.

**Contract**: After a profile id exists, call `listInquiriesForProfile(supabase, profile.id)` (default limit 50). Bind `inquiries` and `hasMoreThanLimit` from the helper. Leave `user_id` profile lookup inline. Do not call `requireDecoratorProfile`. Do not add a list API. Overflow copy and empty / no-profile UI stay as they are.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/lib/inquiry-query.test.ts src/pages/api/inquiries/index.test.ts` passes.
- `dashboard/inquiries.astro` imports `listInquiriesForProfile` and no longer inlines `from("contact_inquiries")`.
- Inbox still loads own profile via inline `.eq("user_id", user.id)` (not `api-auth`).
- No `GET /api/inquiries` route file exists.

#### Manual Verification:

- Signed-in decorator without a profile still sees “Complete your profile first”; with a profile and no rows, the empty copy; with rows, newest leads and the “latest 50” note only when overflow applies.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- `inquiry-query.test.ts`: published-only filter, column pass-through, unpublished null, query error; inbox list owner `eq`, order, limit+1, slice / overflow flag, empty, error.
- Existing handler unit: 503, honeypot 204, 201 + notify, unpublished 404, email-fail 201 — still against a mocked `createClient`, now flowing through the helper.

### Integration Tests:

- None new. A live A-vs-B RLS session is the cheap #4 proof in the abstract, but these pages do not already make it cheap (no `.astro` Vitest harness, no decorator-B e2e). Out of scope.

### Manual Testing Steps:

1. Phase 1: no UI delta — helpers unused.
2. Phase 2: open a published profile; hit a junk UUID; submit one valid inquiry if local Supabase is up.
3. Phase 3: open `/dashboard/inquiries` in no-profile, empty, and populated states if fixtures exist.

## Performance Considerations

Same PostgREST queries and limits as today (inbox still 51-row fetch). No extra round-trips.

## Migration Notes

None. No schema or RLS change. Rollback is revert of the helper module + three call sites.

## References

- Related research: `context/changes/inquiry-flow-analysis/research.md` §④ C-query-helpers
- Analog: `src/lib/discovery-query.ts`, `src/lib/discovery-query.test.ts`
- Call sites: `src/pages/d/[id].astro`, `src/pages/api/inquiries/index.ts`, `src/pages/dashboard/inquiries.astro`
- Left untouched: `context/changes/inquiry-rate-limit-proof/`
- Test-plan risk #4 (not expanded to e2e here): `context/foundation/test-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Characterize and add query helpers

#### Automated

- [x] 1.1 `npm test -- src/lib/inquiry-query.test.ts` passes (published-only, same filter/columns/`maybeSingle`, owner list shape).
- [x] 1.2 `src/lib/inquiry-query.ts` exports both helpers; `d/[id].astro`, `api/inquiries/index.ts`, and `dashboard/inquiries.astro` still contain their inline queries.
- [x] 1.3 Existing `npm test -- src/pages/api/inquiries/index.test.ts` still passes (no handler rewrite yet).

#### Manual

- [x] 1.4 Confirm this phase adds no user-visible route or copy change (helpers unused by pages).

### Phase 2: Switch published-by-id callers

#### Automated

- [x] 2.1 `npm test -- src/lib/inquiry-query.test.ts src/pages/api/inquiries/index.test.ts` passes.
- [x] 2.2 POST and `d/[id].astro` import and call `fetchPublishedDecoratorProfile`; neither inlines `.eq("is_published", true)` for the by-id profile read.
- [x] 2.3 No `GET` / `PATCH` / `DELETE` export under `src/pages/api/inquiries/`.

#### Manual

- [x] 2.4 A published `/d/:id` still renders company name + contact form; an unknown or unpublished id still 404s. POST inquiry from that page still returns 201 for a valid body (local env).

### Phase 3: Switch inbox list caller

#### Automated

- [x] 3.1 `npm test -- src/lib/inquiry-query.test.ts src/pages/api/inquiries/index.test.ts` passes.
- [x] 3.2 `dashboard/inquiries.astro` imports `listInquiriesForProfile` and no longer inlines `from("contact_inquiries")`.
- [x] 3.3 Inbox still loads own profile via inline `.eq("user_id", user.id)` (not `api-auth`).
- [x] 3.4 No `GET /api/inquiries` route file exists.

#### Manual

- [x] 3.5 Signed-in decorator without a profile still sees “Complete your profile first”; with a profile and no rows, the empty copy; with rows, newest leads and the “latest 50” note only when overflow applies.
