---
change_id: admin-queue-filter
title: Admin queue status filter for reversible moderation
status: implementing
created: 2026-09-10
updated: 2026-09-10
archived_at: null
---

## Notes

Follow-up to archived S-04 (`admin-moderation`). Desired End State said Approve/Reject are reversible by revisiting the queue with a status filter; that filter was cut (Q6/Q12). PATCH already writes `approved`/`rejected`; `/dashboard` still hardcodes `pending`. First plan step is a TDD RED test for `parseModerationQueueStatus` so `/10x-tdd` can drive the phase.
