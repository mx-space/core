# Shiroi Note Slug Route Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the note slug-capable API client and refactor Shiroi so note links prefer canonical slug routes while `/notes/:nid` redirects for compatibility.

**Architecture:** Keep `mx-core` as the source of truth for note slug APIs, publish a new `@mx-space/api-client` version, then update Shiroi to consume it. In Shiroi, centralize note URL generation in one helper, add a canonical slug page, and make the legacy nid page redirect when slug data exists.

**Tech Stack:** TypeScript, Vitest, Next.js App Router, pnpm, nbump

---

## Chunk 1: API Client Release

### Task 1: Verify client API surface before bump

**Files:**
- Modify: `packages/api-client/package.json`
- Test: `packages/api-client/__tests__/controllers/note.test.ts`

- [ ] **Step 1: Run the existing note client test subset**

Run: `pnpm -C packages/api-client exec vitest run __tests__/controllers/note.test.ts`
Expected: PASS and confirm `getNoteBySlugDate(...)` is already covered.

- [ ] **Step 2: Inspect current package version**

Run: `sed -n '1,80p' packages/api-client/package.json`
Expected: current published version is identified before bumping.

- [ ] **Step 3: Bump and publish with nbump**

Run: `pnpm dlx nbump`
Expected: package version is incremented, package is built, published, and a release commit is created.

- [ ] **Step 4: Re-read bumped version**

Run: `sed -n '1,40p' packages/api-client/package.json`
Expected: version changed from the pre-bump value.

### Task 2: Record the released SDK version for Shiroi

**Files:**
- Modify: `docs/superpowers/plans/2026-03-14-shiroi-note-slug-route-implementation.md`

- [ ] **Step 1: Note the released version for dependency upgrade**

Expected: exact `@mx-space/api-client` version is available for the Shiroi upgrade step.

## Chunk 2: Shiroi Note Route Refactor

### Task 3: Write failing tests for canonical note path building

**Files:**
- Create: `../Shiroi/apps/web/src/lib/note-route.test.ts`
- Create: `../Shiroi/apps/web/src/lib/note-route.ts`

- [ ] **Step 1: Write helper tests first**

Test cases:
- slug + created -> `/notes/:year/:month/:day/:slug`
- missing slug -> `/notes/:nid`
- password preserved as query string

- [ ] **Step 2: Run helper test to verify it fails**

Run: `pnpm -C ../Shiroi exec vitest run apps/web/src/lib/note-route.test.ts`
Expected: FAIL because helper does not exist or behavior is incomplete.

- [ ] **Step 3: Implement minimal note route helper**

Expected: helper passes the three route-selection cases with no extra logic.

- [ ] **Step 4: Re-run helper test**

Run: `pnpm -C ../Shiroi exec vitest run apps/web/src/lib/note-route.test.ts`
Expected: PASS.

### Task 4: Add slug-route query path and page entry

**Files:**
- Modify: `../Shiroi/apps/web/src/queries/definition/note.ts`
- Create: `../Shiroi/apps/web/src/app/[locale]/notes/[year]/[month]/[day]/[slug]/api.tsx`
- Create: `../Shiroi/apps/web/src/app/[locale]/notes/[year]/[month]/[day]/[slug]/page.tsx`
- Create: `../Shiroi/apps/web/src/app/[locale]/notes/[year]/[month]/[day]/[slug]/loading.tsx`
- Refactor if needed: shared note detail page module reused by both route trees

- [ ] **Step 1: Add failing query/page test or type-level usage path**

Expected: code references `apiClient.note.getNoteBySlugDate(...)` and fails until the new path is wired.

- [ ] **Step 2: Run targeted validation**

Run: `pnpm -C ../Shiroi exec tsc --noEmit`
Expected: FAIL at the new slug route wiring before implementation is complete.

- [ ] **Step 3: Implement slug page using the new SDK method**

Expected: slug route fetches by date + slug and reuses existing note page rendering.

- [ ] **Step 4: Re-run validation**

Run: `pnpm -C ../Shiroi exec tsc --noEmit`
Expected: no type errors caused by the new slug page.

### Task 5: Redirect legacy nid route to canonical slug route

**Files:**
- Modify: `../Shiroi/apps/web/src/app/[locale]/notes/[id]/api.tsx`
- Modify: `../Shiroi/apps/web/src/app/[locale]/notes/[id]/page.tsx`
- Modify: `../Shiroi/apps/web/src/app/[locale]/notes/page.tsx`
- Modify: `../Shiroi/apps/web/src/app/[locale]/notes/redirect.tsx`

- [ ] **Step 1: Add a failing redirect-focused test or assertion point**

Expected: legacy page still renders old route before redirect logic is added.

- [ ] **Step 2: Implement redirect to canonical helper output when slug exists**

Expected: `/notes/:nid` and latest note redirect both prefer slug paths when possible.

- [ ] **Step 3: Re-run targeted typecheck/test**

Run: `pnpm -C ../Shiroi exec tsc --noEmit`
Expected: redirect changes compile cleanly.

### Task 6: Migrate high-leverage note link call sites

**Files:**
- Modify: `../Shiroi/apps/web/src/lib/url-builder.ts`
- Modify: `../Shiroi/apps/web/src/lib/route-builder.ts`
- Modify: `../Shiroi/apps/web/src/socket/handlers/note.ts`
- Modify: note link call sites under:
  - `../Shiroi/apps/web/src/app/[locale]/(home)/components/`
  - `../Shiroi/apps/web/src/components/modules/note/`
  - `../Shiroi/apps/web/src/components/layout/header/internal/DropdownContents.tsx`
  - `../Shiroi/apps/web/src/components/modules/shared/SearchFAB.tsx`
  - `../Shiroi/apps/web/src/app/[locale]/timeline/page.tsx`

- [ ] **Step 1: Replace direct note URL construction with the helper**

Expected: note links prefer slug route whenever note data includes `slug` and `created`.

- [ ] **Step 2: Re-run search to confirm no high-leverage old builders remain**

Run: `cd ../Shiroi && rg -n \"routeBuilder\\(Routes\\.Note|/notes/\\$\\{|`/notes/\\$\\{\" apps/web/src`
Expected: remaining results are only intentional compatibility paths.

## Chunk 3: Dependency Upgrade and Verification

### Task 7: Upgrade Shiroi to the released API client version

**Files:**
- Modify: `../Shiroi/apps/web/package.json`
- Modify: `../Shiroi/pnpm-lock.yaml`

- [ ] **Step 1: Install the released `@mx-space/api-client` version**

Run: `pnpm -C ../Shiroi add @mx-space/api-client@<released-version> --filter web`
Expected: package manifest and lockfile update to the new version.

- [ ] **Step 2: Confirm installed version**

Run: `sed -n '1,120p' ../Shiroi/apps/web/package.json`
Expected: dependency version matches the released version.

### Task 8: Run final verification

**Files:**
- Test: `packages/api-client/__tests__/controllers/note.test.ts`
- Test: `../Shiroi/apps/web/src/lib/note-route.test.ts`

- [ ] **Step 1: Verify api-client tests**

Run: `pnpm -C packages/api-client exec vitest run __tests__/controllers/note.test.ts`
Expected: PASS.

- [ ] **Step 2: Verify Shiroi helper tests**

Run: `pnpm -C ../Shiroi exec vitest run apps/web/src/lib/note-route.test.ts`
Expected: PASS.

- [ ] **Step 3: Verify Shiroi typecheck**

Run: `pnpm -C ../Shiroi exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Verify targeted formatting/lint if needed**

Run: `pnpm -C ../Shiroi exec biome check apps/web/src/lib/note-route.ts apps/web/src/lib/note-route.test.ts`
Expected: PASS.
