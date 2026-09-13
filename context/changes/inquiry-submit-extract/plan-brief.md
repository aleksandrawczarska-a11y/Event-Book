# Inquiry Submit Extract — Plan Brief

> Full plan: `context/changes/inquiry-submit-extract/plan.md`

## What & Why

Extract the published-inquiry compose step from `POST /api/inquiries` into `src/lib/inquiry-submit.ts`. The route stays HTTP. We characterize 429 ⇒ no insert **first** so the move does not relocate an untested seam (the ⭐ challenge to C-submit).

## Starting Point

Live limiter already participates in `index.test.ts` (`inquiry-rate-limit-proof` p1, `8be920f`). The 429 flood case is still missing. Other APIs compose in the route; there is no `services/` layer.

## Desired End State

Thin `POST` + `submitPublishedInquiry` in `lib/`. Same statuses. Flood test uses imported `RATE_LIMIT_MAX_REQUESTS` and an insert-call oracle.

## Key Decisions Made

- **Option B** — C-submit, not FormField (done) and not KV/DO.
- **lib/ not services/** — match `inquiry-query.ts`.
- **Phase 1 absorbs** unfinished `inquiry-rate-limit-proof` Phase 2. Do not run both.
- **Shared insert mock** for the flood (sibling review F3).

## Scope

**In:** 429 characterization, extract, leftover-path grep.

**Out:** query helpers, FormField, limiter infra, public POST auth, GET list API, form zod, e2e Resend, CI test job.

## Architecture / Approach

`POST`: 503 / JSON / honeypot / zod → helper. Helper: rate limit → published profile → insert → fail-soft email. Discriminated result, no throws for expected outcomes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1 | 429 + insert not called on current `POST` | New insert mock per POST makes the count oracle lie |
| 2 | `inquiry-submit.ts` + thin route | Behavior drift if mapping misses a status |
| 3 | Leftover-path + depcruise | False “empty” if compose stays aliased |

**Prerequisites:** Phase 1 of `inquiry-rate-limit-proof` on HEAD. **Effort:** small (tests + one lib file).

## Open Risks & Assumptions

- Working-tree `inquiry-abuse.ts` may differ from HEAD (sweep / IP). Do not stage that as part of this extract unless the flood test requires it.
- `CreateContactInquiryInput` stays unused.

## Success Criteria (Summary)

Flood 429 without insert; helper owns compose; `POST` has no `contact_inquiries` / `consumeInquiryRateLimit`; inquiry form still thanks on 201.
