---
change_id: inquiry-rate-limit-proof
title: Prove the 6th inquiry POST returns 429 and does not insert
status: implementing
created: 2026-09-13
updated: 2026-09-13
archived_at: null
---

## Notes

Locked m4l4 interview choice **A only**: prove test-plan risk #5 — the 6th POST to `/api/inquiries` returns `429` AND `insert` is not called. Stop mocking `inquiry-abuse` in the handler test so the real in-memory limiter participates. Not B/C/D. Research: `context/changes/inquiry-flow-analysis/research.md`.
