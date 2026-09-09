# Admin Queue Status Filter Implementation Plan

## Overview

Give an administrator a `?status=` filter on the `/dashboard` Moderation section so Approve/Reject stay reversible. Continues archived S-04 (`admin-moderation`, FR-008). No new routes, no new enum values, no pending-count badge.

## Current State Analysis

- `PATCH /api/admin/portfolio/[id]` already accepts `approved | rejected` and updates `portfolio_entries.moderation_status`.
- `src/pages/dashboard.astro` SSR-loads the queue with a hardcoded `.eq("moderation_status", "pending")` (limit 50). After reject, the entry leaves the UI and cannot be brought back without a raw SQL update.
- `ModerationQueue.tsx` always removes the row after a successful PATCH and always shows both Approve and Reject. Empty copy says "No pending portfolio entries".
- `ModerationStatus` already exists in `src/types.ts` as `"pending" | "approved" | "rejected"`.
- Phase 1 is **TDD'able and unimplemented**: `src/lib/moderation-queue.ts` does not exist. Drive it with `/10x-tdd admin-queue-filter phase 1`.

## Desired End State

1. `/dashboard?status=pending` (default) lists pending entries — same as today when the param is omitted or unknown.
2. `/dashboard?status=approved` and `/dashboard?status=rejected` list those statuses (cap 50, newest first).
3. From a non-pending view, Approve/Reject still work and the row leaves the current filtered list (admin can flip `rejected` → `approved` without SQL).
4. Non-admins still never see the Moderation section.

### Verification

- Seed one `rejected` Flora/WeddPlan entry; as admin open `/dashboard?status=rejected`; Approve; confirm it appears on the public profile and is gone from the rejected filter.
- `/dashboard?status=hide` and `/dashboard` both show the pending queue (fail-closed default).

## What We're NOT Doing

- Pending-count badge, bulk actions, or extra filters (city/date).
- A list API — keep the existing SSR load on `/dashboard`.
- Rejection reasons, emails, or `/admin` routes.
- Changing the `moderation_status` column DEFAULT.

## Implementation Approach

Extract a pure parser (`parseModerationQueueStatus`) so the fail-closed default is unit-tested first. Dashboard reads `Astro.url.searchParams.get("status")` and uses the parsed value in the existing Supabase query. The island gets the active status only to fix empty-state copy; action buttons stay Approve/Reject.

Phase 1 is test-first. Phase 2 wires the parser into SSR + island (thin glue — `/10x-implement` is fine if TDD gate rejects it).

## Critical Implementation Details

**Fail-closed filter:** anything other than exactly `pending`, `approved`, or `rejected` (including `null`, `""`, `Pending`, `hide`) becomes `pending`. Never infer a status from an error or from the absence of rows.

**Do not add a new GET admin API.** Reuse the dashboard SSR pattern and the existing PATCH.

## Phase 1: Queue status parser (test-first)

### Overview

Pin the filter contract with a failing test, then add the smallest module that makes it pass.

### Changes Required:

#### 1. RED — first automated step

**File**: `src/lib/moderation-queue.test.ts`

**Intent**: Prove the filter defaults to the pending queue and accepts the two reversible statuses. Module `./moderation-queue` must not exist when this test first runs — red reason is "cannot find module" or a failing assertion, not a broken test file.

**Contract**: These two tests, no more in this step. Names describe outcomes. Do not mock.

```ts
import { describe, expect, it } from "vitest";
import { parseModerationQueueStatus } from "./moderation-queue";

describe("parseModerationQueueStatus", () => {
  it("defaults to pending when the query param is missing or unknown", () => {
    expect(parseModerationQueueStatus(null)).toBe("pending");
    expect(parseModerationQueueStatus("")).toBe("pending");
    expect(parseModerationQueueStatus("hide")).toBe("pending");
  });

  it("accepts approved and rejected so an admin can reverse a decision", () => {
    expect(parseModerationQueueStatus("approved")).toBe("approved");
    expect(parseModerationQueueStatus("rejected")).toBe("rejected");
  });
});
```

#### 2. GREEN — implement the parser

**File**: `src/lib/moderation-queue.ts`

**Intent**: Smallest production code that turns the RED tests green.

**Contract**: `parseModerationQueueStatus(raw: string | null): ModerationStatus`. Allow-list `pending | approved | rejected` via `Array.includes` (same style as `ALLOWED_STATUSES` in `src/pages/api/admin/portfolio/[id].ts`). Anything else → `"pending"`. Reuse `ModerationStatus` from `@/types`.

### Success Criteria:

#### Automated Verification:

- `npm test -- --run src/lib/moderation-queue.test.ts` (both tests green after GREEN)
- `npm run lint` passes

#### Manual Verification:

- None for this phase — parser has no UI.

**Implementation Note**: Run via `/10x-tdd admin-queue-filter phase 1`. Do not write `moderation-queue.ts` before the test file exists and has been run red.

---

## Phase 2: Apply filter on the dashboard

### Overview

Use the parser in SSR and keep Approve/Reject usable on non-pending views.

### Changes Required:

#### 1. Dashboard query

**File**: `src/pages/dashboard.astro`

**Intent**: Replace the hardcoded `"pending"` equality with `parseModerationQueueStatus(Astro.url.searchParams.get("status"))`. Keep order `created_at` desc, limit 50, company-name batch fetch, `resolvePortfolioEntriesImages`, `client:only="react"`. Pass the parsed status into `ModerationQueue` as `activeStatus`.

#### 2. Queue island copy + reverse actions

**File**: `src/components/admin/ModerationQueue.tsx`

**Intent**: Empty state must not always say "pending". After PATCH, still remove the row from the current list (leaving `rejected` after Approve is correct). Both buttons stay available so an admin can reverse.

**Contract**: New optional/required prop `activeStatus: ModerationStatus`. Empty copy: `No ${activeStatus} portfolio entries to moderate.` Filter links (pending / approved / rejected) may be simple `<a href="/dashboard?status=…">` rendered in the Astro section above the island — prefer Astro so they stay in the document without extra React state.

### Success Criteria:

#### Automated Verification:

- `npm test -- --run src/lib/moderation-queue.test.ts`
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Admin: `/dashboard` and `/dashboard?status=hide` show pending entries only
- Admin: `/dashboard?status=rejected` shows a seeded rejected entry; Approve removes it from that list and it appears on the public profile
- Non-admin still sees no Moderation section

---

## Testing Strategy

### Unit Tests:

- `parseModerationQueueStatus` — the two Phase 1 tests above (default/unknown → pending; approved/rejected accepted)

### Integration Tests:

- Not required; Phase 2 manual funnel covers SSR + PATCH reverse

### Manual Testing Steps:

1. Sign in as `moderator@eventbook.local`
2. Open `/dashboard?status=rejected` with a seeded rejected Flora entry
3. Approve → confirm public `/d/{profile-id}` shows the photo
4. Open `/dashboard?status=hide` → still the pending queue

## Performance Considerations

- Cap stays 50. No extra query beyond the existing two (entries + company names).

## Migration Notes

- None. Additive UI/query only.

## References

- Archived S-04: `context/archive/2026-08-07-admin-moderation/plan.md` (Desired End State item 3; What We're NOT Doing — filter cut)
- PRD: `context/foundation/prd.md` FR-008
- Types: `src/types.ts` `ModerationStatus`
- Queue load: `src/pages/dashboard.astro`
- PATCH: `src/pages/api/admin/portfolio/[id].ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Queue status parser (test-first)

#### Automated

- [x] 1.1 RED: parseModerationQueueStatus defaults to pending and accepts approved/rejected
- [x] 1.2 GREEN: implement src/lib/moderation-queue.ts so 1.1 passes
- [x] 1.3 `npm test -- --run src/lib/moderation-queue.test.ts`
- [x] 1.4 `npm run lint` passes

### Phase 2: Apply filter on the dashboard

#### Automated

- [ ] 2.1 dashboard.astro filters the queue with parseModerationQueueStatus
- [ ] 2.2 ModerationQueue empty copy uses activeStatus
- [ ] 2.3 `npm run lint` passes
- [ ] 2.4 `npm run build` passes

#### Manual

- [ ] 2.5 Default and unknown ?status= stay on the pending queue
- [ ] 2.6 Rejected filter + Approve reverses hide (public profile visible)
- [ ] 2.7 Non-admin still cannot see Moderation
