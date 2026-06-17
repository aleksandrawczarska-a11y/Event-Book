---
project: event-book
checked_at: 2026-05-29T14:30:00.000Z
health_status: critical-issues
context_type: brownfield
language_family: js
stack_assessment_available: true
checks_run:
  - lockfile
  - dependency_audit
  - outdated_deps
  - test_runner
  - ci_cd
  - configuration
audit_findings:
  critical: 0
  high: 0
  moderate: 5
  low: 0
test_runner_detected: false
ci_provider: github-actions
recommended_fixes: 4
---

## Dependency Health

### Lockfile

```
Status: present (package-lock.json)
Package manager: npm
```

Lockfile is present and CI uses `npm ci` — builds are reproducible.

### Security Audit

```
Tool: npm audit --json
Summary: 0 CRITICAL, 0 HIGH, 5 MODERATE, 0 LOW
Direct vs transitive: 1 direct (@astrojs/check), 4 transitive (yaml chain via @astrojs/language-server)
```

All findings are MODERATE severity (CVSS 4.3) in the dev-tooling chain — no production runtime exposure:

- **@astrojs/check** ^0.9.9 (direct) — transitive via `yaml-language-server` → `yaml` stack overflow advisory (GHSA-48c2-rrv3-qjmp). Fix: await upstream `@astrojs/check` update; downgrade to 0.9.2 is a semver-major regression — monitor, do not force-downgrade.
- **yaml** 2.0.0–2.8.2 (transitive) — Stack Overflow via deeply nested YAML collections.
- **yaml-language-server**, **volar-service-yaml**, **@astrojs/language-server** (transitive) — same chain.

No CRITICAL or HIGH findings. Safe to proceed with agent work after addressing the test runner gap.

### Outdated Dependencies

```
Packages with major version gaps: 4
```

Direct dependencies one major version behind latest (informational — no urgent action):

- **eslint**: 9.39.4 → 10.4.1 (1 major behind)
- **@eslint/js**: 9.39.4 → 10.0.1 (1 major behind)
- **typescript**: 5.9.3 → 6.0.3 (1 major behind)
- **lint-staged**: 16.4.0 → 17.0.7 (1 major behind)

Minor/patch gaps on core runtime deps (react, astro, supabase, tailwind) are within normal semver range and do not require immediate action.

## Test Suite

```
Test runner: not detected
Tests found: not applicable
Test execution: not attempted
```

```
⚠ No test runner detected. The agent cannot verify its own changes.
Recommended: Install Vitest for unit/integration tests and Playwright for E2E.
```

No `vitest.config.*`, `jest.config.*`, `playwright.config.*`, or `test` script in `package.json`. This matches the gap identified in `stack-assessment.md`.

## CI/CD

```
Provider: GitHub Actions
Configuration: .github/workflows/ci.yml
```

| Stage      | Status | Notes                                              |
|------------|--------|----------------------------------------------------|
| Lint       | ✓      | `npm run lint` (ESLint strict type-checked)        |
| Test       | ✗      | No test runner configured                          |
| Build      | ✓      | `npm run build` with Supabase secrets              |
| Type check | ~      | Covered indirectly via ESLint `strictTypeChecked`; no standalone `tsc` or `astro check` step |
| Security   | ✗      | No `npm audit` or Dependabot scan in pipeline      |

CI pipeline exists and runs lint + build on push/PR to `master`. Test stage will be added once a test runner is configured.

## Configuration

### High severity

No high-severity configuration gaps detected. TypeScript strict mode is active (`tsconfig.json` extends `astro/tsconfigs/strict`), ESLint and Prettier are configured.

### Medium severity

No medium-severity gaps. `eslint.config.js` and `.prettierrc.json` are present and wired into `npm run lint` / `npm run format`.

### Low severity

- **`.editorconfig`** — Missing. Editors may apply inconsistent indentation without it. Fix: add a minimal `.editorconfig` with `indent_style = space`, `indent_size = 2`, `end_of_line = lf`.
- **`.env.example`** — Missing. New contributors and the agent cannot discover required env vars without reading `astro.config.mjs`. Fix: create `.env.example` with `SUPABASE_URL=` and `SUPABASE_KEY=` placeholders.

## Stack Assessment Cross-Reference

```
Stack assessment: context/foundation/stack-assessment.md
Agent readiness (from stack-assess): ready-with-compensation
```

| Quality Gate Gap              | Health-Check Finding                                    | Status      |
|-------------------------------|---------------------------------------------------------|-------------|
| Test runner: fail             | No test runner detected; CI has no test stage           | Reinforced  |
| No AGENTS.md (compensation)   | AGENTS.md not present; only course rule file exists       | Reinforced  |
| Typed: pass                   | tsconfig strict + ESLint strictTypeChecked active       | Mitigated   |
| Deployment adapter mismatch   | Resolved — Cloudflare Workers in tech-stack, infrastructure, and code | Mitigated   |

Stack-assess recommended compensation entries (Vitest, Playwright, AGENTS.md) have not yet been applied. Health-check confirms these are the highest-impact gaps before agent-assisted feature work.

## Recommended Fixes

### Fix before agent work (Category A)

### 1. No test runner configured

**Impact**: The agent cannot verify its own changes. Every code edit is a manual-only validation — high regression risk for auth flows and API routes.
**Severity**: high
**Effort**: moderate (15–30 min)
**Fix**:

```bash
# Vitest for unit/integration tests
npm init vitest@latest

# Playwright for E2E (auth flows, dashboard guard)
npm init playwright@latest

# Add to package.json scripts:
# "test": "vitest run",
# "test:e2e": "playwright test"
```

Start with one smoke test for `src/lib/utils.ts` and one E2E test for the sign-in page redirect.

### 2. CI pipeline missing test stage

**Impact**: Even after adding a local test runner, changes can merge without running tests unless CI enforces it.
**Severity**: medium
**Effort**: quick (< 5 min) — after test runner is installed
**Fix**: Add to `.github/workflows/ci.yml` after the lint step:

```yaml
- run: npm test
```

### 3. Missing .env.example

**Impact**: Agent may guess env var names or omit required Supabase configuration when adding features.
**Severity**: low
**Effort**: quick (< 5 min)
**Fix**:

```bash
# Create .env.example with:
SUPABASE_URL=
SUPABASE_KEY=
```

### 4. Moderate audit findings in dev tooling

**Impact**: Low for agent workflows — all findings are in `@astrojs/check` dev tooling, not production runtime. No immediate action required.
**Severity**: low
**Effort**: quick (monitor)
**Fix**: Watch for `@astrojs/check` updates that resolve the transitive `yaml` advisory. Do not downgrade to 0.9.2 (semver-major regression).

### Addressed in upcoming lessons (Category B)

### Missing AGENTS.md

**Lesson**: [Agent Onboarding: Agents.md, AI Rules i feedback loops (M1L4)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l4)
**What you'll do there**: Build project-specific agent instruction files with routing conventions, auth patterns, and stack version pins. Stack-assess already drafted ready-to-paste content — M1L4 walks you through finalizing it.

### CI/CD test and security hardening

**Lesson**: [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)
**What you'll do there**: Extend CI with test enforcement and Cloudflare Workers deploy (`wrangler deploy`, GitHub Actions auto-deploy).

### Deployment configuration

**Lesson**: [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)
**What you'll do there**: Configure Cloudflare Workers production deploy, Wrangler secrets, and auto-deploy on merge via GitHub Actions.

## Summary

Health status: **critical-issues**

EventBook has a solid foundation for agent collaboration: pinned dependencies via `package-lock.json`, zero CRITICAL/HIGH security findings, TypeScript strict mode, ESLint + Prettier tooling, and a working GitHub Actions lint/build pipeline. The single blocking gap is the absence of a test runner — without Vitest or Playwright, the agent cannot automatically verify changes, which is the highest-impact risk for ongoing development.

Address the test runner setup (Category A fix #1), then proceed to agent onboarding in M1L4 where you'll build `AGENTS.md` and finalize the compensation strategies from stack-assess. Infrastructure hardening (CI test stage, Cloudflare deploy) follows in M1L5.

Next step: Install Vitest and Playwright, add a smoke test, then continue to **agent onboarding (M1L4)** — both greenfield and brownfield paths converge with equivalent context artifacts at that point.
