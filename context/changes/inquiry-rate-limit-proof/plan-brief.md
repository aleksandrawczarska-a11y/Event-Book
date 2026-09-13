# Inquiry Rate-Limit Proof — Plan Brief

> Full plan: `context/changes/inquiry-rate-limit-proof/plan.md`
> Research: `context/changes/inquiry-flow-analysis/research.md`

## What & Why

Test-plan risk #5 is “inquiry flood or junk is stored as a real lead.” The handler already rate-limits and returns `429`, but the handler unit mocks `@/lib/inquiry-abuse` so nothing proves a rejected POST skips `insert`. This change adds that proof and stops hiding the real limiter.

## Starting Point

`POST /api/inquiries` runs honeypot → zod → in-memory `Map` (5 / 10 min per IP+profile) → published check → insert. Leaf tests cover the `Map`. The handler test stubs `consumeInquiryRateLimit` to always allow.

## Desired End State

The handler test uses the real abuse module. After `RATE_LIMIT_MAX_REQUESTS` accepted POSTs, the next POST is `429 RATE_LIMITED` and `insert` is not called. The `Map` is unchanged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Slice | A only — 429 + no insert | Cheapest missing #5 assert; not an infra rewrite | Plan (locked interview) |
| Limiter store | Keep in-memory `Map` | Not D — KV / Durable Object is a later product decision | Research + lock |
| Ownership / UI | Not B, not C | No RLS e2e, no 204-vs-thanks change | Lock |
| Test layer | Handler unit, live limiter, mocked DB/email | Proves compose seam without Resend or Playwright | Research + test-plan |
| Oracle | Imported max + insert call count | Avoids “copy the number 6” anti-pattern | Test-plan #5 |
| CI Vitest | Not this change | Enforcement (suite on merge) is a later separate step | Test-plan Phase 3 |

## Scope

**In scope:**

- Remove `vi.mock("@/lib/inquiry-abuse")` from `index.test.ts`
- Reset buckets + set `cf-connecting-ip` so the live `Map` is isolated
- Keep existing handler cases green
- Add one-past-budget `429` + insert-not-called case

**Out of scope:**

- KV / Durable Object limiter
- Ownership RLS e2e, 204 UI, auth on POST, zod in the form, FormField move
- GET `/api/inquiries`, insert RLS, C-submit / query-helper extracts
- Extra 400/500 handler cases, email unit, CI `npm test`
- Payments / chat / calendar / e2e Resend

## Architecture / Approach

Stay on the current compose seam. Phase 1 unmocks abuse so the mechanism participates under today’s cases. Phase 2 characterizes the uncovered 429 branch. Production code is untouched unless Phase 2 shows insert runs after `limited: true` — then fix wiring only.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Unmock inquiry-abuse | Real limiter in existing handler tests; cases still green | Shared `Map` / missing `cf-connecting-ip` flakes |
| 2. 429 ⇒ no insert | Risk #5 proof on the live limiter | Treating status `429` as enough and skipping the insert oracle |

**Prerequisites:** Research at `inquiry-flow-analysis`; Vitest already configured.
**Estimated effort:** One short session, two commitable test-only phases.

## Open Risks & Assumptions

- Vitest default isolation is assumed enough once `beforeEach` resets the `Map`. If files share a process, the reset + explicit IP still keep keys stable.
- Handler wiring is assumed already correct; Phase 2 is expected green. A red test means a handler bug, not a store rewrite.
- `cf-connecting-ip` in production is unchanged and still out of scope.

## Success Criteria (Summary)

- Handler test no longer stubs `inquiry-abuse`
- Extra POST past the published budget is `429` and does not call `insert`
- In-memory `Map` still in place; no CI/lint enforcement added
