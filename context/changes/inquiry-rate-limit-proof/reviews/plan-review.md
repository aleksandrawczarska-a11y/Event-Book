<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Inquiry Rate-Limit Proof Implementation Plan

- **Plan**: context/changes/inquiry-rate-limit-proof/plan.md
- **Mode**: Deep
- **Date**: 2026-09-13
- **Verdict**: SOUND
- **User verdict**: ready-with-nits
- **Findings**: 0 critical 3 warnings 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 6/6 paths ✓ (Read; shell `ls -l` blocked by sandbox), 5/5 symbols ✓, brief↔plan ✓

Paths present: `src/pages/api/inquiries/index.test.ts`, `src/pages/api/inquiries/index.ts`, `src/lib/inquiry-abuse.ts`, `src/lib/inquiry-abuse.test.ts`, `.github/workflows/ci.yml` (lint + build only), `src/lib/api-error.ts`.

Symbols present: `consumeInquiryRateLimit`, `resetInquiryRateLimitBuckets`, `getInquiryClientIp`, `RATE_LIMIT_MAX_REQUESTS` (exported), `vi.mock("@/lib/inquiry-abuse")` at `index.test.ts:17-21`.

Brief↔plan: slice A, Map stays, Phase 1 unmock / Phase 2 429+no-insert, no CI/KV/ownership/204/C-submit — match.

## m4l4 krok 4 bars

| Bar | Score |
|-----|--------|
| 1. Characterization before touching uncovered code | **PASS** — Phase 2 is the 429 characterization. No production edit is planned. Phase 1 only changes the test harness of already-covered cases. |
| 2. Phases separately commitable, easiest first | **PASS** (nit: Phase 1 is prerequisite, not strictly easier) — two test-only commits. Phase 2 cannot prove the live limiter while the mock remains, so unmock first is the correct order. |
| 3. Each phase has auto + manual verification | **PASS** — both phases have both; Progress `1.1–1.8` / `2.1–2.8` match Success Criteria 1:1. One `## Progress`, no checkboxes in phase bodies. |
| 4. Mechanism green first; enforcement later | **PASS** — Phase 1 makes the real limiter participate; Phase 2 is the proof; CI/`npm test` job and lint-forbidding-the-mock stay out. |

## Findings

### F1 — Phase 1 automated gates can pass without reset or IP header

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 Success Criteria / Progress 1.1–1.6
- **Detail**: After unmock, only three existing cases reach `consumeInquiryRateLimit` (happy 201, unpublished 404, email-fail 201). 503 and honeypot return earlier (`index.ts:20-22`, `:35-36`). Budget is 5. Without `resetInquiryRateLimitBuckets()` and without `cf-connecting-ip`, all three share `unknown:11111111-1111-1111-1111-111111111111` and finish at count 3 — Phase 1 `npm test` still passes. Changes Required and manual 1.7 already name reset + header; automated 1.1–1.6 do not. A Phase 1 commit that skips them leaves Phase 2’s flood starting at count 3 (only two more 201s before 429).
- **Fix**: Add one automated Phase 1 criterion (and Progress 1.9, do not renumber) that `beforeEach` calls `resetInquiryRateLimitBuckets` and `createContext` sets `cf-connecting-ip` — or treat 1.7 as a hard Phase 1 exit, not optional reading.
- **Decision**: PENDING

### F2 — Honeypot spy has no repo precedent and can be tautological

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — honeypot “limiter not consumed” invariant
- **Detail**: Today the honeypot case asserts `consumeInquiryRateLimitMock.not.toHaveBeenCalled()` (`index.test.ts:102`). After unmock the plan allows `vi.spyOn` on the real export. This repo has **no** `vi.spyOn` in any `src/**/*.test.ts` — only `vi.mock` / `vi.fn`. The handler uses a static named import (`index.ts:4`); the test dynamic-imports `POST` every `beforeEach` (`index.test.ts:64-65`) and the module stays cached. A spy installed after the first `import("./index")`, or a spy that does not wrap the handler’s binding, makes `not.toHaveBeenCalled()` pass even if a future regression called `consume` on the honeypot path. The plan’s fallback (“budget unused”) is the stronger oracle and is under-specified.
- **Fix A ⭐ Recommended**: After the honeypot `204`, call `consumeInquiryRateLimit` with the same IP + `decorator_profile_id` and expect `remaining === RATE_LIMIT_MAX_REQUESTS - 1` (Map unused). No spy, no new pattern.
  - Strength: Observes the real `Map`; matches the test-plan “don’t copy 6 as the only oracle” spirit; works even if ESM spy misses the handler binding.
  - Tradeoff: Honeypot test now imports limiter helpers and spends one diagnostic consume (reset still clears it for the next test).
  - Confidence: HIGH — `remaining` on first consume of an empty bucket is `RATE_LIMIT_MAX_REQUESTS - 1` (`inquiry-abuse.ts:49-52`).
  - Blind spot: None significant if `beforeEach` resets.
- **Fix B**: `vi.spyOn` the module **before** the first `import("./index")`, then keep `not.toHaveBeenCalled()`.
  - Strength: Closest to today’s assert; less setup than a diagnostic consume.
  - Tradeoff: First `vi.spyOn` in this repo; ordering footgun with the cached dynamic import.
  - Confidence: MEDIUM — Vitest 4 named-export spies usually work; this tree has no proof.
  - Blind spot: Interop of `@/` alias + `import { consumeInquiryRateLimit }` vs namespace spy not executed here.
- **Decision**: PENDING

### F3 — Flood insert-count oracle needs one shared insert mock

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 Contract
- **Detail**: `createContactInquiryQuery` builds a fresh `insert = vi.fn(...)` per builder (`index.test.ts:31-34`). Happy path already reuses one builder (`index.test.ts:114-127`). Phase 2 says “insert call count must remain `RATE_LIMIT_MAX_REQUESTS`” but does not say to reuse **one** insert fn across all `MAX + 1` POSTs. A new query object per iteration makes `toHaveBeenCalledTimes(MAX)` meaningless. The extra POST must also see a non-null `createClient` (limit runs after `index.ts:19-22`); a 503 on request 6 is not a 429.
- **Fix**: In the Phase 2 contract, require one `inquiryInsertQuery` + one non-null client mock for the whole flood, then `insert` times === `RATE_LIMIT_MAX_REQUESTS` after the extra POST (or a dedicated insert mock used only for the extra POST with `not.toHaveBeenCalled()`).
- **Decision**: PENDING

### F4 — Cross-file Map sharing is overstated

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Current State Analysis — “same Map is shared with `inquiry-abuse.test.ts`”
- **Detail**: `vitest.config.ts` has no `pool`/`isolate` overrides. Vitest ^4.1.8 defaults are `pool: 'forks'` and `isolate: true` — each test file gets a fresh module graph. `inquiry-abuse.test.ts` also keys `203.0.113.10` + `"profile-1"`, not the handler UUID. Cross-file collision is unlikely. `resetInquiryRateLimitBuckets()` is still required **inside** `index.test.ts` (same cached module, no `vi.resetModules()`). `callsSinceSweep` is not cleared by reset; six calls ≪ sweep interval 100 — immaterial.
- **Fix**: In Current State, say reset is for same-file isolation, not because the abuse unit shares the Map under default Vitest 4.
- **Decision**: PENDING

## Notes for implement (not findings)

- Handler wiring is already correct: `limited` returns at `index.ts:46-49`; insert is `index.ts:73`. Phase 2 is expected green. Do not touch production unless that test is red.
- `jsonError` shape matches the plan: `{ error: { code, message, context } }` (`api-error.ts:9-15`).
- Sole TS write to `contact_inquiries` is this handler. Form / e2e / inbox are blast-radius readers, not this change.
- Progress section is mechanically valid for `/10x-implement`.
