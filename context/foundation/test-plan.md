# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-09-10

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "<the
   team is worried about X, and the failure would surface somewhere in
   <area>>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src`, `supabase`.

EventBook is a lead-gen marketplace (decorator supply, anonymous client
discovery, contact inquiry, manual portfolio moderation). All roadmap
slices F-01 and S-01–S-04 are done. Last-30d churn is concentrated on
admin/visibility. Spend the first phase there; spend the second on the
north-star inquiry path even though it is outside the 30d window. Do not
bootstrap a product Playwright suite from the starter spec.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|-------------------------|--------|------------|--------------------------------|
| 1 | A guest sees a pending or rejected portfolio photo on a public decorator profile | High | High | interview Q1, Q4; PRD FR-005, FR-008; archive S-04; hot-spot dir `src/pages` + `src/components` (6 commits/30d, all admin/visibility) |
| 2 | A non-admin can load the moderation queue or change another decorator's portfolio status | High | High | interview Q3; PRD Access Control; archive S-04 fail-closed gate; hot-spot dir `src/lib` + `src/pages` (admin commits/30d) |
| 3 | A client gets submit confirmation but the decorator never receives the lead | High | Medium | PRD US-01, FR-006, FR-007; roadmap S-03 north star (no 30d churn — interview + PRD weight this) |
| 4 | Decorator A can read or act on Decorator B's inquiries | High | Medium | PRD Access Control; abuse/authorization lens (user input + auth) |
| 5 | Inquiry flood or junk is stored as a real lead | Medium | Medium | PRD FR-006; abuse/resource + untrusted-input lens |
| 6 | Guest search lists an unpublished decorator or unpublished-profile supply | Medium | Medium | PRD FR-004; roadmap S-02 |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | Guest public profile view contains no pending/rejected portfolio photos | Empty gallery means the filter is safe | Public read path, persisted moderation status, what "approved" means for guests | integration | Mirroring the production query as the oracle |
| #2 | Non-admin cannot see the queue or get a successful moderation write | Logged-in equals admin; JWT-grant staleness is a pass | App-layer admin flag vs DB gate, session shape after role change | unit + integration | Happy-path admin-only tests |
| #3 | A valid submit creates a lead the owning decorator can see in-panel | HTTP 200 means delivered (email is a separate channel) | Submit entry, persisted inquiry, panel read, email boundary | integration | Asserting copied handler copy as the oracle |
| #4 | Decorator A cannot list or read Decorator B's inquiries | Authentication without ownership is enough | Ownership check, RLS vs app filter, inquiry identifiers | integration | Mocking away the data-access policy |
| #5 | Junk or flood submit is rejected server-side and does not become a panel lead | Client-side checks are sufficient | Server validation, abuse limits, what is persisted on reject | unit + integration | Copying the production limit numbers as the only oracle |
| #6 | Guest search does not include unpublished supply | Empty results mean the publish filter works | Search query inputs, published flag, guest vs signed-in read | integration | Full-page HTML snapshots |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-----------------|---------------|------------|--------|---------------|
| 1 | Critical-path visibility + admin gate | Prove guests cannot see hidden portfolio and non-admins cannot moderate | #1, #2 | unit + integration | change opened | testing-critical-path-coverage |
| 2 | Lead-gen + discovery contracts | Prove inquiry delivery, ownership, abuse rejection, and unpublished search hide | #3, #4, #5, #6 | integration | not started | — |
| 3 | Quality-gates wiring | Run the Vitest suite in CI so regressions cannot merge untested | cross-cutting | gates | not started | — |

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.
Recommendations in this section must be grounded in local manifests/configs
plus the MCP/tools actually exposed in the current session. If a useful docs
or search MCP such as Context7 or Exa.ai is not available, say that instead
of assuming access.

Test-base profile: **sparse** — Vitest configured, 9 `src/**/*.test.ts`
files clustered in parsers/schemas/API helpers; Playwright config exists
with a starter spec that hits playwright.dev (out of budget, see §7).
CI today runs lint + build only.

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| unit + integration | Vitest | 4.1.x | `npm test`; include `src/**/*.test.ts` |
| API mocking | none yet | — | Do not add a mock layer unless research shows the cheap test needs it |
| e2e | Playwright | 1.60.x | Config only; do not grow the starter spec this rollout |
| accessibility | none yet | — | Not a named phase |
| AI-native | none | n/a | Cost × signal: no AI-native phase |

**Stack grounding tools (current session):**
- Docs: none — Context7 / framework docs MCP not available in current session; checked: 2026-09-10
- Search: none — Exa.ai not available; WebSearch exists but was not required for runner detection; checked: 2026-09-10
- Runtime/browser: cursor-ide-browser — possible manual/agent verification, not a CI e2e layer; checked: 2026-09-10
- Provider/platform: Cloudflare API MCP needsAuth / unused; no GitHub or Supabase MCP in session; CI already on GitHub Actions; checked: 2026-09-10

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required for §3 Phase <N>" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| lint + typecheck | local + CI | required (already wired) | syntactic / type drift |
| unit + integration | local now; CI after §3 Phase 3 | required after §3 Phase 3 | logic regressions on #1–#6 |
| production build | local + CI | required (already wired) | Workers/SSR compile break |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase <N>."

### 6.1 Adding a unit test

TBD — see §3 Phase 1 for the fail-closed admin-gate / status-allow-list pattern.

### 6.2 Adding an integration test

TBD — see §3 Phase 1 for guest public-profile hide of non-approved portfolio.

### 6.3 Adding an e2e test

Out of scope this rollout (interview Q5). Do not extend the starter Playwright spec.

### 6.4 Adding a test for a new API endpoint

TBD — see §3 Phase 1 for non-admin moderation denial; §3 Phase 2 for inquiry ownership and abuse rejection.

### 6.5 Adding a test for a new content-build rule

Not applicable — EventBook has no content-build pipeline.

### 6.6 Per-rollout-phase notes

(none yet)

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Starter Playwright vs playwright.dev** — zero product signal. Re-evaluate if a later rollout adds a real browser critical-path that unit/integration cannot catch. (Source: Phase 2 interview Q5.)
- **Landing/marketing UI snapshots** — not requested; high churn, low marketplace signal. Re-evaluate if a public landing regression becomes a top-3 risk.
- **Admin filter chrome / empty-copy polish** — styling of an already-shipped filter. Re-evaluate if the filter contract itself regresses (that belongs to #2 / Phase 1, not CSS).
- **Payments, chat, booking calendar, auto-moderation** — PRD non-goals / roadmap parked. Re-evaluate if a slice unparks them.
- **High × Low secret leakage** — AGENTS already forbids hardcoded keys; treat as review/observability, not a rollout phase.

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-09-10
- Stack versions last verified: 2026-09-10
- AI-native tool references last verified: 2026-09-10

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
