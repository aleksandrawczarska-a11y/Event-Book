# FormField home (C-formfield-home) Implementation Plan

## Overview

Move the shared `FormField` primitive out of `src/components/auth/` into `src/components/forms/`, after characterizing the label / `htmlFor` / multiline contract that e2e #3 already depends on. Folder name stops implying “login only.” Behavior, copy, and locators stay the same.

## Current State Analysis

Research §④ ranked three structural candidates. **C-query-helpers is already shipped** (`inquiry-query.ts`, ae815bb) and is not in this plan. **C-submit** is unused but its first preliminary step is the entire `inquiry-rate-limit-proof` change (plan_reviewed, 429 ⇒ no insert). **C-limiter** is a świadome MVP (`Map` in `inquiry-abuse.ts`).

`FormField` is a named export at `src/components/auth/FormField.tsx` (no default). Five production imports, all `@/components/auth/FormField`:

- `src/components/auth/SignInForm.tsx`
- `src/components/auth/SignUpForm.tsx`
- `src/components/discovery/ContactInquiryForm.tsx` (5 openings; labels `Your name`, `Your email`, `Event date`, `What do you need?` — e2e `tests/e2e/inquiry-confirmation-reaches-decorator.spec.ts`)
- `src/components/decorator/ProfileForm.tsx`
- `src/components/decorator/PortfolioEntryForm.tsx`

`.cursor/rules/react-conventions.mdc` still says `auth/` holds “shared form pieces” and points at the current path. `src/components/ui/` is the shadcn/`cva` home (`button.tsx`). There is no `src/components/forms/` yet. Vitest includes only `src/**/*.test.ts` (no RTL, no jsdom).

### Interview (first question = choice, not ranking confirm)

**Complexity: LOW** — one primitive, five import updates, no API/schema. Upstream research present, so five recorded decisions (not a live round).

1. **Slice** — which unused opportunity?
   - A: C-submit (`submitInquiry`) · Strength: remaining handler Ce. · Tradeoff: first step is already another change; `services/` has no house analog.
   - B: ⭐ C-formfield-home · Strength: unused, mechanical, no collision with the 429 proof. · Tradeoff: does not pay down test-plan #3/#4/#5.
   - C: C-limiter · Strength: multi-isolate. · Tradeoff: świadome MVP; product/infra.
   - D: No structural slice · Strength: zero folder churn. · Tradeoff: `auth/` keeps lying.
   **Locked B.**

2. **Destination** — ⭐ `components/ui` vs `components/forms` vs stay + re-export. **⭐ challenged:** `ui/` is shadcn/`cva`; `FormField` is house chrome. **Locked `components/forms`.**

3. **Compat** — ⭐ one-phase re-export vs hard cut. **Locked hard cut** (five in-repo sites; a shim leaves the lie).

4. **Characterization** — ⭐ `renderToStaticMarkup` of label/`htmlFor`/multiline vs e2e-only. **Locked markup characterization first** (Vitest `.test.ts` + `createElement`, no RTL).

5. **Enforcement** — ⭐ leftover-import grep + conventions update vs new depcruise `forbidden`. **Locked grep + rule update.** Cruiser stays `no-circular` only.

## Desired End State

- `FormField` lives at `src/components/forms/FormField.tsx` (named export, same props).
- All five islands import `@/components/forms/FormField`.
- A characterization test locks: named export; `label` + `htmlFor` match (e2e locator); default control is `input`; `multiline` is `textarea`.
- `src/components/auth/FormField.tsx` is gone (no re-export).
- `react-conventions.mdc` points shared fields at `forms/`, not `auth/`.

Verify: characterization test green before and after the move; `rg "components/auth/FormField" src` is empty; existing inquiry handler unit suite still green; no user-visible copy or id change.

### Key Discoveries:

- Named export only — `export function FormField` (`FormField.tsx:24`). No barrel, no default. Five sites already use the `@/` alias.
- E2E #3 locates inquiry fields by accessible name from those labels (`inquiry-confirmation-reaches-decorator.spec.ts:23-26`). A move that changes `label` / `id` / control type breaks that test; a path-only move must not.
- Vitest `include` is `src/**/*.test.ts` (`vitest.config.ts:6`). Characterization must be a `.test.ts` using `createElement` + `react-dom/server` `renderToStaticMarkup` — do not add RTL/jsdom or flip include to `.tsx`.
- `ui/button.tsx` is shadcn/`cva` + `export { Button, buttonVariants }`. Putting `FormField` there would mix vocabularies (⭐ challenged).
- Query helpers and the 429 proof are separate changes; this slice must not reopen them.

## What We're NOT Doing

- No re-extract of `inquiry-query` / C-query-helpers (already shipped, ae815bb).
- No `submitInquiry` / `src/lib/services/` (C-submit).
- No KV / Durable Object limiter (C-limiter); leave `inquiry-rate-limit-proof` as-is.
- No GET `/api/inquiries`, no auth-gate on guest POST, no 204 vs 201 thanks-UI change.
- No label / `id` / `name` / placeholder / error-copy edits on any of the five islands.
- No rewrite of `FormField` to `cva` / shadcn variants; no move of `PasswordToggle`, `ServerError`, `SubmitButton`.
- No compatibility re-export from `components/auth/FormField`.
- No new depcruise `forbidden` layer; no CI Vitest gate; no payments / chat / calendars.

## Implementation Approach

Characterize the public render contract on the **current** path (mechanism green). Then move the file and retarget five imports (behavior-preserving rewire). Then enforce: old path gone, conventions updated, cruiser still a DAG.

### m4l4 plan bars (self-check)

- **Characterization before uncovered code:** Phase 1 adds the markup test against `auth/FormField`. The file does not move until that test is green.
- **Committable phases:** Phase 1 is test-only; Phase 2 is a path move + five imports; Phase 3 is leftover-path cleanup + the conventions pointer.
- **Auto + manual per phase:** every phase has a Vitest/grep/lint command and a short human check (no copy drift / sign-in + inquiry fields still labelled).
- **Mechanism green then enforcement:** move only after the contract is proven; delete the old path and update the rule only after the new imports compile.

## Critical Implementation Details

Do not change `label`, `id`, or control type. Those are the e2e #3 locators. The characterization test should use the inquiry names (`Your name` / `client_name`, `What do you need?` + `multiline`) so a “helpful” label tweak fails the unit suite before Playwright would.

Keep the test file as `*.test.ts` and render with `createElement` + `renderToStaticMarkup`. Adding `@testing-library/react` or expanding Vitest `include` to `.tsx` is out of scope.

## Phase 1: Characterize FormField at the current path

### Overview

Lock the export and render contract while `FormField` still lives under `auth/`. No move, no import retarget.

### Changes Required:

#### 1. Characterization test

**File**: `src/components/auth/FormField.test.ts`

**Intent**: Prove today’s named export and the label / control-type contract that five islands and e2e #3 rely on, so the later move cannot silently change markup.

**Contract**: Import `{ FormField }` from `@/components/auth/FormField`. Assert it is a function and the module has no `default` export. Using `createElement` + `renderToStaticMarkup`: (1) `id="client_name"`, `label="Your name"` → markup contains `for="client_name"` (or `htmlFor` equivalent) and the text `Your name`, and a `<input` (not `<textarea`); (2) same plus `multiline: true`, `id="needs_description"`, `label="What do you need?"` → `<textarea` and that label. Pass a trivial `icon` element and a no-op `onChange`. Do not mount a browser. Do not import the five form islands.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/components/auth/FormField.test.ts` passes (named export, label/`htmlFor`, input vs textarea).
- `src/components/auth/FormField.tsx` still exists; no `src/components/forms/` yet; the five islands still import `@/components/auth/FormField`.

#### Manual Verification:

- Confirm this phase adds no user-visible route, label, or style change (test-only).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Move FormField to `components/forms`

### Overview

Relocate the primitive and the characterization test. Retarget the five imports. No re-export from `auth/`.

### Changes Required:

#### 1. New home

**File**: `src/components/forms/FormField.tsx`

**Intent**: Give the shared field an honest folder that is neither “auth-only” nor shadcn `ui/`.

**Contract**: Same named export and props as today’s file (move, do not restyle). Delete `src/components/auth/FormField.tsx`. Do not add `src/components/auth/FormField.ts` shim.

#### 2. Characterization test follows the module

**File**: `src/components/forms/FormField.test.ts`

**Intent**: Keep the Phase 1 oracle on the new path so the move cannot drop coverage.

**Contract**: Same assertions as Phase 1; import from `@/components/forms/FormField`. Delete `src/components/auth/FormField.test.ts`.

#### 3. Call sites

**Files**: `src/components/auth/SignInForm.tsx`, `src/components/auth/SignUpForm.tsx`, `src/components/discovery/ContactInquiryForm.tsx`, `src/components/decorator/ProfileForm.tsx`, `src/components/decorator/PortfolioEntryForm.tsx`

**Intent**: Point every production import at the new path without touching field props.

**Contract**: Replace `@/components/auth/FormField` with `@/components/forms/FormField`. Leave `id`, `label`, `multiline`, and other props unchanged.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/components/forms/FormField.test.ts` passes.
- The five islands import `@/components/forms/FormField`; `src/components/auth/FormField.tsx` is gone.
- `npm test -- src/pages/api/inquiries/index.test.ts` still passes (no handler rewrite).

#### Manual Verification:

- Sign-in and the public inquiry form still show the same field labels; inquiry `needs` is still a textarea. No new copy.

---

## Phase 3: Enforce the new home

### Overview

Make the old path a hard miss and update the convention that still advertises `auth/` as the shared-field home.

### Changes Required:

#### 1. Leftover-path check

**File**: (no new production module — verification only, plus the conventions file below)

**Intent**: Fail the phase if any `src` import still names the old module.

**Contract**: `rg "components/auth/FormField" src` is empty. `npm run depcruise` still reports no circular modules (move must not introduce a cycle).

#### 2. Convention pointer

**File**: `.cursor/rules/react-conventions.mdc`

**Intent**: Stop telling agents that shared fields live under `auth/`.

**Contract**: File-placement bullets: `ui/` remains shadcn primitives (`button.tsx`); add `forms/` for shared fields (`FormField.tsx`); `auth/` is auth islands only (sign-in/up, password toggle, server error, submit). Icons & accessibility bullet that cites `FormField.tsx` must use the new path. Do not rewrite the rest of the rule.

### Success Criteria:

#### Automated Verification:

- `rg "components/auth/FormField" src` is empty; `rg "components/forms/FormField" src` hits the five islands + the test.
- `npm test -- src/components/forms/FormField.test.ts src/pages/api/inquiries/index.test.ts` passes.
- `npm run lint` passes on the touched TSX/rule-adjacent files.
- `npm run depcruise` finds no circular modules.

#### Manual Verification:

- Open `/auth/signin` and a published `/d/:id` contact form: labels and focus (`htmlFor`) still match. Do not run a full e2e #3 unless local Playwright + seed are already up — the unit markup test is the locator oracle.

---

## Testing Strategy

### Unit Tests:

- Named export; no default.
- `Your name` / `client_name` → label associated with an `input`.
- `What do you need?` / `needs_description` + `multiline` → `textarea`.

### Integration Tests:

- None new. Handler unit suite remains the inquiry compose seam. Do not add Playwright to this change.

### Manual Testing Steps:

1. Phase 1: confirm no UI diff (test-only commit).
2. Phase 2: sign-in fields + inquiry fields still labelled; needs is a textarea.
3. Phase 3: same two screens; spot-check profile/portfolio forms still render labels.

## Performance Considerations

None. Same component, new path.

## Migration Notes

None. Rollback is revert of the move + five imports + the conventions pointer. No schema or auth change.

## References

- Related research: `context/changes/refactor-opportunities/research.md` (§④ + interview lock)
- Source ranking: `context/changes/inquiry-flow-analysis/research.md` §④ C-formfield-home
- Shipped, do not redo: `context/changes/inquiry-query-helpers/` (ae815bb)
- Left untouched: `context/changes/inquiry-rate-limit-proof/`
- E2E locator consumer: `tests/e2e/inquiry-confirmation-reaches-decorator.spec.ts`
- Convention to update: `.cursor/rules/react-conventions.mdc`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Characterize FormField at the current path

#### Automated

- [x] 1.1 `npm test -- src/components/auth/FormField.test.ts` passes (named export, label/`htmlFor`, input vs textarea). — f8d5b67
- [x] 1.2 `src/components/auth/FormField.tsx` still exists; no `src/components/forms/` yet; the five islands still import `@/components/auth/FormField`. — f8d5b67

#### Manual

- [x] 1.3 Confirm this phase adds no user-visible route, label, or style change (test-only). — f8d5b67

### Phase 2: Move FormField to `components/forms`

#### Automated

- [x] 2.1 `npm test -- src/components/forms/FormField.test.ts` passes. — f8d5b67
- [x] 2.2 The five islands import `@/components/forms/FormField`; `src/components/auth/FormField.tsx` is gone. — f8d5b67
- [x] 2.3 `npm test -- src/pages/api/inquiries/index.test.ts` still passes (no handler rewrite). — f8d5b67

#### Manual

- [x] 2.4 Sign-in and the public inquiry form still show the same field labels; inquiry `needs` is still a textarea. No new copy. — f8d5b67

### Phase 3: Enforce the new home

#### Automated

- [x] 3.1 `rg "components/auth/FormField" src` is empty; `rg "components/forms/FormField" src` hits the five islands + the test. — f8d5b67
- [x] 3.2 `npm test -- src/components/forms/FormField.test.ts src/pages/api/inquiries/index.test.ts` passes. — f8d5b67
- [x] 3.3 `npm run lint` passes on the touched TSX/rule-adjacent files. — f8d5b67
- [x] 3.4 `npm run depcruise` finds no circular modules. — f8d5b67

#### Manual

- [x] 3.5 Open `/auth/signin` and a published `/d/:id` contact form: labels and focus (`htmlFor`) still match. — f8d5b67
