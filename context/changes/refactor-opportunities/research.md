---
date: 2026-09-13T15:20:00+02:00
researcher: 10x-research (m4l4 Element ④)
git_commit: ae815bb6c681148080f96462c01d51ed979ff56d
branch: cursor/domain-schema-foundation-change-tracking
repository: Event-Book
topic: "Which inquiry-flow technical-debt items are worth fixing, in what target shape, and in what order?"
tags: [research, codebase, inquiry, refactor-opportunities, verified]
status: complete
last_updated: 2026-09-13
last_updated_by: 10x-research (m4l4 Element ④ + Krok 2; post-plan merge note)
last_updated_note: "Dedicated explorer report kept after a late write. Ranking + Krok 2 audit unchanged. Planning already locked C-formfield-home → src/components/forms/ (see plan.md). Verification baseline commit ae815bb6c681148080f96462c01d51ed979ff56d."
---

# Research: Refactor opportunities after inquiry-flow-analysis

**Date**: 2026-09-13T15:20:00+02:00
**Researcher**: 10x-research (m4l4 Element ④)
**Git Commit**: ae815bb6c681148080f96462c01d51ed979ff56d
**Branch**: cursor/domain-schema-foundation-change-tracking
**Repository**: Event-Book

Working-tree note: HEAD already contains `src/lib/inquiry-query.ts` and rewires POST + inbox. Disk also has uncommitted edits to `d/[id].astro` (helper switch), `inquiry-abuse.ts` (sweep + DO/KV comment), and `FormField.tsx` (`multiline`). This report describes **files as read on disk** on 2026-09-13 and tags HEAD-vs-disk where they differ.

## Research Question

`context/changes/inquiry-flow-analysis/research.md` recorded technical debt and structural risk on the inquiry / contact-lead north star and left open: **which of those problems are worth a structural fix, in what named target shape, and in what order?** Explore each recorded problem in current code and history; rank them as refactor opportunities. No refactor and no implementation decision in this document.

## Summary

The analysis’s §③ list is complete and classifiable. Four items are **candidates** (structure would change): C-query-helpers, C-submit, C-formfield-home, C-limiter. Everything else is **input to a later /10x-plan** (missing tests, product copy, guest-write surface).

C-query-helpers is **mostly shipped** on HEAD (`ae815bb`): `fetchPublishedDecoratorProfile` / `listInquiriesForProfile` are used by POST and the inbox. The public profile page still inlines the published-by-id query **in the HEAD blob**; the working tree already calls the helper. That leftover is finishing the shipped change, not a new candidate.

Among **unused** candidates, the remaining structural debt on the north star is the POST composer (C-submit, now **7** production imports — raport: 6). Its first preliminary step is a characterization test already scoped as the sibling change `inquiry-rate-limit-proof` (plan reviewed, not implemented). C-formfield-home is a cheap folder move that does not pay test-plan #3/#4/#5. C-limiter stays a świadome MVP constraint.

Ranking below is a **proposal** written as exploration (not a lock). A later planning session already chose **C-formfield-home** → `src/components/forms/` — see `plan.md` / `plan-brief.md`. Do not treat unused-rank #1 (C-submit) as this change’s slice.

## Problem list and classification

Every item from inquiry-flow-analysis §③ Technical debt, plus traces T-Ce / T-dup / T-dto / T-val. **Candidate** = a fix that would change code structure. Everything else is feasibility / cost input to /10x-plan.

| # | Problem (from analysis §③ / traces) | Class | Why |
|---|--------------------------------------|-------|-----|
| D1 | Honeypot `204` and real `201` share the thanks UI | **input to /10x-plan** | Product / anti-enumeration contract, not a structure change. |
| D2a | Rate-limit `Map` is per-isolate | **candidate C-limiter** | Replacing the store (Durable Object / KV) would change runtime structure. |
| D2b | No test that 429 ⇒ no `insert` | **input to /10x-plan** | Missing proof. Already the whole of `inquiry-rate-limit-proof`. Cheap gate for C-submit or C-limiter. |
| D3a | Email fail-soft easy to misread as “delivered” | **input to /10x-plan** | Intentional channel split (test-plan #3). Docs / ops, not structure. |
| D3b | No `inquiry-email.test.ts` | **input to /10x-plan** | Missing test. |
| D3c | Handler-built `created_at` vs DB `created_at` | **input to /10x-plan** | Tiny consistency nit. |
| D4a | Inbox ownership query lived in `.astro` + RLS | **candidate C-query-helpers** | Extract (keeping SSR, no GET API) moves structure on-graph. **Mostly shipped.** |
| D4b | No A-vs-B read test | **input to /10x-plan** | Missing integration. Helper extract did not add it. |
| D5 | Off-graph shells mount and display the lead | **candidate C-query-helpers** | Same candidate as D4a. Cruiser config is tooling, not this candidate. |
| D6 | `FormField` in `components/auth` couples e2e #3 to four other islands | **candidate C-formfield-home** | Moving the primitive changes folder structure. Sharing it is not the bug. |
| D7 | Handler unit skips 400 / 429 / 500 insert branches | **input to /10x-plan** | Missing tests. Characterization before C-submit. |
| D8 | Public write is anon-wide | **input to /10x-plan** | Guest lead-gen by design. Auth-gating the POST is a product change. |
| T-Ce | Handler was the only API route with Ce=6 | **candidate C-submit** | Further extraction of the compose step would change structure. Leaves already exist. Ce is now 7 after `inquiry-query`. |
| T-dup | Published-by-id check written twice (page + POST) | **candidate C-query-helpers** | Same helper as D4a/D5. On disk the helper is the single by-id site; HEAD `d/[id].astro` still duplicates. |
| T-dto | `CreateContactInquiryInput` is unused | **input to /10x-plan** | Dead type hygiene. |
| T-val | Local `validationFailed` copied in inquiries + profile handlers | **not a candidate** | Two-line mapper; messages differ. Below the slice. |

**Candidates investigated:** C-query-helpers, C-submit, C-formfield-home, C-limiter.

There is no `src/lib/services/` today (**evidence**: glob empty; grep `@/lib/services` / `submitInquiry` under `src` = 0). Any “service” file would be a new layer.

## Detailed Findings

### C-query-helpers — current shape / intentionality / feasibility

**Current shape (evidence):**

- Helper module: `src/lib/inquiry-query.ts:7-16` `fetchPublishedDecoratorProfile` (`.eq("id")` + `.eq("is_published", true)` + `maybeSingle`); `:18-40` `listInquiriesForProfile` (newest first, `limit + 1`, slice, `hasMoreThanLimit`); `:5` `INQUIRIES_PAGE_LIMIT = 50`.
- Wired callers on **disk**: `src/pages/api/inquiries/index.ts:6,53-57`; `src/pages/dashboard/inquiries.astro:3,21-23`; `src/pages/d/[id].astro:5,21`.
- HEAD vs disk: `git show HEAD:src/pages/d/[id].astro` still inlines `.from("decorator_profiles")` + `.eq("is_published", true)`. The helper switch on that page is **uncommitted**. POST and inbox are committed in `ae815bb`.
- Remaining inline PostgREST (out of the shipped first step): inbox still does `user_id` → profile id (`dashboard/inquiries.astro:17`); same pattern at `dashboard/portfolio.astro:15`, `dashboard/profile.astro:15`, `dashboard.astro:23`, `api-auth.ts:38`. Discovery list filter stays in `discovery-query.ts:73` (not by-id). Insert stays in the handler (`index.ts:73`).
- Characterization: `src/lib/inquiry-query.test.ts` covers published-only, column pass-through, list order/limit/overflow/error.

**Target shape (name only):** the helpers that already exist. Remaining named leftover is `fetchDecoratorProfileIdByUserId` **or** finishing the `d/[id].astro` commit — not a new north-star extract. No GET `/api/inquiries`.

**Intentionality: świadome ograniczenie** against a list API; **przypadkowa złożoność** for the pre-extract duplicate published-by-id SQL; **świadome** for the extract itself.

- **Evidence (no GET API):** `context/changes/contact-lead-flow/plan.md` — panel is direct SSR, “same pattern as `dashboard/portfolio.astro` — no list GET API.” Plan-review F1 locked SSR and moved GET to “What We're NOT Doing.” Commit `b210f67` body: “`/dashboard/inquiries` SSR panel (mirrors `dashboard/portfolio.astro`).”
- **Evidence (extract):** `inquiry-query-helpers/plan.md` — duplicated published-by-id SQL is accidental; analog is `discovery-query.ts`. Commit `ae815bb`: “extract published-profile and inbox list queries into a shared lib so pages and the API share one characterized path.”
- **Unknown:** whether a later plan should also lift `requireDecoratorProfile` (blast includes `api-auth` and four portfolio handlers). Explicitly out of the shipped first step.

**Feasibility:** Core extract is reversible (revert helper + three imports). First preliminary step for the **original** candidate was D4b (A-vs-B) — **not done**. First remaining step on disk: commit or revert the `d/[id].astro` helper switch so HEAD matches the intended callers. CI is lint + build only (`.github/workflows/ci.yml:20-21`); Vitest is local.

### C-submit — current shape / intentionality / feasibility

**Current shape (evidence):**

- `POST` in `src/pages/api/inquiries/index.ts:19-92` is still the composer: `createClient` → JSON → honeypot → `parseInquiryBody` → IP + `consumeInquiryRateLimit` → `fetchPublishedDecoratorProfile` → insert → assemble `ContactInquiry` → `sendInquiryNotification` → `201`.
- Seven production imports (`index.ts:3-9`): `api-error`, `inquiry-abuse`, `inquiry-email`, `inquiry-query`, `inquiry-schema`, `supabase`, `types`. No `api-auth`. **7 (raport: 6)** — the extra import is the shipped helper.
- Leaves already exist. `submitInquiry` does not exist under `src`. No `src/lib/services/`.
- Production call-sites of `parseInquiryBody`, `sendInquiryNotification`, `consumeInquiryRateLimit` remain this handler only (tests aside).
- Unit test mocks `@/lib/supabase`, `@/lib/inquiry-email`, `@/lib/inquiry-abuse` (`index.test.ts:9-21`). Still **no** 429 ⇒ no insert, invalid JSON 400, insert 500.

**Target shape (name only):** a `submitInquiry` (or equivalent) function in `lib` that owns the sequence after a live client exists; the route maps HTTP ↔ result. Not a new domain model. Not a `services/` folder unless a later plan invents one.

**Intentionality: świadome ograniczenie** (handler-as-composer is the house API pattern).

- **Evidence:** `contact-lead-flow/plan.md` — “Server-owned submit boundary (`POST /api/inquiries`) mirrors profile/portfolio APIs.” `b210f67` lists the sequence in the route. Profile POST still composes inline. `inquiry-query-helpers/plan.md` and `inquiry-rate-limit-proof/plan.md` both say do not extract `submitInquiry` in those slices.
- **Unknown:** whether the team wants a `services/` layer that no other API uses. Flag for the plan interview; do not invent it in research.

**Feasibility:** One new file + handler rewire. Reversible. Blast: `index.ts` + `index.test.ts`. **Missing** characterization: 429 ⇒ no insert (D2b / D7) — already scoped as `inquiry-rate-limit-proof` (status `plan_reviewed`, progress unchecked). First preliminary step: those tests on the **current** handler, then move. CI will not run Vitest until test-plan Phase 3.

### C-formfield-home — current shape / intentionality / feasibility

**Current shape (evidence):** `FormField` lives at `src/components/auth/FormField.tsx:24` (named export). Five import sites, all `@/components/auth/FormField`: `SignInForm.tsx:3`, `SignUpForm.tsx:3`, `ContactInquiryForm.tsx:5`, `ProfileForm.tsx:5`, `PortfolioEntryForm.tsx:5`. Twenty JSX openings; five on the inquiry form at `ContactInquiryForm.tsx:119,:130,:145,:157,:170`. E2E #3 locates fields by accessible name (`tests/e2e/inquiry-confirmation-reaches-decorator.spec.ts`). Folder `auth` is not a feature boundary (repo-map).

**Target shape (name only):** shared form primitive under `components/ui` or `components/forms`; `auth/` no longer implying “login only.”

**Intentionality: świadome** reuse of the primitive; **unknown** (not a recorded “never move”) for why bootstrap put it under `auth/` rather than `ui/`.

- **Evidence (reuse):** commit `b7d43c6` created `FormField` and `.cursor/rules/react-conventions.mdc` (“`src/components/auth/` — auth forms and shared form pieces”). `decorator-onboarding/plan.md` and `contact-lead-flow/plan.md` name reuse of this path. Impl-review F6 extended shared `FormField` with `multiline` rather than forking — **working-tree** on disk (`git blame` Not Committed Yet); review marks FIXED.
- **Unknown:** no ADR/PR comparing `auth/` vs `ui/` / `forms/` after fan-in grew. Mapping “folder kłamie” is not a commit.

**Feasibility:** Mechanical move + 5 import updates. First step: confirm named export / list imports (or characterize labels at the current path). Blast: five islands + `react-conventions.mdc`. Does **not** reduce test-plan #3/#4/#5. Locator blast only if labels/`id`s change.

### C-limiter — current shape / intentionality / feasibility

**Current shape (evidence):** module-level `Map` in `inquiry-abuse.ts:9`, key `` `${ip}:${decoratorProfileId}` `` (`:46`), 5 / 10 min, sweep every 100 calls (`:16-25`, `:40-44`). Comment `:11-15` names Durable Object or KV as the upgrade. IP from `cf-connecting-ip` only (`:31-36`). Comment + sweep are **on disk**; intentionality agent reports they are **Not Committed Yet** on HEAD `b210f67` / current blob mix — treat the comment as working-tree evidence, the Map as committed (`b210f67`).

**Target shape (name only):** shared limiter (Durable Object or KV) behind the same `consumeInquiryRateLimit` function.

**Intentionality: świadome ograniczenie (MVP).**

- **Evidence:** `contact-lead-flow/plan.md` — “Rate limit: best-effort in-memory Map” and “acceptable for MVP; Turnstile later if abused.” Impl-review F2: per-isolate accepted; comment should name DO/KV. `inquiry-rate-limit-proof/plan.md` — “The `Map` stays” / not D: do not move to KV or a Durable Object.
- **Unknown:** production `cf-connecting-ip` always-on; whether isolate-best-effort is still enough (product/infra, never revisited after S-03).

**Feasibility:** New Cloudflare binding — `wrangler.jsonc` has **no** `kv_namespaces` / Durable Object bindings. High cost vs accepted MVP. First preliminary step is a **product** decision, not a code move. Safeguard D2b is required either way.

## Code References

- `src/lib/inquiry-query.ts:7-40` — published-by-id + inbox list helpers
- `src/pages/api/inquiries/index.ts:19-92` — unauthenticated compose (POST only)
- `src/pages/d/[id].astro:21,133` — helper call on disk; `ContactInquiryForm` mount (`:133`; raport: 137)
- `src/pages/dashboard/inquiries.astro:17-23` — inline `user_id` lookup + helper list
- `src/lib/inquiry-abuse.ts:9-62` — isolate `Map`, `cf-connecting-ip` only
- `src/components/auth/FormField.tsx:24` — shared labeled control
- `src/lib/api-auth.ts:37-51` — `requireDecoratorProfile` (portfolio APIs only)
- `.github/workflows/ci.yml:20-21` — lint + build; no Vitest

## Architecture Insights

- Stack direction still holds: island → handler → `lib` leaves → `types`. The form does not import `inquiry-schema`. The handler does not import `api-auth`.
- Query extract **increased** handler fan-out (Ce 6 → 7) while removing duplicated published-by-id SQL. Remaining Ce is composition, not a leftover god-object.
- Two user-visible ends are still `.astro`; cruiser will not flag them. Inbox list is on-graph via the helper; the session → profile-id hop is not.
- House pattern: API routes compose; `lib` holds leaves. A one-off `submitInquiry` / `services/` would be the first of its kind.

## Historical Context (from prior changes)

- `context/changes/contact-lead-flow/` (status `impl_reviewed`) — S-03 locks: honeypot + light rate limit; email fail-soft; notify `contact_email` only; SSR inbox, no GET list API.
- `context/changes/inquiry-query-helpers/` (status `implemented`) — shipped C-query-helpers minus the uncommitted `d/[id].astro` switch.
- `context/changes/inquiry-rate-limit-proof/` (status `plan_reviewed`) — D2b characterization only; Map stays; no C-submit.
- `context/changes/inquiry-flow-analysis/research.md` — Feature overview + Technical debt this report builds on (do not re-derive the flow).
- `context/foundation/test-plan.md` risks #3/#4/#5 still sit on this slice.
- `context/mapping/repo-map.md` — only handler with Ce>4 (snapshot 2026-09-13); `components/auth` folder lie; `.astro` off-graph.

## Related Research

- `context/changes/inquiry-flow-analysis/research.md` — source analysis (Feature overview, Technical debt, earlier §④ draft written into the wrong change folder).
- No `context/archive/**/research.md`. Closest prose: contact-lead-flow plan / impl-review and the mapping artifacts.

## Open Questions

- Production: is `cf-connecting-ip` always present on the Worker?
- Is `current_decorator_profile_id()` covered by any SQL/integration test outside this slice?
- Baseline for a later plan: working tree (`d/[id]` helper, limiter comment, FormField `multiline`) or HEAD `ae815bb` alone?
- Does the team want a `services/` layer that no other API uses?
- Should a follow-on helper lift `user_id` → profile id / `requireDecoratorProfile`, or stay inquiry-only?
- Should Phase 2’s first integration be 429⇒no insert (#5) or A-vs-B select (#4)? Both cheaper than more e2e; #5 already has a sibling change.

These stay **unknown** for the later plan interview — not to be invented mid-implementation.

---

## Możliwości refaktoryzacji (ranking)

Proposal for a later planning session. Not a decision. Built on the classification and the three lenses above.

C-query-helpers is **out of the unused ranking** (shipped on HEAD except the uncommitted profile-page switch). Ranked unused candidates:

#### 1. C-submit — `submitInquiry` compose step out of `POST`

- **Current → target:** 74-line route composer (`index.ts:19-92`) → thin `APIRoute` + `lib` function for honeypot/schema/limit/publish/insert/notify.
- **Why this rank:** Highest remaining structural debt on the north star (Ce **7 (raport: 6)**; test-plan #3/#5 seam). Change cost is low **if** D7/D2b tests land first. Leaves are already extracted; remaining fan-out is the house “handler composes” pattern. A new `services/` folder would be unprecedented (**unknown** whether wanted).
- **Blast radius:** `api/inquiries/index.ts` + `index.test.ts` only.
- **Incremental path:** characterize 429/500/400 on the current export → move body → keep HTTP mapping in the route.
- **First preliminary step:** handler test “budget+1 POST → 429 and `insert` not called” — already the scope of `inquiry-rate-limit-proof` (not implemented).

#### 2. C-formfield-home — move `FormField` out of `auth/`

- **Current → target:** `components/auth/FormField` → `components/ui` or `components/forms`.
- **Why this rank:** Honest folder; lowest debt vs #3/#4/#5. Change is cheap; user-visible risk is e2e locators if the move is sloppy. Does not pay down lead delivery or abuse.
- **Blast radius:** 5 import sites, 20 JSX usages.
- **Incremental path:** characterize or list imports → move + update imports → run e2e #3.
- **First preliminary step:** list the five imports and confirm named export (no default) / no path-alias surprises.

#### 3. *(no third unused structural candidate worth ranking)*

C-limiter is rejected below, not a third ranked option. Finishing `d/[id].astro` on C-query-helpers is leftover shipped work, not a new rank slot.

### Considered and rejected (as ranked refactors)

| Item | Why rejected from the unused ranking |
|------|--------------------------------------|
| **C-query-helpers** (as a new slice) | **Already extracted** in `inquiry-query-helpers` / `ae815bb`. Remaining `d/[id].astro` switch is uncommitted finish-work, not a fresh opportunity. |
| **C-limiter** (Map → DO/KV) | **Świadome ograniczenie** in contact-lead plan + impl-review F2 + `inquiry-rate-limit-proof` “Map stays.” `wrangler.jsonc` has no KV/DO bindings. Revisit only if MVP abuse is no longer acceptable — product/infra, not the first unused structural slice. |
| D1 same thanks UI for 204/201 | Anti-enumeration by design. Conceptual, not structure. |
| Pull `inquiry-schema` into `ContactInquiryForm` | Map’s first cycle warning. |
| GET `/api/inquiries` | Explicitly out of S-03 (“no list GET API”). |
| Auth-gate the public POST (D8) | Guest lead-gen is the product. |
| Dead `CreateContactInquiryInput` / copied `validationFailed` | Hygiene; not worth a phase. |
| More handler mocks / email unit / e2e #4/#5 | **Inputs to /10x-plan**, not candidates. They should ride with C-submit or stay in `inquiry-rate-limit-proof`, not replace a refactor. |

## Weryfikacja twierdzeń (ast-grep)

Krok 2 / prompt m4l4-3. Tool: `@ast-grep/cli` **0.45.3** via `npx --package=@ast-grep/cli ast-grep` (bare `ast-grep` is not on PATH). Language `typescript` / `tsx`, search `src`. Every ast-grep **zero** re-checked with ripgrep. `.astro` remains parser-blind. Ranking section and intentionality verdicts were **not** rewritten after this table.

| Twierdzenie (stoi za rankingiem) | Werdykt | Dowód (plik:linia) | Metoda |
|----------------------------------|---------|---------------------|--------|
| POST handler production imports (map Ce) | **doprecyzowane** | `index.ts:3-9` — 7 modules: `api-error`, `inquiry-abuse`, `inquiry-email`, `inquiry-query`, `inquiry-schema`, `supabase`, `types`. **7 (raport: 6)**. Extra import is the shipped helper. **do decyzji na etapie planowania** whether Ce-up after extract weakens C-submit vs C-formfield-home | grep of `from "@/` |
| Production `parseInquiryBody($ARG)` is this handler only | **potwierdzone** | Call: `index.ts:40`. Tests: `inquiry-schema.test.ts:7`, `:31` | `parseInquiryBody($ARG)` + grep |
| Production `sendInquiryNotification` is this handler only | **potwierdzone** | Call: `index.ts:85`. Definition: `inquiry-email.ts:31` (not a call) | `sendInquiryNotification($ARG)` + grep |
| Production `consumeInquiryRateLimit` is this handler only | **potwierdzone** | Production: `index.ts:46`. Tests: `inquiry-abuse.test.ts:39,42,50,52` | `consumeInquiryRateLimit($$$)` + grep |
| `contact_inquiries` write only in the handler; read only via helper | **doprecyzowane** | ast-grep `$_.from("contact_inquiries")` → **0** (bad `$_` / member-call). Grep: write `index.ts:73`; read `inquiry-query.ts:24`. Inbox `.astro` no longer touches the table (raport: `dashboard/inquiries.astro:23`) | ast-grep 0 → grep |
| Inquiries API exports only `POST` | **potwierdzone** | `export const $M: APIRoute` → `POST` at `index.ts:19`. GET/PATCH/DELETE ast-grep **0** and grep **0** (truly absent) | ast-grep + grep |
| `requireDecoratorProfile` is portfolio APIs, not inbox | **potwierdzone** | 4 calls: `portfolio/index.ts:16,41`, `portfolio/[id].ts:14`, `portfolio/upload.ts:54`. Inbox does not call it | `requireDecoratorProfile($$$)` + grep |
| Published-by-id filter is a single helper (plus leftover HEAD page) | **doprecyzowane** | Grep `.eq("is_published", true)`: helper `inquiry-query.ts:12`; list `discovery-query.ts:73`. Disk `d/[id].astro` uses the helper. HEAD blob still inlines the gate. **do decyzji na etapie planowania** if “finish the page switch” is in-slice | grep; ast-grep quote-stripped on `.eq` |
| `FormField` shared: 5 imports, 20 JSX, 5 on the inquiry form | **potwierdzone** | Grep: 5 imports. `<FormField $$$ />` openings: **20**. Inquiry: `:119,:130,:145,:157,:170` | ast-grep JSX + grep imports |
| No `src/lib/services/` and no `submitInquiry` | **potwierdzone** | Glob empty; grep `submitInquiry` / `@/lib/services` = 0. Import pattern failed to parse | glob + grep |
| `CreateContactInquiryInput` is unused | **potwierdzone** | ast-grep identifier **0**; grep only `types.ts:66` (the interface) | ast-grep 0 → grep |
| Local `validationFailed` exists twice | **potwierdzone** | ast-grep def pattern **0** (bad `{` pattern). Grep: `inquiries/index.ts:13`, `profile/index.ts:10` | ast-grep 0 → grep |
| Only `src` `fetch("/api/inquiries", …)` is the form | **potwierdzone** | This-run ast-grep tsx **0** (quoting). Grep: `ContactInquiryForm.tsx:56` only | ast-grep 0 → grep |
| Ranked #1 “74-line” composer | **potwierdzone** | `POST` is `index.ts:19-92` → **74** lines | line count |
| `ContactInquiryForm` mount is `d/[id].astro` only | **doprecyzowane** | ast-grep tsx identifier = definition only. Grep: import + mount `d/[id].astro:4`, `:133` (raport: 137) | grep (parser-blind `.astro`) |
| Inbox “user → profile id” is unique to inquiries | **obalone / doprecyzowane** | Same `.eq("user_id", user.id)` in `dashboard.astro`, `dashboard/profile.astro`, `dashboard/portfolio.astro`, `api/profile/*`, `api-auth.ts:38`. First step of shipped helpers still excludes `api-auth`. **do decyzji na etapie planowania** if a follow-on helper is in scope | grep |

Zeros classification: GET/PATCH/DELETE, `submitInquiry`, and `@/lib/services` are **truly absent**. `from("contact_inquiries")` / `validationFailed` / `fetch("/api/inquiries")` / `CreateContactInquiryInput` zeros were **bad pattern or tool quoting**, then confirmed by grep. No unused-ranking claim was **refuted**. The user_id uniqueness claim was **refined** (shared dashboard pattern) — does not move C-submit vs C-formfield-home.

## Notatnik audytu (Krok 2)

Outside the exploration voice. Checked after § ranking existed.

### 1. Lista kandydatów vs §③ Technical debt

Wszystkie problemy z inquiry-flow-analysis Technical debt (D1–D8) plus ślady T-Ce / T-dup / T-dto / T-val są w tabeli klasyfikacji. Sensowne cięcie:

- **Kandydaci:** C-query-helpers (D4a, D5, T-dup), C-submit (T-Ce), C-formfield-home (D6), C-limiter (D2a).
- **Wejście do /10x-plan (nie struktura):** D1, D2b, D3a–c, D4b, D7, D8, T-dto, T-val, brakujące testy e-mail / ownership / 429.

Nic z §③ nie zostało pominięte. D4 rozdzielone na „query w `.astro`” (kandydat, dziś prawie zrobiony) vs „brak testu A-vs-B” (wejście) — to jest właściwe; sam helper bez testu nie zamyka #4.

### 2. Werdykty intencjonalności — czy jest twardy dowód?

| Kandydat | Werdykt | Dowód, nie przeczucie |
|----------|---------|------------------------|
| C-query-helpers | świadome „no GET API” + przypadkowy duplikat published-by-id + świadomy extract | `contact-lead-flow/plan.md` + plan-review F1; commit `b210f67`; `inquiry-query-helpers/plan.md`; commit `ae815bb`. Brak ADR „trzymaj SQL w `.astro` na zawsze”. |
| C-submit | świadome (handler składa jak profile/portfolio) | ten sam plan S-03; `api/profile/index.ts` też komponuje inline; późniejsze plany zabraniają `submitInquiry` w swoich slice’ach. |
| C-formfield-home | świadomy reuse; unknown dlaczego `auth/` a nie `ui/` | `b7d43c6` + conventions; S-01/S-03 plany reuse; F6 multiline (review FIXED, blob working-tree). Brak ADR „nigdy nie ruszaj ścieżki”. |
| C-limiter | świadome ograniczenie MVP | plan.md „best-effort in-memory Map”; impl-review F2; `inquiry-rate-limit-proof` „Map stays”. Komentarz DO/KV w `inquiry-abuse.ts:11-15` jest **working-tree**. |

Żaden werdykt nie stoi na samym „wydaje się.” `unknown` zostawione tam, gdzie brakuje danych (Open Questions).

### 3. Ranking — czy kupuję kolejność?

**Częściowo.** Po `ae815bb` nie kupuję trzymania C-query-helpers jako aktywnego #1 — to już nie jest „opportunity”, tylko domknięcie commita `d/[id].astro`.

**Zgoda:** C-limiter poza topem. C-submit ma najwyższy pozostały dług struktury na north-starze, ale jego pierwszy krok **jest inną zmianą** (`inquiry-rate-limit-proof`).

**Co bym przesunął:** na wywiadzie planera ustawiłbym **C-formfield-home przed C-submit** jako jedyny *nieużywany i niezależny* slice — C-submit bez 429⇒brak insertu przenosi nietestowany szew. Gdyby plan miał być maksymalnie wąski: testy (wejście / sibling) → ewentualnie FormField → C-submit dopiero po proof. Nie przesuwam C-limiter do rankingu.

**Kontrpytanie do ⭐ C-submit:** ekstrakcja `submitInquiry` / `services/` nie ma precedensu; tani sygnał na #5 to test na **obecnym** `POST`. Flaga na wywiad.

### 4. Twierdzenia strukturalne

Zweryfikowane w sekcji powyżej. Poprawki: Ce **7 (raport: 6)**; mount **133 (raport: 137)**; read `contact_inquiries` teraz `inquiry-query.ts:24` (raport: inbox `.astro`). Ranking unused nietknięty po weryfikacji.

### 5. `unknown` — na wywiad /10x-plan, nie na implementację

- Czy produkcja zawsze ustawia `cf-connecting-ip`?
- Czy `current_decorator_profile_id()` ma jakikolwiek test SQL poza tym slice?
- Czy baseline to working tree czy sam HEAD `ae815bb`?
- Czy zespół chce warstwy `services/`, której żadne inne API nie ma?
- Czy follow-on helper może ruszyć `requireDecoratorProfile` / `api-auth`, czy zostaje inquiry-only?
- Czy „dokończyć `d/[id].astro`” należy do tej zmiany, czy do `inquiry-query-helpers`?

Te rzeczy świadomie nie są „odkrywane w PR.”
