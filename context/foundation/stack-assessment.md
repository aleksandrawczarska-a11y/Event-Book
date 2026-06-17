---
project: event-book
assessed_at: 2026-05-29T12:00:00.000Z
agent_readiness: ready-with-compensation
context_type: brownfield
stack_components:
  language: TypeScript
  framework: Astro 6 + React 19
  build_tool: Astro / Vite 7
  test_runner: null
  package_manager: npm
  ci_provider: github-actions
  deployment_target: cloudflare-workers
gates_passed: 7
gates_failed: 2
---

## Stack Components

**Language — TypeScript 5.9.** `tsconfig.json` extends `astro/tsconfigs/strict` with path alias `@/*` → `./src/*`. ESLint uses `typescript-eslint` with `strictTypeChecked` and `stylisticTypeChecked` presets (`eslint.config.js`). Type discipline is enforced at compile time and lint time.

**Framework — Astro 6.4 + React 19.** Server-rendered app (`output: "server"`) with React islands via `@astrojs/react`. File-based routing under `src/pages/` (e.g. `index.astro`, `dashboard.astro`, `auth/signin.astro`). API routes live in `src/pages/api/` (auth endpoints). Middleware at `src/middleware.ts` guards `/dashboard` via Supabase session. Layouts in `src/layouts/`, UI components in `src/components/`.

**Build tool — Astro / Vite 7.** `astro.config.mjs` configures integrations (React, sitemap), Tailwind via `@tailwindcss/vite`, and Cloudflare adapter. Build and dev scripts are standard Astro (`npm run dev`, `npm run build`).

**Data & auth — Supabase.** `@supabase/ssr` + `@supabase/supabase-js` with env schema in `astro.config.mjs` (`SUPABASE_URL`, `SUPABASE_KEY`). Client factory in `src/lib/supabase.ts`.

**Styling — Tailwind CSS 4** with shadcn-style primitives (`src/components/ui/`).

**Package manager — npm.** CI uses `npm ci` with Node 22.

**CI/CD — GitHub Actions.** `.github/workflows/ci.yml` runs `astro sync`, `lint`, and `build` on push/PR to `master`.

**Deployment — Cloudflare Workers.** `@astrojs/cloudflare` in `astro.config.mjs`, `@wrangler.jsonc` for Wrangler deploy. Aligned with @context/foundation/tech-stack.md and @context/foundation/infrastructure.md.

**Instruction files — `.cursor/rules/10x-course.mdc` only.** No project-specific `AGENTS.md` or `CLAUDE.md` yet.

**Test runner — not configured.** No Vitest, Jest, or Playwright in `package.json` or config files.

## Quality Gate Assessment

| Component   | Typed | Convention | Training Data | Documented | Verdict |
|-------------|-------|------------|---------------|------------|---------|
| Language    | ✓     | —          | —             | —          | pass    |
| Framework   | —     | ✓          | ✓             | ✓          | pass    |
| Build tool  | —     | ✓          | ✓             | ✓          | pass    |
| Test runner | —     | ✗          | —             | ✗          | fail    |

Legend: ✓ = pass, ✗ = fail, ~ = partial, — = not applicable

### Gate Details

**Language — Typed: pass**
- Evidence: `tsconfig.json` line 2 — `"extends": "astro/tsconfigs/strict"`.
- Evidence: `eslint.config.js` lines 15–16 — `tseslint.configs.strictTypeChecked` and `stylisticTypeChecked`.
- Evidence: `typescript` ^5.9.3 in `package.json` devDependencies.

**Framework — Convention-based: pass**
- Evidence: Astro file-based routing — `src/pages/index.astro`, `src/pages/dashboard.astro`, `src/pages/auth/*.astro`.
- Evidence: API route convention — `src/pages/api/auth/signin.ts`, `signup.ts`, `signout.ts`.
- Evidence: Middleware pattern — `src/middleware.ts` with `defineMiddleware` and `PROTECTED_ROUTES`.
- Evidence: Component/layout split — `src/layouts/Layout.astro`, `src/components/`.

**Framework — Popular in training data: pass**
- Astro and React are mainstream choices within the JS/TS ecosystem. Agent training data includes extensive Astro 4–6 and React 18–19 patterns.

**Framework — Well-documented: pass**
- Astro docs are versioned at https://docs.astro.build (current v6).
- React docs at https://react.dev cover React 19.
- Supabase JS docs at https://supabase.com/docs/reference/javascript/introduction.

**Build tool — Convention-based: pass**
- Evidence: Standard Astro project layout; `astro.config.mjs` is the single build configuration entry point.
- Evidence: `@/*` path alias in `tsconfig.json` matches starter conventions.

**Build tool — Popular in training data: pass**
- Vite and Astro build tooling are widely represented in JS training data.

**Build tool — Well-documented: pass**
- Astro build/deploy docs cover adapter configuration and env schema.

**Test runner — Convention-based: fail**
- Evidence: No `vitest.config.*`, `jest.config.*`, or `playwright.config.*` in project root.
- Evidence: No `test` script in `package.json`.
- Impact: Agent has no established pattern for where tests live, how to run them, or what assertions look like in this project.

**Test runner — Well-documented: fail**
- Evidence: Absence of test config means no project-local test documentation for the agent to follow.

## Gaps & Compensation

### Gap 1: No test runner configured

**Why it matters:** Without a test framework, the agent cannot verify changes automatically, invents ad-hoc test patterns, or skips testing entirely. For EventBook (auth flows, lead-gen forms, search), even a minimal test suite reduces regression risk.

**Compensation:** Add Vitest for unit/integration tests and Playwright for E2E before feature work scales. Document conventions in `AGENTS.md`.

### Gap 2: No project-specific instruction file

**Why it matters:** `.cursor/rules/10x-course.mdc` covers the 10xDevs course chain, not EventBook-specific conventions (routing, auth, Supabase patterns, component structure). The agent must rediscover these from source on every session.

**Compensation:** Create `AGENTS.md` at project root with stack version pins, folder conventions, and auth/data-access patterns.

### Gap 3: Deployment documentation (resolved)

**Status:** Hosting target updated to Cloudflare Workers. Adapter in code matches `tech-stack.md` and `infrastructure.md`. Document deploy steps in @AGENTS.md and @README.md — do not suggest Vercel migration.

### Recommended Instruction File Additions

Copy the following into a new `AGENTS.md` at the project root:

```markdown
## Stack versions

- Astro 6 (SSR, `output: "server"`)
- React 19 (islands only — use `.tsx` for interactive components, `.astro` for static/server)
- TypeScript strict — extend `astro/tsconfigs/strict`; never weaken `strict` without explicit approval
- Supabase Auth via `@supabase/ssr` — always use `createClient()` from `src/lib/supabase.ts`
- Tailwind CSS 4 — utility classes in components; global styles in `src/styles/global.css`
- Deployment target: **Cloudflare Workers** (`@astrojs/cloudflare`, `npx wrangler deploy`)

## Project layout

- `src/pages/` — file-based routes (`.astro` pages, `api/` subfolder for endpoints)
- `src/pages/api/` — server endpoints; export named HTTP method handlers (`GET`, `POST`, etc.)
- `src/middleware.ts` — auth guard; add new protected routes to `PROTECTED_ROUTES`
- `src/components/` — reusable UI; `ui/` for primitives, `auth/` for auth forms
- `src/layouts/` — page shells
- `src/lib/` — shared utilities and Supabase client
- `@/*` path alias maps to `src/*`

## Coding conventions

- New pages: create `src/pages/<route>.astro`; use `Layout` from `src/layouts/Layout.astro`
- Interactive UI: React components in `src/components/` with `.tsx` extension
- Auth checks: rely on `context.locals.user` set by middleware — do not duplicate session logic in pages
- Env vars: `SUPABASE_URL` and `SUPABASE_KEY` via Astro env schema (`astro.config.mjs`); never hardcode secrets
- Lint before commit: `npm run lint` (ESLint strict type-checked + Prettier)

## Testing (to be configured)

- Unit/integration: Vitest — colocate tests as `<file>.test.ts` next to source
- E2E: Playwright — tests in `e2e/` directory
- Run: `npm test` (add script when Vitest is installed)
- Every new API route (`src/pages/api/`) must have at least one integration test
- Auth flows (signup, signin, protected dashboard) require E2E coverage before merge

## Agent steering notes

- This is EventBook — a marketplace for event decorators (Booksy-style lead-gen, no payments in MVP)
- Do not add payment, realtime chat, or booking calendar features (out of MVP scope per PRD)
- Prefer Astro server components/pages for data fetching; use React islands only when client interactivity is required
```

## Summary

**Overall verdict: ready-with-compensation**

EventBook's stack is strongly agent-friendly on the fundamentals: TypeScript strict mode, convention-based Astro routing, mainstream JS frameworks with excellent documentation, and CI lint/build gates. The stack passes 7 of 9 applicable quality criteria.

The two failures both stem from the missing test runner — no conventions and no local test documentation. This is expected for a freshly bootstrapped starter and is straightforward to compensate with Vitest + Playwright and an `AGENTS.md` conventions file.

**Key strengths:** TypeScript strict + ESLint type-checked linting; Astro file-based routing with clear `pages/`, `api/`, `middleware`, and `components/` layout; Supabase auth patterns already established; GitHub Actions CI.

**Key gaps:** No test framework at assessment time (since addressed); AGENTS.md now present; deployment target aligned with Cloudflare adapter.

**Recommended next step:** Run `/10x-health-check` to audit dependencies, config completeness, and operational readiness against these identified gaps.
