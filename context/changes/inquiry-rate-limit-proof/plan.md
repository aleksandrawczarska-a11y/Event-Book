# Inquiry Rate-Limit Proof Implementation Plan

## Overview

Prove test-plan risk #5 at the cheapest layer: after the published per-IP-per-profile budget is spent, the next `POST /api/inquiries` returns `429` **and** `contact_inquiries.insert` is not called. Stop mocking `@/lib/inquiry-abuse` in the handler test so the real in-memory limiter participates. The `Map` stays; this is a missing assert, not an infra rewrite.

## Current State Analysis

Research (`context/changes/inquiry-flow-analysis/research.md`) already mapped the slice. Disk baseline matches that report:

- `POST` in `src/pages/api/inquiries/index.ts` is unauthenticated. Sequence: JSON → honeypot `204` → `parseInquiryBody` → `getInquiryClientIp` + `consumeInquiryRateLimit` → published-profile fetch → `insert` → fail-soft email → `201`.
- The limiter is a module-level `Map` keyed `${ip}:${decoratorProfileId}`, 5 requests / 10 minutes (`src/lib/inquiry-abuse.ts`). Comment already records the per-isolate MVP limit and names Durable Object / KV as a later upgrade — **out of scope**.
- `inquiry-abuse.test.ts` proves the `Map` in isolation (5th ok / 6th limited). It does **not** prove the handler refuses persistence.
- `src/pages/api/inquiries/index.test.ts` mocks the entire `@/lib/inquiry-abuse` module (`vi.mock` at lines 17–21) and stubs `consumeInquiryRateLimit` to `{ limited: false }`. The 429 branch and the “insert must not run” invariant are therefore untested at the compose seam.
- `createContext` in that file does not set `cf-connecting-ip`. After the mock is gone, real `getInquiryClientIp` returns `"unknown"` for every request in this file unless the helper grows that header.
- The same `Map` is shared with `inquiry-abuse.test.ts` via the module singleton. `resetInquiryRateLimitBuckets()` already exists for this.
- Limit is consumed **after** validation and **before** the published-profile check and insert. A 6th valid POST must 429 without touching `from("contact_inquiries")`.
- Supabase and Resend stay mocked. This is still a handler unit with a live limiter, not a DB or e2e test.
- CI (`.github/workflows/ci.yml`) is lint + build only. `npm test` is local. Wiring Vitest into CI is test-plan §3 Phase 3 — **not this change**.

## Desired End State

1. `src/pages/api/inquiries/index.test.ts` does **not** `vi.mock("@/lib/inquiry-abuse")`. Honeypot, IP, and rate-limit helpers are the real exports.
2. Existing handler cases still pass: `503`, honeypot `204`, happy `201`, unpublished `404`, email-fail `201`.
3. A new case posts a valid body `RATE_LIMIT_MAX_REQUESTS` times for the same client IP + profile, then one more time. The extra POST is `429` with `error.code === "RATE_LIMITED"`, and `insert` was not invoked for that request (call count stays at the published max).
4. Production `inquiry-abuse.ts` (the `Map`, window, key, `cf-connecting-ip` rule) is unchanged unless Phase 2 proves the handler skips insert incorrectly — then fix **handler wiring only**.

### Key Discoveries:

- Handler already returns `jsonError("RATE_LIMITED", …, 429, { retryAfterMs })` at `src/pages/api/inquiries/index.ts:46-49`. The mechanism exists; the proof does not.
- `vi.mock` is file-hoisted. The real limiter cannot participate in one test while the rest of the same file still stubs the module. Unmock is a whole-file change.
- Test-plan #5 anti-pattern: “Copying the production limit numbers as the only oracle.” Import `RATE_LIMIT_MAX_REQUESTS` and treat **insert not called** as the persistence oracle — do not hardcode a lone `6`.
- Honeypot today asserts `consumeInquiryRateLimitMock.not.toHaveBeenCalled()`. After unmock, keep that invariant (spy on the real export, or show the honeypot did not spend budget) — do not drop it silently.

## What We're NOT Doing

Locked in the m4l4 interview (choice **A**, not B/C/D) and prior research agreement:

- **Not D:** do not move the limiter to KV or a Durable Object. The in-memory `Map` stays.
- **Not B:** no ownership / RLS e2e (test-plan #4).
- **Not C:** no 204-vs-thanks UI change.
- Payments, chat, booking calendar.
- E2E against Resend.
- Auth on the public POST.
- Pulling zod / `inquiry-schema` into `ContactInquiryForm`.
- Rebuilding or moving `FormField`.
- Adding `GET /api/inquiries`.
- Changing insert RLS.
- Extracting `submitInquiry` / `src/lib/services/` (C-submit) or query helpers (C-query-helpers).
- Filling every missing handler branch (`400` invalid JSON, zod `400`, `PROFILE_FETCH_FAILED` `500`, insert `500`) — only the 429 ⇒ no-insert gap.
- Adding `inquiry-email.test.ts`.
- Wiring `npm test` into CI (enforcement of “suite runs on merge” is a later, separate step).
- Paying down all documented debts at once.

## Implementation Approach

Two separately commitable test-only phases. Easiest and most independent first.

**Phase 1** makes the real limiter participate in the existing handler file and keeps today’s cases green. That is the mechanism going green: honeypot, IP, and `consumeInquiryRateLimit` are no longer stubs, and the file still passes.

**Phase 2** adds the characterization of the uncovered 429 branch: one-past-budget POST ⇒ `429` and `insert` not called. That is the risk #5 proof. Do not add a lint rule, CI job, or other enforcement that “the mock must stay gone” in this change.

No production edits are planned. If Phase 2 is red because the handler inserts before checking `rateLimit.limited`, fix that condition only — do not change the store.

## Critical Implementation Details

**File-scoped mock.** Removing `vi.mock("@/lib/inquiry-abuse")` affects every case in `index.test.ts` at once. Do not add a sibling file that leaves the original mock in place — the lock is to stop mocking in this handler test (or an equivalent that *replaces* it). Prefer editing `index.test.ts`.

**Shared `Map` + missing IP header.** Call `resetInquiryRateLimitBuckets()` in `beforeEach`. Give `createContext` a stable `cf-connecting-ip` (the existing abuse unit already uses `203.0.113.10`) so this file does not silently share the `"unknown"` bucket with other tests if the module is reused in-process.

**Consume-before-insert.** The 429 path returns before `supabase.from("contact_inquiries")`. The persistence oracle is the insert mock’s call count (or that `from("contact_inquiries")` was not used on the extra POST), not the status code alone.

## Phase 1: Unmock inquiry-abuse in the handler test

### Overview

Stop stubbing `@/lib/inquiry-abuse` so the real honeypot, IP, and limiter run under the existing handler cases. Isolate the module `Map`. Do not add the 429 case yet.

### Changes Required:

#### 1. Handler test harness

**File**: `src/pages/api/inquiries/index.test.ts`

**Intent**: Delete the `vi.mock("@/lib/inquiry-abuse")` block and the three abuse mocks (`consumeInquiryRateLimitMock`, `getInquiryClientIpMock`, `hasInquiryHoneypotContentMock`). Keep `vi.mock` for `@/lib/supabase` and `@/lib/inquiry-email` only. Existing cases must stay meaningful with the real helpers.

**Contract**: After this phase the file imports the real abuse module (at least `resetInquiryRateLimitBuckets`; a spy on `consumeInquiryRateLimit` is allowed if needed to keep the honeypot “limiter not consumed” invariant). `beforeEach` resets the `Map`. `createContext` sends `cf-connecting-ip`. Honeypot still uses a filled `company_website` so the real `hasInquiryHoneypotContent` returns true. Happy / 404 / email-fail cases still issue a single valid POST after reset so they cannot trip the live budget.

### Success Criteria:

#### Automated Verification:

- `src/pages/api/inquiries/index.test.ts` has no `vi.mock("@/lib/inquiry-abuse")` (and no equivalent stub of `consumeInquiryRateLimit` that forces `{ limited: false }`)
- Existing cases still pass: `503`, honeypot `204`, happy `201`, unpublished `404`, email-fail `201`
- Honeypot case still proves the limiter was not consumed (spy `not.toHaveBeenCalled` or an equivalent “budget unused” assert)
- `npm test -- --run src/pages/api/inquiries/index.test.ts` passes
- `npm test -- --run src/lib/inquiry-abuse.test.ts` still passes
- `npm run lint` passes

#### Manual Verification:

- Open `index.test.ts` and confirm the abuse mock block is gone, `resetInquiryRateLimitBuckets` runs in `beforeEach`, and `createContext` sets `cf-connecting-ip`
- Confirm no production file (`inquiry-abuse.ts`, `index.ts`) changed in this phase

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Characterize 429 ⇒ no insert

### Overview

Add the missing risk #5 proof on the **current** handler: one POST past the published budget returns `429` and does not call `insert`. Characterization of the uncovered branch; no limiter rewrite.

### Changes Required:

#### 1. Flood-reject case

**File**: `src/pages/api/inquiries/index.test.ts`

**Intent**: Drive `POST` with the same valid body, same `cf-connecting-ip`, and same `decorator_profile_id` until the live limiter is exhausted, then send one more request. Assert the extra response is the rate-limit error and persistence did not run.

**Contract**: Import `RATE_LIMIT_MAX_REQUESTS` from `@/lib/inquiry-abuse` (do not hardcode `6` as the only oracle). Mock Supabase so published-profile fetch and `insert` succeed for allowed requests. After `RATE_LIMIT_MAX_REQUESTS` POSTs that return `201`, the next POST must be `429` with `error.code === "RATE_LIMITED"`. `insert` call count must remain `RATE_LIMIT_MAX_REQUESTS` (the extra POST must not call `insert`). `retryAfterMs` in `error.context` may be asserted as a non-negative number; do not copy a wall-clock window as the persistence oracle. Do not add 400/500 cases in this phase.

### Success Criteria:

#### Automated Verification:

- New case exists: one-past-budget `POST` → `429` + `RATE_LIMITED` + `insert` not called for that request
- Oracle uses imported `RATE_LIMIT_MAX_REQUESTS` plus insert-call count (not a hardcoded `6` alone)
- `npm test -- --run src/pages/api/inquiries/index.test.ts` passes
- `npm test -- --run src/lib/inquiry-abuse.test.ts` still passes
- `npm run lint` passes

#### Manual Verification:

- Read the new case and confirm the persistence oracle is “insert not called,” not merely status `429`
- Confirm `src/lib/inquiry-abuse.ts` is still the in-memory `Map` (no KV / Durable Object)
- Confirm this change did not add a CI `npm test` job or a lint rule forbidding the old mock (enforcement stays a later step)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Keep `inquiry-abuse.test.ts` as the leaf proof of the `Map` (window, 5th vs 6th, `cf-connecting-ip` vs `x-forwarded-for`). Do not expand it as a substitute for the handler proof.
- Handler file: real abuse module + mocked Supabase/email. Phase 1 preserves existing cases. Phase 2 adds the compose-seam flood case.

### Integration Tests:

- None. A mocked `insert` that is **not called** is enough to prove “flood is not stored as a lead” at this layer. A real-DB integration would not add signal for #5 once the handler never reaches insert, and it would be a different change.

### Manual Testing Steps:

1. After Phase 1, read `index.test.ts` for the gone mock and the reset / IP header.
2. After Phase 2, read the new case: imported max + insert-count oracle.
3. Optional smoke: `npm test -- --run src/pages/api/inquiries/index.test.ts` and watch the new case name in the reporter. Do not require six curls against `npm run dev` — the Worker isolate `Map` is a different process from Vitest and is not this change’s oracle.

## Performance Considerations

None. Same in-memory `Map`, same 5 / 10 min budget. No new runtime work.

## Migration Notes

Not applicable. Test-only. No schema, env, or Worker binding changes.

## References

- Related research: `context/changes/inquiry-flow-analysis/research.md` (D2b / C-submit first preliminary step; Technical debt §2)
- Test-plan risk #5: `context/foundation/test-plan.md`
- Handler compose: `src/pages/api/inquiries/index.ts:44-49` (limit) and `:73` (insert)
- Limiter: `src/lib/inquiry-abuse.ts:9-62`
- Current mocked handler test: `src/pages/api/inquiries/index.test.ts:17-21`
- Leaf limiter tests: `src/lib/inquiry-abuse.test.ts:33-45`
- Prior product lock (best-effort Map): `context/changes/contact-lead-flow/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Unmock inquiry-abuse in the handler test

#### Automated

- [x] 1.1 `src/pages/api/inquiries/index.test.ts` has no `vi.mock("@/lib/inquiry-abuse")` (and no equivalent stub of `consumeInquiryRateLimit` that forces `{ limited: false }`) — 8be920f
- [x] 1.2 Existing cases still pass: `503`, honeypot `204`, happy `201`, unpublished `404`, email-fail `201` — 8be920f
- [x] 1.3 Honeypot case still proves the limiter was not consumed (spy `not.toHaveBeenCalled` or an equivalent “budget unused” assert) — 8be920f
- [x] 1.4 `npm test -- --run src/pages/api/inquiries/index.test.ts` passes — 8be920f
- [x] 1.5 `npm test -- --run src/lib/inquiry-abuse.test.ts` still passes — 8be920f
- [x] 1.6 `npm run lint` passes — 8be920f
- [x] 1.9 `beforeEach` calls `resetInquiryRateLimitBuckets` and `createContext` sets `cf-connecting-ip` — 8be920f

#### Manual

- [x] 1.7 Open `index.test.ts` and confirm the abuse mock block is gone, `resetInquiryRateLimitBuckets` runs in `beforeEach`, and `createContext` sets `cf-connecting-ip` — 8be920f
- [x] 1.8 Confirm no production file (`inquiry-abuse.ts`, `index.ts`) changed in this phase — 8be920f

### Phase 2: Characterize 429 ⇒ no insert

> Proof **absorbed** by `inquiry-submit-extract` Phase 1. Do not implement this flood case here in parallel.

#### Automated

- [ ] 2.1 New case exists: one-past-budget `POST` → `429` + `RATE_LIMITED` + `insert` not called for that request
- [ ] 2.2 Oracle uses imported `RATE_LIMIT_MAX_REQUESTS` plus insert-call count (not a hardcoded `6` alone)
- [ ] 2.3 `npm test -- --run src/pages/api/inquiries/index.test.ts` passes
- [ ] 2.4 `npm test -- --run src/lib/inquiry-abuse.test.ts` still passes
- [ ] 2.5 `npm run lint` passes

#### Manual

- [ ] 2.6 Read the new case and confirm the persistence oracle is “insert not called,” not merely status `429`
- [ ] 2.7 Confirm `src/lib/inquiry-abuse.ts` is still the in-memory `Map` (no KV / Durable Object)
- [ ] 2.8 Confirm this change did not add a CI `npm test` job or a lint rule forbidding the old mock (enforcement stays a later step)
