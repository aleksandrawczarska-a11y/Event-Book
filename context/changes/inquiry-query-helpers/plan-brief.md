# Inquiry query helpers — Plan Brief

> Full plan: `context/changes/inquiry-query-helpers/plan.md`
> Research: `context/changes/inquiry-flow-analysis/research.md`

## What & Why

Move the published-by-id profile read and the decorator inbox list into `lib` helpers so the off-graph north-star ends share one query seam with POST. Motivation is research §④ C-query-helpers: duplicated `is_published` + id filter and an untested inbox list shape — not a new HTTP API.

## Starting Point

Public profile and inquiry POST each inline a published-by-id `decorator_profiles` select (different columns). Inbox inlines `contact_inquiries` (limit 51 / show 50). Search already uses `discovery-query.ts` the same way.

## Desired End State

`fetchPublishedDecoratorProfile` and `listInquiriesForProfile` live in `src/lib/inquiry-query.ts`. Profile page + POST call the first; inbox calls the second. SSR stays. Characterization tests lock published-only and owner-list shape. Guests still POST; decorators still see their own SSR list.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Slice | C-query-helpers only | User lock; ranked #1 in research §④ | Research / user |
| HTTP | No GET `/api/inquiries` | Intentional S-03 “direct SSR panel” | Research |
| Tests | Helper characterization, not risk #4 e2e | Counter: moving SQL ≠ #4 proof; pages do not make A-vs-B e2e cheap | Research / user |
| Inbox owner lookup | Stay inline | Folding `requireDecoratorProfile` pulls api-auth + portfolio | Research |
| Columns | Pass through select list | Page needs `*`; handler keeps three columns (“same results”) | Plan |
| Out | No limiter / 204 UI / FormField / `submitInquiry` | Separate candidates; `inquiry-rate-limit-proof` left as-is | User |

## Scope

**In scope:** `inquiry-query.ts` + tests; switch `d/[id].astro`, POST, `dashboard/inquiries.astro`.

**Out of scope:** list API, KV/DO limiter, honeypot UI, FormField move, `submitInquiry`, `api-auth`/portfolio, live RLS A-vs-B e2e, payments/chat/calendars.

## Architecture / Approach

Helpers take `SupabaseClient` (same as discovery). Phase 1 proves the mechanism with mocks. Phase 2 enforces the published helper on POST + profile page. Phase 3 enforces the list helper on the inbox. Handler tests keep mocking `createClient`, not the helper.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Characterize + add helpers | Tested module, callers unchanged | Tests that only restate SQL without published-only / list-shape asserts |
| 2. Switch published-by-id | POST + `/d/:id` share the helper | Handler mock chain breaks; 500 vs 404 mapping slips |
| 3. Switch inbox list | Inbox uses list helper | Overflow (50/51) or no-profile branch regresses |

**Prerequisites:** research §④ lock; Vitest. Local Supabase only for optional manual POST/inbox smoke.
**Estimated effort:** one session, three commitable phases.

## Open Risks & Assumptions

- Characterization uses a query-builder mock (like discovery), not live RLS — risk #4 remains a later integration.
- Inbox still swallows list errors at the page (parity with today).

## Success Criteria (Summary)

- Both helpers characterized (published-only; owner list shape).
- Three call sites switched; no new inquiry GET.
- Existing handler unit suite still green.
