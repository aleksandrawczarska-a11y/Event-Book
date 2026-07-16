<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Decorator Onboarding

- **Plan**: context/changes/decorator-onboarding/plan.md
- **Scope**: Phases 1–5 of 5 (full plan)
- **Date**: 2026-07-16
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical / 4 warnings / 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | FAIL |

## Findings

### F1 — Placeholder `POST /api/portfolio` still creates photo-less rows

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/portfolio/index.ts:61
- **Detail**: Phase 5 UI only calls `/api/portfolio/upload`. The Phase 4 `POST` still accepts JSON and inserts `storage_path: pending/{userId}/{entryId}` with default `moderation_status = approved`, so a client can create approved public rows with no photo.
- **Fix A ⭐ Recommended**: Remove or disable `POST` on `/api/portfolio` (keep GET); create only via `/api/portfolio/upload`.
  - Strength: Eliminates dead path and approved photo-less entries.
  - Tradeoff: Breaks any external clients of the placeholder API (none in-repo).
  - Confidence: HIGH — form posts only to upload.
  - Blind spot: None significant.
- **Fix B**: Keep POST but require a non-pending `storage_path` or reject until upload completes.
  - Strength: Preserves metadata-first API if needed later.
  - Tradeoff: Still two create paths to maintain.
  - Confidence: MEDIUM — more surface than needed for MVP.
  - Blind spot: Future S-02 callers unknown.
- **Decision**: FIXED via Fix B — POST requires non-pending owner-scoped storage_path

### F2 — Avatar upload has no storage rollback on DB failure

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/profile/avatar.ts:73
- **Detail**: Storage upload runs before the profile UPDATE. On UPDATE failure the object remains; re-upload with a different extension can also orphan the prior `avatar.*` key. Portfolio upload already rolls back storage on DB failure.
- **Fix**: On DB failure, `remove()` the uploaded object; after success, delete sibling `avatar.*` keys under `{userId}/`.
- **Decision**: FIXED — rollback upload on DB failure; remove sibling avatar.* keys after success

### F3 — API 500 responses leak raw Supabase error messages

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/profile/index.ts:92
- **Detail**: Multiple domain routes return `context: { detail: error.message }` with Postgres/Supabase messages, contrary to `.cursor/rules/api-error-format.mdc`.
- **Fix**: Log full errors server-side; return stable codes/messages without raw `error.message` in client JSON.
- **Decision**: FIXED — removed raw `error.message` from client JSON on profile/portfolio 500s

### F4 — `npm run lint` currently fails (CRLF / prettier across repo)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Success Criteria
- **Location**: repo-wide (eslint .)
- **Detail**: Re-run on 2026-07-16: `npm run build` PASS; `npm run lint` FAIL (~1484 prettier `Delete ␍` / quote errors, including outside change-touched files). Phase Progress recorded lint as passing at each phase SHA — current tree does not satisfy automated Success Criteria.
- **Fix A ⭐ Recommended**: Normalize line endings (LF) for tracked source via Prettier/`core.autocrlf` fix on `src/` + config files, then confirm `npm run lint` green.
  - Strength: Restores CI-quality gate.
  - Tradeoff: Large formatting-only diff may churn unrelated files.
  - Confidence: HIGH — errors are nearly all line-ending / prettier.
  - Blind spot: Whether CI runners already normalize LF and would pass on push.
- **Fix B**: Defer to a dedicated chore commit after review triage.
  - Strength: Keeps review triage focused on product findings.
  - Tradeoff: Success Criteria remain red until fixed.
  - Confidence: HIGH — separate concern from S-01 logic.
  - Blind spot: CI may already be red on this branch.
- **Decision**: FIXED via Fix A — Prettier LF normalize on src/ + configs; CRLF flood cleared (residual ~typed Supabase any + deprecated client remain — ~12 errors)

### F5 — Portfolio list signs URLs with no limit / N+1

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/storage-url.ts:26
- **Detail**: Dashboard loads all entries and calls `createSignedUrl` per row via `Promise.all`. Fine for MVP volumes; grows linearly with portfolio size.
- **Fix**: Add `.limit(N)` or paginate; optionally sign on demand for visible thumbnails.
- **Decision**: FIXED — `.limit(50)` on portfolio list (dashboard + GET /api/portfolio)

### F6 — `PortfolioList.tsx` renamed/merged into `PortfolioPanel.tsx`

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/decorator/PortfolioPanel.tsx:1
- **Detail**: Plan named `PortfolioList.tsx`; implementation is `PortfolioPanel.tsx` embedding list + form. Behavior matches final Phase 5 intent; naming differs.
- **Fix**: No code change required; optional plan addendum noting the rename.
- **Decision**: FIXED — plan addendum notes PortfolioPanel rename

### F7 — Profile routes duplicate auth instead of `requireAuth`

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/profile/index.ts:10
- **Detail**: Portfolio uses `src/lib/api-auth.ts`; profile/avatar reimplement equivalent session checks inline.
- **Fix**: Refactor profile routes to `requireAuth` / `requireDecoratorProfile` for one auth helper pattern.
- **Decision**: FIXED — profile index + avatar use `requireAuth` from api-auth.ts
