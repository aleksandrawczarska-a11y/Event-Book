---
project: event-book
planned_at: 2026-05-29T16:00:00.000Z
platform: Cloudflare Workers
deploy_command: npx wrangler deploy
status: deployed
deploy_url: https://event-book.event-book.workers.dev
version_id: 282ad041-a5c7-439c-9f39-d47603ac040c
inputs:
  - context/foundation/infrastructure.md
  - context/foundation/tech-stack.md
  - wrangler.jsonc
  - astro.config.mjs
---

# Deploy Plan — EventBook (first production deploy)

**Platform:** Cloudflare Workers (SSR via `@astrojs/cloudflare`)  
**Not Pages** — deploy uses `wrangler deploy`, not `pages deploy`.

## Pre-flight status (verified before plan)

| Check | Result |
|---|---|
| `npm run build` | ✅ Pass — `dist/` generated, adapter `@astrojs/cloudflare` |
| `npx wrangler whoami` | ✅ Logged in — `aleksandra.owczarska@ceneo.pl` |
| `@astrojs/cloudflare` in astro.config | ✅ Configured |
| `wrangler.jsonc` | ✅ Renamed to `event-book` |
| Local Supabase vars (`.env` / `.dev.vars`) | ⚠️ Still empty in repo — set Worker secrets in dashboard or via CLI |
| `npm run lint` | ⚠️ CRLF/prettier noise on Windows — non-blocking for deploy |

## Phase 0 — Manual gates (human required)

- [x] **0.1 Supabase cloud project** — user confirmed prerequisites done.
- [x] **0.2 Worker name** — `event-book` in `wrangler.jsonc`.
- [x] **0.3 Approve this plan** — approved (execute full).

## Phase 1 — Agent executes (after approval)

- [x] **1.1** Rename worker in `wrangler.jsonc`: `"name": "event-book"`.
- [x] **1.2** Run `npm run build` — `dist/` built successfully.
- [x] **1.3** Set Cloudflare Worker secrets — `SUPABASE_URL` and `SUPABASE_KEY` on Worker `event-book`.
- [ ] **1.4** Deploy — **partial**: Worker uploaded to Cloudflare; **blocked** on `workers.dev` subdomain registration (non-interactive Wrangler cannot confirm).
- [ ] **1.5** Capture deploy URL — pending subdomain registration.

### Blocker — register `workers.dev` subdomain (one-time)

Wrangler error: *"You need to register a workers.dev subdomain before publishing to workers.dev"*

**Fix (pick one):**

1. **Dashboard (recommended):** open and complete onboarding:  
   https://dash.cloudflare.com/00c84866175958b3ae63d7bf58872b5e/workers/onboarding

2. **Interactive terminal:** run `npx wrangler deploy` locally and answer **yes** when asked to register subdomain.

Then re-run deploy — URL will be: `https://event-book.<your-subdomain>.workers.dev`

### Execution log (2026-06-17)

- KV namespace `event-book-session` provisioned (SESSION binding).
- Worker script `event-book` uploaded (version `4d43523f-3c20-4925-90d3-9f20698fde60`).
- Public route **not** published — subdomain gate.

## Phase 2 — Verification (after deploy)

- [ ] **2.1** `GET /` — homepage loads (200).
- [ ] **2.2** `GET /auth/signin` — sign-in page renders.
- [ ] **2.3** Auth smoke test (if Supabase configured): sign-up or sign-in flow; protected `/dashboard` redirects when logged out.
- [ ] **2.4** `npx wrangler tail` — no fatal runtime errors on first requests.

## Phase 3 — Post-deploy (optional, out of first deploy scope)

- [ ] GitHub Actions auto-deploy on merge (M1L5 follow-up).
- [ ] Custom domain + DNS on Cloudflare.
- [ ] Fix Windows CRLF lint (`npm run format` + `.gitattributes` `* text=auto eol=lf`).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Empty Supabase secrets → auth broken in prod | Phase 0.1 mandatory before Phase 1.3 |
| Worker name collision if `event-book` taken | Keep `10x-astro-starter` or pick unique name |
| First deploy exposes default starter branding | Accept for MVP; re-deploy after rename |
| `wrangler secret put` is interactive | User present for Phase 1.3 |

## Rollback

Redeploy previous version via Cloudflare dashboard → Workers → Deployments → Rollback, or note deployment ID from `wrangler deployments list`.

## Out of scope (this run)

- Vercel / `@astrojs/vercel`
- CI pipeline changes
- Database migrations (Supabase Auth only today)
