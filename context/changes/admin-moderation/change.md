---
change_id: admin-moderation
title: Admin portfolio moderation (approve/reject queue)
status: impl_reviewed
created: 2026-08-07
updated: 2026-09-10
archived_at: null
---

## Notes

Roadmap S-04 — administrator can manually moderate portfolio content. Prerequisites: S-01 (`decorator-onboarding`, done); F-01 schema `moderation_status` enum + `is_admin()` + admin UPDATE RLS on `portfolio_entries` already in place. PRD: FR-008. Locked: portfolio only (not profiles/inquiries); post-publish moderation (default stays `approved`); "hide" = `rejected` (no new enum value); admin detection via middleware `locals.isAdmin` reading `app_metadata.role`, fail-closed; moderation UI lives inside `/dashboard` (admin-only section, no separate `/admin` route); default queue view = `pending`; approve/reject is reversible; decorator sees a status badge on `/dashboard/portfolio`; admin does not need own decorator profile.
