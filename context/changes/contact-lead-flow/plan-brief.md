# Contact Lead Flow — Plan Brief

> Full plan: `context/changes/contact-lead-flow/plan.md`

## What & Why

North-star lead-gen (S-03): a client on a public decorator profile submits an inquiry (event date, needs, contact details); the decorator gets an email and sees the lead in the panel. Proves EventBook’s marketplace hypothesis (US-01, FR-006, FR-007).

## Starting Point

`contact_inquiries` + RLS already shipped in F-01. S-02 public profile has a disabled Contact CTA. Dashboard/portfolio API patterns exist; there is no inquiry UI and no email provider yet (`SUPABASE_KEY` is anon-only).

## Desired End State

Inline form on `/d/[id]` → `POST /api/inquiries` → DB row + Resend (`fetch`) to `contact_email` (fail-soft) → client thank-you → decorator `/dashboard/inquiries` list (direct SSR) with expand. No inquiry status workflow in this slice.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Scope | Form + DB + email + panel | Full US-01 north star | Plan |
| Email provider | Resend via `fetch` | No SDK on Workers | Plan review |
| Panel data | Direct SSR in `inquiries.astro` | Matches portfolio page; no GET list API | Plan review |
| Client confirmation | Inline success on profile | No account; no extra route | Plan |
| Form placement | Inline on `/d/[id]` | SSR-friendly funnel | Plan |
| Submit path | `POST /api/inquiries` | Secrets + email server-side | Plan |
| Abuse | Honeypot + light rate limit | MVP without Turnstile | Plan |
| Email failure | Keep row; log; client success | Panel is source of truth | Plan |
| Panel | `/dashboard/inquiries` + expand | Match portfolio nav pattern | Plan |
| Fields | Existing schema only; phone optional | No migration | Plan |
| Statuses | Out of scope | Keep FR-007 thin | Plan |
| Who can submit | Anon + authenticated | Matches existing RLS | Plan |
| Notify address | `contact_email` only | Anon key cannot read auth.users | Plan |
| Tests | Unit + mocked helpers/handler | Match discovery depth | Plan |

## Scope

**In scope:** API + Resend, public form UX, decorator inquiries panel, abuse basics, docs/secrets.

**Out of scope:** Read/archive statuses, Turnstile, service-role auth email fallback, e2e Playwright in CI, chat/payments/calendar.

## Architecture / Approach

Browser form → Worker `POST /api/inquiries` (zod → published check → insert → Resend via fetch) → JSON success. Decorator panel SSR-loads own rows in `dashboard/inquiries.astro` (RLS). Email misconfig does not block lead persistence.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. API + email | Validated insert + Resend helper | Secrets / Workers email debugging |
| 2. Public form | CTA + inline form + success | UX polish / a11y honeypot |
| 3. Panel | `/dashboard/inquiries` + nav | Empty states / expand UX |
| 4. Verify | Tests + full funnel smoke | Resend deliverability in prod |

**Prerequisites:** S-02 done; F-01 inquiries RLS; Resend account for real mail (optional locally).
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- In-memory rate limit is weak across Worker isolates — acceptable until abuse appears.
- Published profiles are assumed to always have `contact_email` (enforced at publish).
- Resend domain/`from` verification required before production deliverability.

## Success Criteria (Summary)

- Client can submit an inquiry without an account and see confirmation.
- Decorator receives email (when configured) and sees the lead in the panel.
- Unpublished targets and honeypot submissions do not create stray leads.
