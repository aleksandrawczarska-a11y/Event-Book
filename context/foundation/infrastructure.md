---
project: event-book
recorded_at: 2026-05-29T15:00:00.000Z
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 + React 19
  runtime: Cloudflare Workers (workerd)
---

## Recommendation

**Deploy on Cloudflare Workers.**

EventBook uses the 10x Astro Starter defaults: SSR via `@astrojs/cloudflare`, local dev on workerd, and production deploy through Wrangler. Adapter and `@wrangler.jsonc` are already in the repo — no platform swap required. Supabase (auth, DB, storage) stays external; only the Astro app runs on Workers.

## Platform alignment

| Artifact | Status |
|---|---|
| `@astrojs/cloudflare` in @astro.config.mjs | configured |
| @wrangler.jsonc | configured (`nodejs_compat`, assets from `./dist`) |
| `.dev.vars` for local secrets | required (see @README.md) |
| Deploy command | `npx wrangler deploy` |

Previous hand-off mentioned Vercel; decision revised to Cloudflare to match starter scaffolding and reduce adapter churn.

## Operational story

- **Public URL**: https://event-book.event-book.workers.dev (Worker name + account subdomain `event-book`). Not App Store / Play — web only (PRD guardrail).
- **Preview deploys**: not configured yet — add Cloudflare Workers preview URLs or GitHub Actions deploy-on-PR in M1L5.
- **Secrets**: `SUPABASE_URL`, `SUPABASE_KEY` — local: `.env` + `.dev.vars`; CI: GitHub repository secrets; production: `npx wrangler secret put SUPABASE_URL` / `SUPABASE_KEY` or Cloudflare dashboard.
- **Rollback**: redeploy previous Worker version via Cloudflare dashboard or `wrangler deployments list` + rollback; no automatic DB rollback (Supabase migrations are separate).
- **Approval**: production secret rotation and first deploy require human; agent may run `npm run build` and lint locally.
- **Logs**: `npx wrangler tail` for runtime logs; GitHub Actions for CI logs.

## Getting started

1. `npm run build` — verify production bundle.
2. `npx wrangler login` — authenticate Wrangler CLI.
3. `npx wrangler secret put SUPABASE_URL` and `SUPABASE_KEY` — set production secrets.
4. `npx wrangler deploy` — deploy Worker + static assets.
5. Confirm auth flows against the deployed URL.

## Out of scope

- Vercel adapter / `vercel.json`
- Multi-region HA beyond Cloudflare edge defaults
- CI auto-deploy pipeline (tracked separately in M1L5)

See also @context/foundation/tech-stack.md and @README.md (Deployment section).
