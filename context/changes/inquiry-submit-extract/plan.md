# Inquiry Submit Extract Implementation Plan

## Overview

Move the published-inquiry compose step out of `POST /api/inquiries` into `src/lib/inquiry-submit.ts` so the route stays an HTTP shell (JSON, honeypot, zod, status mapping). Characterize the uncovered 429 ⇒ no-insert seam **before** the move. The in-memory limiter `Map` stays.

## Current State Analysis

User locked **B (C-submit)** after the m4l4 option interview. Research: `context/changes/refactor-opportunities/research.md` (unused rank #1) and `context/changes/inquiry-flow-analysis/research.md`.

- `src/pages/api/inquiries/index.ts` still composes the north star inline (7 `@/` imports). Sequence: `createClient` → JSON → honeypot `204` → `parseInquiryBody` → `getInquiryClientIp` + `consumeInquiryRateLimit` → `fetchPublishedDecoratorProfile` → `insert` → fail-soft `sendInquiryNotification` → `201`.
- Other write APIs (`src/pages/api/profile/index.ts`, portfolio) also compose in the route. There is **no** `src/lib/services/` layer. Extract into `src/lib/`, same home as `inquiry-query.ts` / `inquiry-abuse.ts`.
- `inquiry-rate-limit-proof` Phase 1 is on origin (`8be920f`): handler test uses the live limiter. This plan’s Phase 1 (429 ⇒ no insert) **landed** in `408edff` and absorbed the sibling Phase 2 proof. Do not implement `inquiry-rate-limit-proof` Phase 2 in parallel. Sibling Phase 2 stays unchecked with a pointer.
- Plan-review nit F3 on the sibling plan still applies: `createContactInquiryQuery` builds a **new** `insert` fn per POST. A flood needs one shared insert mock (or a dedicated extra-POST insert that must stay unused) and a non-null `createClient` on the extra POST so it 429s instead of 503.
- Handler already returns `jsonError("RATE_LIMITED", …, 429)` at `index.ts:47-50`. The missing proof is now the Phase 1 flood case in `index.test.ts` (`408edff`).

## Desired End State

1. A handler test posts a valid body `RATE_LIMIT_MAX_REQUESTS` times for one IP+profile, then once more: extra POST is `429` / `RATE_LIMITED`, and `insert` is not called for that request.
2. `submitPublishedInquiry` (name may vary; keep it specific) lives in `src/lib/inquiry-submit.ts` with a unit suite on the same branches the handler already covers plus the 429 case.
3. `POST` maps HTTP-only concerns (503, invalid JSON, honeypot, zod) and delegates compose to the helper. No `GET /api/inquiries`. No `services/` folder.
4. User-visible statuses and bodies stay the same (`204` / `400` / `429` / `404` / `500` / `201` + `{ inquiry, notification }`).

### Key Discoveries:

- Query fetch is already in `src/lib/inquiry-query.ts`; persist+notify is the remaining compose blob.
- `CreateContactInquiryInput` in `src/types.ts` is unused (research ast-grep 0) — do not invent a DTO rewrite in this slice.
- Vitest isolate + `resetInquiryRateLimitBuckets` already exist; reuse them.

## What We're NOT Doing

- Re-extract query helpers or move `FormField`.
- KV / Durable Object limiter (C-limiter).
- Finishing `inquiry-rate-limit-proof` as a second, overlapping change (Phase 1 here *is* that 429 proof).
- Auth on the public POST; RLS insert changes; `GET /api/inquiries`.
- Zod in the React form; 204-vs-thanks UI; e2e Resend; ownership e2e #4.
- New `src/lib/services/` precedent.
- Filling every remaining handler gap (`400` JSON, zod field map, profile 500, insert 500) beyond what moves with the extract.
- Payments / chat / calendar.
- CI `npm test` job.

## Implementation Approach

Three commitable phases. Mechanism (live limiter + 429 proof) goes green **before** the move. Enforcement (thin `POST`, leftover-path grep) is last.

**Phase 1** — characterization only on the current `POST`. Add the one-past-budget case. No production edit unless that test is red because insert runs after `limited: true` (then wiring only).

**Phase 2** — extract compose into `src/lib/inquiry-submit.ts`. Point `POST` at it. Move or dual-run the handler tests so they stay green.

**Phase 3** — leftover-path / lint / depcruise. No new layer rules beyond “compose is not inlined in the route.”

## Critical Implementation Details

**Shared insert mock.** Reuse one `insert` fn (and one non-null client) for the whole flood. A new builder per POST makes `toHaveBeenCalledTimes(MAX)` meaningless (sibling review F3).

**What moves.** Extract from rate-limit through notify (inclusive). Leave JSON parse, honeypot, and zod in the route — those are HTTP/body concerns. The helper takes a parsed body + `supabase` + `Headers`; it calls `getInquiryClientIp` internally so IP policy stays next to `consumeInquiryRateLimit`.

**Return shape.** Discriminated result (`limited` / `profile_error` / `not_found` / `insert_failed` / `ok`) so `POST` only maps to `Response`. Do not throw for expected domain outcomes.

## Phase 1: Characterize 429 ⇒ no insert

### Overview

Prove risk #5 on the **current** handler before any extract.

### Changes Required:

#### 1. Handler flood case

**File**: `src/pages/api/inquiries/index.test.ts`

**Intent**: After `RATE_LIMIT_MAX_REQUESTS` successful-enough POSTs (published profile + insert mock), one more valid POST returns `429` and does not call `insert`.

**Contract**: Import `RATE_LIMIT_MAX_REQUESTS`. Shared insert mock for the flood. Extra POST still has `createClient` non-null. Oracle is insert-call count (or a dedicated unused insert), not a hardcoded `6` alone.

### Success Criteria:

#### Automated Verification:

- New case: one-past-budget `POST` → `429` + `RATE_LIMITED` + `insert` not called for that request
- Oracle uses imported `RATE_LIMIT_MAX_REQUESTS` plus insert-call count
- `npm test -- --run src/pages/api/inquiries/index.test.ts` passes
- `npm test -- --run src/lib/inquiry-abuse.test.ts` still passes
- `npx eslint src/pages/api/inquiries/index.test.ts` passes

#### Manual Verification:

- Read the new case: persistence oracle is “insert not called,” not merely status `429`
- Confirm `inquiry-abuse.ts` is still the in-memory `Map` (no KV / DO)
- Confirm this phase did not extract `submitPublishedInquiry` yet

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding.

---

## Phase 2: Extract `submitPublishedInquiry`

### Overview

Move rate-limit → profile → insert → notify into `src/lib/inquiry-submit.ts`. `POST` becomes the HTTP adapter.

### Changes Required:

#### 1. Compose helper

**File**: `src/lib/inquiry-submit.ts` (new)

**Intent**: One function owns the published-inquiry compose. Same statuses/side effects as today’s `index.ts:45-91`.

**Contract**: Named export. Inputs: Supabase client, parsed inquiry fields, `Headers`. Resolve IP with `getInquiryClientIp` inside the helper. Output: discriminated union the route can map without re-querying.

#### 2. Helper tests

**File**: `src/lib/inquiry-submit.test.ts` (new)

**Intent**: Characterize limited / not-found / insert / notify-fail-soft / happy. Reuse the flood oracle from Phase 1 at this layer or keep it on the handler — do not drop it.

#### 3. Thin route

**File**: `src/pages/api/inquiries/index.ts`

**Intent**: Keep 503, JSON catch, honeypot, zod + `validationFailed`. Call the helper and map results to existing `jsonError` / `201` bodies.

### Success Criteria:

#### Automated Verification:

- `src/lib/inquiry-submit.ts` exists and is the only production caller of `consumeInquiryRateLimit` and of `contact_inquiries` `.insert(` (inbox `listInquiriesForProfile` may still `.from("contact_inquiries")` for select)
- `POST` still exports from `index.ts`; no `submitInquiry` name collision required
- `npm test -- --run src/lib/inquiry-submit.test.ts src/pages/api/inquiries/index.test.ts` passes
- `npx eslint` on the touched TS files passes

#### Manual Verification:

- Published `/d/:id` still submits a valid inquiry (201 / thanks). No new copy.
- Confirm the route file no longer inlines `insert(` / `sendInquiryNotification` (helper does).

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Enforce the thin POST

### Overview

Leftover-path and graph checks. No new CI job.

### Changes Required:

#### 1. Leftover compose

**File**: `src/pages/api/inquiries/index.ts`

**Intent**: Route has no `from("contact_inquiries")` and no direct `consumeInquiryRateLimit` if those moved.

#### 2. Lint / graph

**Intent**: `npm run lint` on touched files; `npm run depcruise` stays clean. Do not add a `services/` forbidden-layer rule unless one already exists.

### Success Criteria:

#### Automated Verification:

- `rg "from\\(\"contact_inquiries\"\\)" src/pages/api/inquiries/index.ts` is empty
- `rg "consumeInquiryRateLimit" src/pages/api/inquiries/index.ts` is empty
- `rg "fetchPublishedDecoratorProfile" src/pages/api/inquiries/index.ts` is empty
- `rg "sendInquiryNotification" src/pages/api/inquiries/index.ts` is empty
- `npm run depcruise` finds no circular modules / no new forbidden edges
- `npx eslint` on touched inquiry files passes

#### Manual Verification:

- Same two screens as Phase 2: sign-in unaffected; Flora inquiry labels unchanged.

---

## Testing Strategy

### Unit Tests:

- Phase 1 flood on the live limiter + shared insert mock
- Phase 2 helper: limited, missing published profile, insert error, email fail-soft, happy

### Integration Tests:

- None new. Existing e2e #3 (happy path) remains the browser net.

### Manual Testing Steps:

1. Read the 429 case and confirm insert is the oracle
2. Submit one valid inquiry on a published profile
3. Confirm no new user-facing copy

## Performance Considerations

None. Same limiter `Map`, same one insert.

## Migration Notes

Leave `inquiry-rate-limit-proof` Phase 2 unchecked. When this change’s Phase 1 lands, note on that plan that the proof moved here (do not silently mark it done without a pointer).

## References

- Research: `context/changes/refactor-opportunities/research.md` (C-submit)
- Sibling: `context/changes/inquiry-rate-limit-proof/plan.md` (Phase 1 done; Phase 2 absorbed)
- Handler: `src/pages/api/inquiries/index.ts`
- Pattern: `src/lib/inquiry-query.ts` (lib extract, not services)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Characterize 429 ⇒ no insert

#### Automated

- [x] 1.1 New case: one-past-budget `POST` → `429` + `RATE_LIMITED` + `insert` not called for that request — 408edff
- [x] 1.2 Oracle uses imported `RATE_LIMIT_MAX_REQUESTS` plus insert-call count — 408edff
- [x] 1.3 `npm test -- --run src/pages/api/inquiries/index.test.ts` passes — 408edff
- [x] 1.4 `npm test -- --run src/lib/inquiry-abuse.test.ts` still passes — 408edff
- [x] 1.5 `npx eslint src/pages/api/inquiries/index.test.ts` passes — 408edff

#### Manual

- [x] 1.6 Read the new case: persistence oracle is “insert not called,” not merely status `429` — 408edff
- [x] 1.7 Confirm `inquiry-abuse.ts` is still the in-memory `Map` (no KV / DO) — 408edff
- [x] 1.8 Confirm this phase did not extract `submitPublishedInquiry` yet — 408edff

### Phase 2: Extract `submitPublishedInquiry`

#### Automated

- [x] 2.1 `src/lib/inquiry-submit.ts` exists and is the only production caller of `consumeInquiryRateLimit` and of `contact_inquiries` `.insert(` (inbox `listInquiriesForProfile` may still `.from("contact_inquiries")` for select) — cbded39
- [x] 2.2 `POST` still exports from `index.ts` — cbded39
- [x] 2.3 `npm test -- --run src/lib/inquiry-submit.test.ts src/pages/api/inquiries/index.test.ts` passes — cbded39
- [x] 2.4 `npx eslint` on the touched TS files passes — cbded39

#### Manual

- [x] 2.5 Published `/d/:id` still submits a valid inquiry (201 / thanks). No new copy. — cbded39
- [x] 2.6 Confirm the route file no longer inlines `insert(` / `sendInquiryNotification` — cbded39

### Phase 3: Enforce the thin POST

#### Automated

- [x] 3.1 `rg "from(\"contact_inquiries\")" src/pages/api/inquiries/index.ts` is empty
- [x] 3.2 `rg "consumeInquiryRateLimit" src/pages/api/inquiries/index.ts` is empty
- [x] 3.3 `npm run depcruise` finds no circular modules / no new forbidden edges
- [x] 3.4 `npx eslint` on touched inquiry files passes
- [x] 3.6 `rg "fetchPublishedDecoratorProfile" src/pages/api/inquiries/index.ts` is empty
- [x] 3.7 `rg "sendInquiryNotification" src/pages/api/inquiries/index.ts` is empty

#### Manual

- [ ] 3.5 Sign-in unaffected; Flora inquiry labels unchanged
