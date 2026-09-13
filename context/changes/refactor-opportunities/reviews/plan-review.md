<!-- PLAN-REVIEW-REPORT -->
# Plan Review: FormField home (C-formfield-home) Implementation Plan

- **Plan**: context/changes/refactor-opportunities/plan.md
- **Mode**: Deep
- **Date**: 2026-09-13
- **Verdict**: SOUND
- **User verdict**: ready-with-nits
- **Findings**: 0 critical 2 warnings 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 10/10 paths ✓, 6/6 symbols ✓, brief↔plan ✓

Paths present: `src/components/auth/FormField.tsx`, `SignInForm.tsx`, `SignUpForm.tsx`, `src/components/discovery/ContactInquiryForm.tsx`, `src/components/decorator/ProfileForm.tsx`, `PortfolioEntryForm.tsx`, `.cursor/rules/react-conventions.mdc`, `src/pages/api/inquiries/index.test.ts`, `vitest.config.ts`, `tests/e2e/inquiry-confirmation-reaches-decorator.spec.ts`. `src/components/forms/` does not exist yet (expected). No `src/components/auth/index.ts` barrel.

Symbols present: `export function FormField` (`FormField.tsx:24`); `htmlFor={id}` (`:47`); `multiline` (`:20`, `:54-67`); five `@/components/auth/FormField` imports only; e2e locators `Your name` / `What do you need?` (`inquiry-confirmation-reaches-decorator.spec.ts:23-26`); Vitest `include: ["src/**/*.test.ts"]` (`vitest.config.ts:6`).

Brief↔plan: slice B, destination `components/forms` (not `ui/`), hard cut, markup characterization first, grep + conventions (no new cruiser layer) — match. Locked “NOT” list does not reappear in phases.

## m4l4 krok 4 bars

| Bar | Score |
|-----|--------|
| 1. Characterization before uncovered code | **PASS** — Phase 1 adds `FormField.test.ts` against `auth/FormField`. The file does not move until that test is green. |
| 2. Phases separately commitable, easiest first | **PASS** (nit: Phase 2’s “five islands retargeted” gate is prose, not a command — see F1) — Phase 1 is test-only; Phase 2 is the path move; Phase 3 is leftover-path + conventions. |
| 3. Each phase has auto + manual verification | **PASS** — all three phases have both. One `## Progress`; phase names match; Success Criteria map 1:1 to `1.1–1.3` / `2.1–2.4` / `3.1–3.5`; no checkboxes in phase bodies. |
| 4. Mechanism green first; enforcement later | **PASS** — characterize → move + retarget → leftover `rg` + `react-conventions.mdc`. No new depcruise `forbidden` layer. |

## Findings

### F1 — Phase 2 `npm test` can pass with a missed island import

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Automated Verification / Progress 2.1–2.3
- **Detail**: Automated 2.1 and 2.3 only run `FormField.test.ts` and `api/inquiries/index.test.ts`. Neither compiles `SignInForm` / `SignUpForm` / `ContactInquiryForm` / `ProfileForm` / `PortfolioEntryForm`. Vitest has no `typecheck` block (`vitest.config.ts:4-6`). A Phase 2 commit that deletes `auth/FormField.tsx` and misses one of the five `@/` imports still goes green on those two commands. Criterion 2.2 states the five-island check but gives no `rg`/`lint` command (those land in Phase 3.1 / 3.3). `npm run lint` is type-checked ESLint (`eslint.config.js:17`) and would catch a dangling `@/components/auth/FormField` import.
- **Fix**: Copy Phase 3.1’s `rg "components/auth/FormField" src` (empty) plus `rg "components/forms/FormField" src` (five islands + test) into Phase 2 automated / Progress 2.5 — or add `npm run lint` on the five islands to Phase 2 so the move commit is self-gating.
- **Decision**: PENDING

### F2 — Multiline contract lives on the working tree, not HEAD

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Current State / Phase 1 characterization / Phase 2 move
- **Detail**: The plan characterizes `multiline` → `<textarea` using inquiry ids (`needs_description`, `What do you need?`). That API exists on disk (`FormField.tsx:20-21`, `:36-37`, `:54-67`) and is used by `ContactInquiryForm.tsx:170-181`. `git diff` against HEAD (`216a1c9`) shows `multiline` / `rows` and the textarea branch are **uncommitted**. A Phase 1 test written against the committed blob fails the textarea case; a move that restores HEAD `FormField` drops the inquiry `needs` control and breaks e2e #3. Research already flagged working-tree drift on this slice (`inquiry-flow-analysis/research.md` Open Questions).
- **Fix A ⭐ Recommended**: Treat the dirty `FormField.tsx` as the move source. In Phase 2 Contract, say “move the working-tree file (including `multiline` / `rows`); do not check out HEAD `FormField`.” If this change is implemented on a clean tree, land the multiline commit first.
  - Strength: Matches today’s inquiry form and the characterization oracle; no extra product work.
  - Tradeoff: This slice then carries (or waits on) the uncommitted F6 multiline work.
  - Confidence: HIGH — diff is only the multiline branch; labels/`htmlFor` are already on HEAD.
  - Blind spot: Whether contact-lead-flow will commit multiline before this implement starts.
- **Fix B**: Commit the multiline `FormField` as a prerequisite, then run this plan on a clean tree.
  - Strength: Phase 1 is green on HEAD; no dirty-file surprise.
  - Tradeoff: Extra commit / ordering with contact-lead-flow.
  - Confidence: HIGH — same bytes, different git order.
  - Blind spot: None significant.
- **Decision**: PENDING

### F3 — First TSX unit test; Vitest has no React plugin

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 — Characterization test / plan-brief Open Risks
- **Detail**: There is no `src/components/**/*.test.ts` today (all ten Vitest files are `lib/` or `pages/api/`). `vitest.config.ts` has no `@vitejs/plugin-react`. FormField.tsx uses JSX without a React import (automatic runtime) and pulls `lucide-react` + `cn()`. The brief already says: if `react-dom/server` + Vite’s default TSX transform is not enough, fix the transform — do not add RTL. That fallback is the right one. `react-dom` is a production dependency (`package.json:39`).
- **Fix**: Keep the brief fallback as the Phase 1 escape hatch. Do not expand Vitest `include` to `.tsx` or add Testing Library.
- **Decision**: PENDING

### F4 — Characterization contract omits required `value`

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 Contract
- **Detail**: Plan says pass a trivial `icon` and a no-op `onChange`. `FormFieldProps` also requires `value: string` (`FormField.tsx:14`). Runtime still renders if `value` is omitted; a type-aware editor will nag. Inquiry characterization ids/labels are otherwise exact (`ContactInquiryForm.tsx:120-121`, `:171-172`).
- **Fix**: In the Phase 1 contract, also pass `value: ""`.
- **Decision**: PENDING

### F5 — Conventions update should name the `forms/` export style

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 — Convention pointer
- **Detail**: `react-conventions.mdc:14-22` says named exports from `ui/`, default export for top-level form/page islands. After Phase 3, `FormField` is a named export under `forms/`, not a page island. The planned bullets (`ui/` = shadcn, `forms/` = shared fields, `auth/` = auth islands) are enough for placement but not for export style. An implementer following the default-export sentence could “helpfully” switch `FormField` to default and break the five `{ FormField }` imports.
- **Fix**: In the Phase 3 conventions contract, say `forms/` uses named exports (`export function FormField`), same as today’s file.
- **Decision**: PENDING

## Notes for implement (not findings)

- Locked slice holds: destination is `src/components/forms/` (not `ui/`). C-query-helpers (ae815bb), C-submit, KV/DO limiter, 204 UI, and other debts stay out.
- `ui/button.tsx` is shadcn/`cva` + `export { Button, buttonVariants }` (`button.tsx:3-7`, `:50`). Putting `FormField` there would mix vocabularies — the ⭐ challenge is justified.
- Blast radius is the five listed islands only. Other `@/components/auth/*` imports (`ServerError`, `PasswordToggle`, `SubmitButton`) must stay. JSX openings total 20 (SignIn 2, SignUp 3, inquiry 5, Profile 6, Portfolio 4) — do not retarget props.
- E2E #3 uses `getByRole("textbox", { name })` (`inquiry-confirmation-reaches-decorator.spec.ts:23-26`). Both `<input>` and `<textarea>` are textboxes; the unit markup test (tag name + `for=`) is the stricter locator oracle. Phase 3 is right not to require Playwright.
- `npm run depcruise` already has many default rules; `no-circular` is `severity: 'warn'` (`.dependency-cruiser.cjs:3-14`). The lock is “no new `forbidden` layer,” not “config is circular-only.” A FormField move cannot create a cycle (leaf → `cn` / lucide).
- Progress section is mechanically valid for `/10x-implement`.
- No `lessons.md` or `docs/reference/contract-surfaces.md` in this repo — those plan-review checks were skipped.

## Internal consistency

- **Contradiction**: none. “What We’re NOT Doing” does not reappear in phases. Hard cut matches “no re-export.”
- **Promise gap**: none. End state (new path, five imports, characterization, old path gone, conventions) each has a phase.
- **Progress↔Phase**: one `## Progress`; phase titles match; every Success Criteria bullet has a Progress checkbox; phase bodies use plain `-` only.
