# Repository Guidelines

EventBook is a responsive web marketplace for event decorators and clients (lead-gen MVP, no payments). MVP scope and user flows: @context/foundation/prd.md.

## Hard Rules

- Do not add online payments, realtime chat, or booking calendars — out of MVP scope per @context/foundation/prd.md.
- Never hardcode `SUPABASE_URL` or `SUPABASE_KEY`; declare them only via the Astro env schema in @astro.config.mjs and load from `.env` / `.dev.vars`.
- Create Supabase clients only through `createClient()` in @src/lib/supabase.ts — do not import `@supabase/supabase-js` directly in pages or components.
- Add every auth-guarded path to `PROTECTED_ROUTES` in @src/middleware.ts; use `context.locals.user` in pages — do not duplicate session checks.
- Do not weaken strict TypeScript in @tsconfig.json.
- Production deploy target is **Cloudflare Workers** per @context/foundation/tech-stack.md and @context/foundation/infrastructure.md — keep `@astrojs/cloudflare` in @astro.config.mjs and deploy with `npx wrangler deploy` (@wrangler.jsonc). Do not add `@astrojs/vercel` or `vercel.json`.

## Build, Test, and Development Commands

- `npm run dev` — local dev server (Supabase vars in `.env` and `.dev.vars`; setup: @README.md Supabase section).
- `npm test` — Vitest unit tests.
- `npm run lint` — ESLint strict type-checked; run before every PR.
- `npm run build` — production build for Cloudflare Workers; CI gate (@.github/workflows/ci.yml) needs `SUPABASE_URL` and `SUPABASE_KEY` GitHub secrets.
- `npx wrangler deploy` — deploy to Cloudflare Workers; set secrets via `npx wrangler secret put` (see @README.md Deployment).
- `npm run format` — Prettier write pass.

## Project Structure

- `src/pages/` — file-based routes (`.astro`); `src/pages/api/` — server endpoints with named HTTP exports.
- `src/components/` — `ui/` primitives, `auth/` forms; `.tsx` for interactive islands, `.astro` for server/static pages.
- `src/layouts/` — page shells (@src/layouts/Layout.astro is the default).
- `src/lib/` — shared utilities; `@/`* → `src/*` per @tsconfig.json.
- Auth route map: @README.md (Auth routes section).

New pages: `src/pages/<route>.astro` using `Layout`. New API routes: follow @src/pages/api/auth/signin.ts.

## Coding Style & Naming Conventions

Enforced by @eslint.config.js (`strictTypeChecked`, React Compiler) and @.prettierrc.json. Prefix intentionally unused bindings with `_`. Merge Tailwind classes with `cn()` from @src/lib/utils.ts.

## Testing Guidelines

- Unit/integration: Vitest — colocate as `src/**/*.test.ts` (reference: @src/lib/utils.test.ts); config at @vitest.config.ts.
- E2E: Playwright specs in `tests/` (@playwright.config.ts).
- CI runs lint + Vitest + build (@.github/workflows/ci.yml). Playwright e2e stays local (needs a running app and seed).

## Mutation testing

Repo uses Stryker for selective mutation testing on risk-critical modules. Run it only for code covered by the current change or a risk from test-plan.md, prefer narrowed scope with `--mutate "path/to/file.ts:start-end"`, and do not chase 100% mutation score. Survived mutants should be reviewed one by one: add an assertion only when the mutant represents a user-visible or business-relevant bug.

