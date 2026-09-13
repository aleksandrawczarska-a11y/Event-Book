---
change_id: inquiry-query-helpers
title: Extract published-profile and inbox inquiry query helpers
status: implemented
created: 2026-09-13
updated: 2026-09-13
archived_at: null
---

## Notes

Do query helpers now. Extract fetchPublishedDecoratorProfile and listInquiriesForProfile (research §④ C-query-helpers). SSR pages stay SSR. No GET /api/inquiries. No KV/DO limiter. No 204 UI. No FormField move. No submitInquiry extract. Do not implement inquiry-rate-limit-proof. Characterization tests of the helpers (same results / published-only / owner list shape); do not expand into full risk #4 e2e unless the pages already make that cheap.
