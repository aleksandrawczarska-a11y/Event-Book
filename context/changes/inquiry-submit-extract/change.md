---
change_id: inquiry-submit-extract
title: Extract inquiry compose from POST into lib
status: implementing
created: 2026-09-13
updated: 2026-09-13
archived_at: null
---

## Notes

m4l4 interview lock **B (C-submit)**: extract the published-inquiry compose step from `POST /api/inquiries` into `src/lib/` (not `services/`). First question was option choice, not ranking confirm. ⭐ C-submit was challenged: do not move an untested 429⇒no-insert seam — Phase 1 of this plan is that characterization (same proof as unfinished `inquiry-rate-limit-proof` Phase 2). Not FormField (already shipped). Not KV/DO. Not query-helper redo.
