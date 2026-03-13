# Note SEO Slug Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional note slugs, a public `/notes/:year/:month/:day/:slug` API, slug history tracking, sitemap preference for the SEO path, API client support, and admin note slug editing.

**Architecture:** Extend the existing note module in place. Keep the current `nid` route for compatibility, add a parallel date+slug route for public SEO usage, centralize slug normalization/history handling in `NoteService`, and thread the new field through API client and admin models. Follow TDD for backend behavior and route coverage before production code changes.

**Tech Stack:** NestJS, Typegoose/Mongoose, Vitest, `@mx-space/api-client`, Vue 3 TSX admin, Naive UI, `slugify`

---

## Chunk 1: Backend Model and Service

### Task 1: Add backend slug contract

**Files:**
- Modify: `apps/core/src/modules/note/note.model.ts`
- Modify: `apps/core/src/modules/note/note.schema.ts`
- Modify: `apps/core/src/constants/error-code.constant.ts` only if note slug needs an existing/better mapped error path

- [ ] Step 1: Add failing tests or assertions for note slug input acceptance in existing note tests where payload shapes are checked.
- [ ] Step 2: Run the targeted tests to confirm current note slug support is absent.
- [ ] Step 3: Add `slug?: string` to note model with sparse unique index semantics and to note DTO/partial DTO validation.
- [ ] Step 4: Re-run the targeted tests and adjust snapshots/types if needed.

### Task 2: Add note slug service behavior

**Files:**
- Modify: `apps/core/src/modules/note/note.service.ts`
- Modify: `apps/core/src/modules/note/note.module.ts`
- Modify: `apps/core/test/src/modules/note/note.service.spec.ts`
- Read for reference: `apps/core/src/modules/post/post.service.ts`
- Read for reference: `apps/core/src/modules/slug-tracker/slug-tracker.service.ts`
- Read for reference: `apps/core/src/modules/ai/ai-writer/ai-writer.service.ts`

- [ ] Step 1: Write failing `NoteService` tests for explicit slug normalization, AI-assisted slug fill on create, skip-when-AI-unavailable, slug uniqueness rejection, tracker creation on slug change, and tracker cleanup on delete.
- [ ] Step 2: Run `pnpm -C apps/core exec vitest run apps/core/test/src/modules/note/note.service.spec.ts` and verify the new tests fail for the expected reasons.
- [ ] Step 3: Inject `SlugTrackerService` and `AiWriterService` into note service/module, add helper methods for slug normalization/date-path building/availability checks, and implement the minimum create-update-delete behavior to satisfy the tests.
- [ ] Step 4: Re-run the same service test file until it passes.

## Chunk 2: Backend Public Route and Sitemap

### Task 3: Add date+slug note route

**Files:**
- Modify: `apps/core/src/modules/note/note.controller.ts`
- Modify: `apps/core/test/src/modules/note/note.controller.e2e-spec.ts`
- Modify: `apps/core/test/src/modules/note/note.e2e-mock.db.ts` if route coverage needs stable seeded slug/date data

- [ ] Step 1: Write failing e2e tests for `GET /notes/:year/:month/:day/:slug` success, hidden/public restrictions, tracker fallback, and date mismatch 404.
- [ ] Step 2: Run `pnpm -C apps/core exec vitest run apps/core/test/src/modules/note/note.controller.e2e-spec.ts` and verify the route tests fail because the route/behavior does not exist yet.
- [ ] Step 3: Implement the controller route and minimal note service lookup helper that resolves current slug first and historical tracked path second.
- [ ] Step 4: Re-run the e2e file until it passes.

### Task 4: Prefer slug URLs in sitemap

**Files:**
- Modify: `apps/core/src/modules/aggregate/aggregate.service.ts`
- Test in: `apps/core/test/src/modules/aggregate/*` if aggregate sitemap tests exist; otherwise extend an existing note/aggregate coverage file conservatively

- [ ] Step 1: Add a failing test or assertion for sitemap note URLs preferring `/notes/:year/:month/:day/:slug` when slug exists and falling back to `/notes/:nid` otherwise.
- [ ] Step 2: Run the targeted aggregate test command and confirm the failure.
- [ ] Step 3: Implement sitemap URL selection using a shared note-path builder instead of inline `nid` URL generation.
- [ ] Step 4: Re-run the targeted test file until it passes.

## Chunk 3: API Client SDK

### Task 5: Expose slug path in SDK

**Files:**
- Modify: `packages/api-client/models/note.ts`
- Modify: `packages/api-client/controllers/note.ts`
- Modify: `packages/api-client/__tests__/controllers/note.test.ts`

- [ ] Step 1: Write failing SDK tests for a new note method that requests `/notes/:year/:month/:day/:slug`.
- [ ] Step 2: Run `pnpm exec vitest run packages/api-client/__tests__/controllers/note.test.ts` and verify the new test fails.
- [ ] Step 3: Add `slug?: string` to the note model and implement the new controller method with any needed options passthrough.
- [ ] Step 4: Re-run the SDK note controller tests until they pass.

## Chunk 4: Admin Note Management

### Task 6: Thread slug through note admin API/model

**Files:**
- Modify: `../admin-vue3/src/models/note.ts`
- Modify: `../admin-vue3/src/api/notes.ts`

- [ ] Step 1: Add the note slug type to admin model and payload types.
- [ ] Step 2: Verify TypeScript references in note list/write pages now surface the missing implementation spots.

### Task 7: Add slug UI in note list and write drawer

**Files:**
- Modify: `../admin-vue3/src/views/manage-notes/list.tsx`
- Modify: `../admin-vue3/src/views/manage-notes/write.tsx`
- Read for reference: `../admin-vue3/src/views/manage-posts/write.tsx`
- Read for reference: `../admin-vue3/src/components/editor/write-editor/slug-input.tsx`

- [ ] Step 1: Add a failing type/build check expectation by wiring slug into note list select/render and note write reactive state/payloads.
- [ ] Step 2: Implement slug display in list mobile and desktop views, including empty fallback output.
- [ ] Step 3: Implement slug editing in the note drawer and note subtitle preview, reusing `SlugInput` behavior where practical.
- [ ] Step 4: Re-run the admin type/build check or the smallest available verification command.

## Chunk 5: Full Verification

### Task 8: Run focused verification

**Files:**
- No code changes expected unless verification reveals regressions

- [ ] Step 1: Run the focused backend, SDK, and any admin verification commands touched above.
- [ ] Step 2: If all focused tests pass, run one broader core note-related command if time permits.
- [ ] Step 3: Inspect `git diff --stat` and `git status --short` to confirm only intended files changed.
- [ ] Step 4: Summarize any residual risk, especially around route ordering and AI-runtime availability in tests.
