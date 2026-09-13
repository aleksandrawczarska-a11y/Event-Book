<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Inquiry Submit Extract

- **Plan**: context/changes/inquiry-submit-extract/plan.md
- **Mode**: Deep
- **Date**: 2026-09-13
- **Verdict**: SOUND
- **Findings**: 0 critical 2 warnings 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 6/6 paths ✓ (`index.ts`, `index.test.ts`, `inquiry-abuse.ts`, `inquiry-query.ts`, `inquiry-email.ts`, `profile/index.ts`), 5/5 symbols ✓ (`consumeInquiryRateLimit`, `fetchPublishedDecoratorProfile`, `sendInquiryNotification`, `contact_inquiries.insert`, `RATE_LIMIT_MAX_REQUESTS`), brief↔plan ✓ (phases match; brief **Starting Point** is stale — see F3).

Phase 1 is already on HEAD (`408edff`). This review is a fresh pass for remaining Phases 2–3. `change.md` stays `implementing` (do not regress to `plan_reviewed`).

## m4l4 krok 4 bars

| Bar | Score |
|-----|--------|
| Characterization first | **PASS** — Phase 1 landed before any extract |
| Commitable phases | **PASS** |
| Auto + manual | **PASS** — Progress matches Success Criteria 1:1 |
| Mechanism then enforcement | **PASS** — leftover grep is Phase 3; no CI test job |

## Findings

### F1 — Phase 2.1 “inquiry insert” can match the inbox select

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 Success Criteria 2.1
- **Detail**: `src/lib/inquiry-query.ts:24` already calls `.from("contact_inquiries")` (select). A naive table-name grep fails 2.1. Production **insert** today is only `index.ts:73`. `consumeInquiryRateLimit` production caller today is only `index.ts:46`.
- **Fix**: Treat 2.1 as “only production `.insert(` on `contact_inquiries`” plus `consumeInquiryRateLimit` leaving the route. Do not require `listInquiriesForProfile` to stop reading the table.
- **Decision**: FIXED (clarify 2.1 to insert-only + consumeInquiryRateLimit)

### F2 — Phase 3 leftover greps miss compose stragglers

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 Automated Verification
- **Detail**: Plan “What moves” is rate-limit through notify (inclusive), including `fetchPublishedDecoratorProfile` (`index.ts:53`) and `sendInquiryNotification` (`index.ts:85`). Phase 3 only greps `from("contact_inquiries")` and `consumeInquiryRateLimit`. An incomplete extract that leaves profile fetch + email in the route still passes 3.1–3.2. Phase 2 manual 2.6 names `sendInquiryNotification` but that is not an automated leftover check.
- **Fix A ⭐ Recommended**: Add Phase 3 greps (or Progress 3.6/3.7, do not renumber 3.1–3.5) that `index.ts` has no `fetchPublishedDecoratorProfile` and no `sendInquiryNotification`.
  - Strength: Enforcement matches “what moves”; cheap.
  - Tradeoff: Two extra Progress rows if we do not reuse 3.1/3.2 titles.
  - Confidence: HIGH — both symbols exist only on the handler besides tests / `d/[id].astro` (profile fetch stays valid on the page).
  - Blind spot: None significant.
- **Fix B**: Rely on Phase 2 manual 2.6 only.
  - Strength: No plan-shape change.
  - Tradeoff: Incomplete extract can ship if 2.6 is rubber-stamped.
  - Confidence: MED — manuals were honored in this repo, but the lesson wants leftover-path automation.
  - Blind spot: Implementer may “keep profile fetch in POST” as HTTP-adjacent.
- **Decision**: FIXED (Fix A — Progress 3.6 / 3.7 leftover greps)

### F3 — Current State / brief still say the flood is missing

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Current State Analysis; plan-brief Starting Point
- **Detail**: Phase 1 is done. CSA still says “proof does not” / sibling Phase 2 not implemented. Brief line 11: “The 429 flood case is still missing.” Contradicts Progress 1.1–1.8 and `index.test.ts:261-300`.
- **Fix**: Stamp CSA/brief “Phase 1 landed `408edff`.” Leave sibling Phase 2 unchecked (pointer already on that plan).
- **Decision**: FIXED (stamp Phase 1 landed `408edff`)

### F4 — Helper input is Headers or IP

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Critical Implementation Details / Phase 2 Contract
- **Detail**: “Headers or already-resolved IP” leaves the implementer to guess. `getInquiryClientIp` is only used by the handler today (`index.ts:45`). Either is fine if the helper still consumes the limiter with the same IP as `cf-connecting-ip`.
- **Fix**: Lock one: pass `Headers` and call `getInquiryClientIp` inside the helper (keeps IP policy next to `consumeInquiryRateLimit`).
- **Decision**: FIXED (lock Headers + getInquiryClientIp in the helper)
