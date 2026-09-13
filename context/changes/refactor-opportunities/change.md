---
change_id: refactor-opportunities
title: Rank inquiry-flow debt and plan the next unused refactor
status: implemented
created: 2026-09-13
updated: 2026-09-13
archived_at: null
---

## Notes

We have a repository analysis that documents technical debt and structural risks: `context/changes/inquiry-flow-analysis/research.md`. This change answers which of those problems are worth fixing, in what target shape, and in what order.

Dedicated explorer report landed after plan+review (kept in `research.md`: ranking + ast-grep + Krok 2 audit). Query helpers already shipped (`inquiry-query-helpers`, ae815bb) — do not re-plan that extract. Planning lock: next safest unused opportunity is C-formfield-home (move `FormField` out of `auth/` to `src/components/forms/`). Not C-submit (first preliminary step is `inquiry-rate-limit-proof`). Not C-limiter (świadome MVP). Plan review: SOUND / ready-with-nits. Phases 1–3 implemented (characterization, move to `components/forms`, conventions lock).
