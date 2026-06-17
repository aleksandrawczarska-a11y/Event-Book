---
bootstrapped_at: 2026-06-06T00:00:00Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: event-book
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

Hand-off path: `context/foundation/tech-stack.md` (user invoked `@tech-stack.md` — resolved to foundation path).

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: event-book
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

EventBook to responsywny web-app na 3 tygodnie after-hours, solo, z auth dekoratorów, uploadem zdjęć portfolio, formularzem lead-gen i małą skalą użytkowników. 10x Astro Starter (Astro + React + TypeScript + Supabase + Tailwind) daje gotowe auth, PostgreSQL i storage pod zdjęcia bez budowania infrastruktury od zera. Hosting: Cloudflare Workers (zgodnie ze starterem). CI: GitHub Actions. *(Uwaga: pierwotny hand-off wskazywał Vercel; zaktualizowano w `tech-stack.md`.)*

## Pre-scaffold verification

| Signal      | Value   | Severity | Notes                              |
| ----------- | ------- | -------- | ---------------------------------- |
| npm package | not run | n/a      | git-clone template                 |
| GitHub repo | not run | n/a      | gh CLI unavailable                 |

Recency check unavailable. Proceeding with scaffold.

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`

**Strategy**: git-clone

**Exit code**: 0

**Files moved**: 0 (cwd already populated from prior bootstrap)

**Conflicts (.scaffold siblings)**: .env.example.scaffold, .nvmrc.scaffold, .prettierrc.json.scaffold, astro.config.mjs.scaffold, CLAUDE.md.scaffold, components.json.scaffold, eslint.config.js.scaffold, package-lock.json.scaffold, package.json.scaffold, README.md.scaffold, tsconfig.json.scaffold, wrangler.jsonc.scaffold

**.gitignore handling**: unchanged

**.bootstrap-scaffold cleanup**: deleted

**Note**: Existing `src/`, `.env`, `.dev.vars`, and `context/` preserved. User customizations in `src/lib/supabase.ts` retained.

## Post-scaffold audit

**Tool**: npm audit --json

**Summary**: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW

Run `npm audit` for details.

## Hints recorded but not acted on

| Hint                    | Value                |
| ----------------------- | -------------------- |
| bootstrapper_confidence | first-class          |
| quality_override        | false                |
| path_taken              | standard             |
| self_check_answers      | null                 |
| team_size               | solo                 |
| deployment_target       | vercel               |
| ci_provider             | github-actions       |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                 |
| has_payments            | false                |
| has_realtime            | false                |
| has_ai                  | false                |
| has_background_jobs     | false                |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings and delete those you do not need.
- Configure `.env` and `.dev.vars` with Supabase credentials before auth testing.
- Run `npm run dev` and open http://localhost:4321/
