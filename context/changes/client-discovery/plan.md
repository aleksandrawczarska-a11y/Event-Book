# Client Discovery Implementation Plan

## Overview

Implement roadmap **S-02** (`client-discovery`): anonymous clients can search and filter published decorators and view a public profile with portfolio gallery (FR-004, FR-005). Contact form deferred to S-03.

## Locked decisions

- Routes: `/search`, `/d/[id]`; homepage CTA → `/search`
- City: free-text `ilike`; event/style multi-select with OR (`overlaps`)
- Pagination: 24/page; SSR + GET; sort `updated_at` desc
- Unpublished → 404; gallery approved only, max 24; Contact CTA placeholder

## Progress

### Phase 1: Search

#### Automated

- [x] 1.1 discovery query helper + unit tests
- [x] 1.2 `/search` SSR page with filters and pagination
- [x] 1.3 Homepage CTA + topbar Search link

### Phase 2: Public profile

#### Automated

- [x] 2.1 `/d/[id]` published profile + contact fields
- [x] 2.2 Approved portfolio gallery (max 24) with signed URLs

### Phase 3: Verify

#### Automated

- [x] 3.1 `npm test` (discovery-query) passes
- [x] 3.2 `npm run lint` passes
- [x] 3.3 `npm run build` passes

#### Manual

- [x] 3.4 Anon REST: published profiles visible; drafts hidden
