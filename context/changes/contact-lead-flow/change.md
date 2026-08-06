---
change_id: contact-lead-flow
title: Contact inquiry form, email notify, and decorator inquiry panel
status: implemented
created: 2026-07-27
updated: 2026-08-06
archived_at: null
---

## Notes

Roadmap S-03 — north star lead-gen: klient submits contact inquiry (event date, needs, contact details); dekorator receives email and sees inquiries in panel. Prerequisites: S-02 (`client-discovery`, done), F-01 schema `contact_inquiries` + RLS already in place. PRD: US-01, FR-006, FR-007. Locked: Resend → `contact_email` only; POST `/api/inquiries`; honeypot + light rate limit; email fail-soft; `/dashboard/inquiries`.
