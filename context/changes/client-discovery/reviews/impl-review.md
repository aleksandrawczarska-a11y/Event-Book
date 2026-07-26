<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Client Discovery

- **Plan**: context/changes/client-discovery/plan.md
- **Scope**: Phases 1–3 of 3 (full plan)
- **Date**: 2026-07-17
- **Verdict**: NEEDS ATTENTION → triaged (all findings decided)
- **Findings**: 0 critical / 3 warnings / 4 observations (all decided)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Instagram `href` accepts non-http(s) schemes

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/d/[id].astro:117
- **Detail**: Public profile renders `href={profile.instagram_url}` with `target="_blank"`. `profile-schema.ts` stores `instagram_url` as optional trimmed text (no URL/scheme check), so a decorator can persist `javascript:…` / `data:…` and browsers may execute it on click.
- **Fix A ⭐ Recommended**: Validate `https?://` on write in `profile-schema.ts` and skip/sanitize non-http(s) at render before emitting `href`.
  - Strength: Closes the class at the write boundary and defends the public page.
  - Tradeoff: Decorators with bare handles (`@name`) must use full URLs.
  - Confidence: HIGH — standard URL scheme allowlist.
  - Blind spot: Existing bad rows until re-save.
- **Fix B**: Sanitize only at render on `/d/[id]` (leave schema as-is for MVP).
  - Strength: Smallest discovery-scoped patch.
  - Tradeoff: Bad values remain in DB; other future surfaces can forget to sanitize.
  - Confidence: HIGH — one call site today.
  - Blind spot: Profile form preview if it ever links out.
- **Decision**: FIXED via Fix A — https? validation in profile-schema + toSafeHttpUrl at /d/[id] render

### F2 — Search page surfaces raw Supabase error messages

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/search.astro:25
- **Detail**: `fetchPublishedDecorators` throws `new Error(error.message)`; search catches and renders `loadError` in HTML to anonymous users. Can leak PostgREST/RLS/schema hints. Same class fixed on decorator APIs in S-01 impl-review.
- **Fix**: Log server-side; show a stable generic message (e.g. "Failed to load decorators").
- **Decision**: FIXED — console.error + generic "Failed to load decorators" for clients

### F3 — Page clamp does not match query offset

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/discovery-query.ts:69
- **Detail**: `from`/`to` use unclamped `filters.page`, then the result clamps `page = Math.min(filters.page, totalPages)`. Out-of-range `?page=` yields empty rows while UI metadata says the last page. Unbounded large `page` also produces huge PostgREST `range` offsets.
- **Fix**: Clamp `page` to `[1, totalPages]` before computing `from`/`to` (requires count-first or a second query when page exceeds total), and/or reject absurd page values early.
- **Decision**: FIXED — DISCOVERY_MAX_PAGE cap at parse; re-query with clamped range when page > totalPages

### F4 — Unplanned `astro.config.mjs` optimizeDeps exclude

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: astro.config.mjs:18
- **Detail**: Commit bundled `optimizeDeps.exclude` for `astro:env*` (dev cache fix). Not in the discovery plan; related to local Vite/`astro:env` breakage during S-02 work.
- **Fix**: Keep and note as addendum in plan Progress notes (no code change).
- **Decision**: FIXED — kept optimizeDeps exclude; addendum noted in plan Progress

### F5 — Unit tests omit `fetchPublishedDecorators`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/discovery-query.test.ts:1
- **Detail**: Plan item 1.1 asked for discovery query helper + unit tests. Tests cover `parseDiscoverySearchParams` / `buildDiscoverySearchHref` only — not filter composition, pagination, or error path for `fetchPublishedDecorators` (would need a mocked Supabase client).
- **Fix**: Add mocked-client tests for published filter, overlaps/ilike wiring, and page-clamp behavior (pairs with F3).
- **Decision**: FIXED — mocked Supabase tests for filters, page-clamp re-query, and error path

### F6 — Search list over-selects contact fields

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/lib/discovery-query.ts:74
- **Detail**: List query selects `contact_email`, `contact_phone`, `instagram_url`, `description`, `user_id`, but search cards only use id/name/city/photo/chips. Broader than needed for a public list response path.
- **Fix**: Narrow `select()` to fields used by `search.astro`.
- **Decision**: FIXED differently — keep full select for MVP; noted in plan addendum

### F7 — Up to 24 signed URL calls per search page

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/search.astro:32
- **Detail**: Each result card resolves avatar via `createSignedUrl` (Promise.all fan-out ≤24). Acceptable for MVP page size; may add latency under load.
- **Fix**: Defer or batch later; no change required for S-02 close-out.
- **Decision**: FIXED — deferred batch/cache; noted in plan addendum (no code change for S-02)
