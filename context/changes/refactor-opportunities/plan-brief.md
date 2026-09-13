# FormField home (C-formfield-home) — Plan Brief

> Full plan: `context/changes/refactor-opportunities/plan.md`
> Research: `context/changes/refactor-opportunities/research.md`
> Source ranking: `context/changes/inquiry-flow-analysis/research.md`

## What & Why

Move `FormField` out of `components/auth/` so the shared primitive no longer lives in a folder that means “login.” The ranking’s #1 extract (query helpers) already shipped; this is the next safest unused structural candidate.

## Starting Point

Named export at `src/components/auth/FormField.tsx`, five `@/` imports (auth ×2, inquiry, profile, portfolio). E2E #3 finds inquiry fields by those labels. `ui/` is shadcn/`cva`; there is no `forms/` folder yet.

## Desired End State

`FormField` lives at `src/components/forms/FormField.tsx`. Five islands import the new path. A characterization test locks label/`htmlFor` and input vs textarea. Old path is gone. Conventions point shared fields at `forms/`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Slice (Q1, choice not rank-confirm) | C-formfield-home | #1 shipped; C-submit’s first step is `inquiry-rate-limit-proof`; C-limiter is świadome MVP | Plan / Research |
| ⭐ challenge: destination | `components/forms`, not ⭐ `ui/` | `ui/` is shadcn/`cva`; `FormField` is house chrome — `ui/` would lie differently | Plan |
| Compat | Hard cut, no `auth/` re-export | Five in-repo sites; a shim keeps the folder lie | Plan |
| Tests | `renderToStaticMarkup` + `createElement` in `*.test.ts` | Vitest include is `.test.ts` only; no RTL/jsdom | Plan |
| Enforcement | Grep old path + update `react-conventions.mdc` | Mechanism (move) then pointer; no new cruiser layer | Plan |

## Scope

**In scope:** characterize current `FormField`; move to `forms/`; retarget five imports; drop old path; update the conventions pointer.

**Out of scope:** query-helper re-extract; `submitInquiry` / `services/`; KV/DO limiter; 429 proof; GET inquiries; label/`id` edits; shadcn rewrite; moving other `auth/` widgets; payments/chat/calendars.

## Architecture / Approach

Keep the component identical. Phase 1 proves the locator contract on the current path. Phase 2 moves file + test + imports. Phase 3 deletes the lie (old path + stale rule).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Characterize at `auth/` | Markup test, file unmoved | Test that only checks “it’s a function” and skips label/`htmlFor` |
| 2. Move to `forms/` | New path, five imports, no shim | Quiet label/`id` tweak that breaks e2e #3 |
| 3. Enforce | Zero old imports + conventions | Leaving `react-conventions.mdc` pointing at `auth/FormField` |

**Prerequisites:** sibling ranking §④; query helpers already shipped; Vitest. Playwright optional for Phase 3 smoke.
**Estimated effort:** one short session, three commitable phases.

## Open Risks & Assumptions

- `react-dom/server` + Vite’s default TSX transform is enough to import `FormField` from a `.test.ts` file. If not, fix the transform — do not add RTL.
- This slice does not reduce test-plan #3/#4/#5. That is accepted (⭐ challenge on the ranking: a folder move is cheap honesty, not lead-delivery insurance).

## Success Criteria (Summary)

- Characterization covers named export + inquiry label/`htmlFor` + multiline textarea.
- All five islands import `@/components/forms/FormField`; `auth/FormField` is gone.
- Guest inquiry and sign-in fields look and label the same as today.
