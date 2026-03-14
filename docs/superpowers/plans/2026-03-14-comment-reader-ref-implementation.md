# Comment Reader Ref Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split comment write APIs into explicit `guest` and `reader` routes, make logged-in `reader`/`owner` comments write by `readerId` only, gate anonymous comments with `allowGuestComment`, remove active `source` usage, and migrate eligible historical comments after dumping the comments collection.

**Architecture:** Replace mixed write endpoints with explicit `/comments/guest/*` and `/comments/reader/*` routes. Keep anonymous snapshot fields only for guest comments and move logged-in comments entirely onto `readerId`. Rework response assembly so `readerId` comments render identity dynamically from reader data. Add a migration that uniquely links legacy `mail + source` comments to readers and unsets redundant fields after a pre-migration dump.

**Tech Stack:** NestJS, TypeGoose/Mongoose, Zod (`nestjs-zod`), Better Auth collections (`readers`, `accounts`), Vitest, pnpm

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `apps/core/src/modules/comment/comment.schema.ts` | Split logged-in vs anonymous write DTOs; remove `source` from active DTOs |
| Modify | `apps/core/src/modules/comment/comment.controller.ts` | Replace mixed write routes with explicit `guest` and `reader` routes; enforce `allowGuestComment` |
| Modify | `apps/core/src/modules/comment/comment.service.ts` | Stop snapshot injection for logged-in writes; assemble dynamic identity on reads |
| Modify | `apps/core/src/modules/comment/comment.model.ts` | Remove active `source` field definition from comment model |
| Modify | `apps/core/src/modules/comment/comment.interceptor.ts` | Keep anonymous mail filtering compatible with dynamic reader-backed comments |
| Modify | `apps/core/src/modules/configs/configs.schema.ts` | Add `allowGuestComment` config field |
| Modify | `apps/core/src/modules/configs/configs.default.ts` | Default `allowGuestComment` to `true` |
| Modify | `packages/api-client/models/setting.ts` | Expose `allowGuestComment` in client config model |
| Modify | `packages/api-client/models/comment.ts` | Remove `source`; optionally add `reader`-aware compatibility typing if needed |
| Modify | `packages/api-client/dtos/comment.ts` | Replace legacy DTO with anonymous/logged-in write DTOs or a safe union representation |
| Create | `apps/core/src/migration/version/v10.4.2.ts` | Link eligible legacy comments to `readerId` and unset redundant fields |
| Modify | `apps/core/src/migration/history.ts` | Register the new migration |
| Create | `apps/core/test/src/migration/v10.4.2.spec.ts` | Test unique-match/zero-match/multi-match migration behavior |
| Modify | `packages/api-client/__tests__/helpers/adaptor-test.ts` | Keep client comment request tests aligned with DTO changes if needed |
| Create or Modify | `apps/core/test/src/modules/comment/comment.controller.spec.ts` | Test comment create/reply branching and config gating |
| Create | `docs/migrations/v10-comment-reader-ref.md` or update existing migration docs | Document dump command and migration behavior |

---

## Chunk 1: Safety Baseline

### Task 1: Define and document the comment dump procedure before migration

**Files:**
- Create or Modify: `docs/migrations/v10-comment-reader-ref.md`

- [ ] **Step 1: Write the dump procedure into migration docs**

Add a section that captures:
- dump scope: full comments collection
- output path convention
- restore intent
- post-migration comparison usage

Include a concrete command using the project's actual Mongo database naming convention, for example:

```bash
mkdir -p ./artifacts/comment-dumps
mongodump \
  --uri "$MONGO_URI" \
  --collection comments \
  --archive="./artifacts/comment-dumps/comments-$(date +%Y%m%d-%H%M%S).archive.gz" \
  --gzip
```

- [ ] **Step 2: Verify the command is documented clearly**

Run: `sed -n '1,220p' docs/migrations/v10-comment-reader-ref.md`

Expected: The document contains the dump command, output location, and a short note that the dump is required before migration.

- [ ] **Step 3: Record the operator checklist in the same doc**

Add a short ordered list:
1. dump comments
2. run migration in staging
3. compare migrated comments against dump samples
4. run production migration

---

## Chunk 2: Comment Write Contract

### Task 2: Split comment write DTOs into logged-in and anonymous variants

**Files:**
- Modify: `apps/core/src/modules/comment/comment.schema.ts`
- Modify: `packages/api-client/dtos/comment.ts`

- [ ] **Step 1: Write the failing DTO tests or controller expectations first**

Create or update comment controller tests to express:
- `POST /comments/reader/:id` accepts `{ text }`
- `POST /comments/guest/:id` requires `author`, `mail`, and `text`
- `source` is no longer part of accepted input

Suggested test names:

```ts
it('accepts text-only payload for logged-in reader comments')
it('rejects anonymous comments when author or mail is missing')
it('does not persist source from comment input')
```

- [ ] **Step 2: Run the targeted test to verify RED**

Run: `pnpm -C apps/core test -- --runInBand apps/core/test/src/modules/comment/comment.controller.spec.ts`

Expected: Failures showing the current API still expects legacy anonymous fields for logged-in comments.

- [ ] **Step 3: Refactor `comment.schema.ts`**

Implement:
- `AnonymousCommentSchema`
- `AnonymousReplyCommentSchema`
- `ReaderCommentSchema` with `text`, optional `isWhispers`, optional `anchor`
- `ReaderReplyCommentSchema` with `text`, optional `isWhispers`
- keep `TextOnlySchema` only if still used by owner-only paths, otherwise collapse owner into the reader flow
- remove `source` from all active schemas

- [ ] **Step 4: Update client DTO types**

Reflect the same split in `packages/api-client/dtos/comment.ts`:
- anonymous DTO with `author/mail/url/avatar`
- logged-in DTO with `text` only plus content-related optional fields

- [ ] **Step 5: Run targeted tests to verify GREEN**

Run: `pnpm -C apps/core test -- --runInBand apps/core/test/src/modules/comment/comment.controller.spec.ts`

Expected: The new tests pass for schema-level request validation behavior.

### Task 3: Replace mixed write routes with explicit guest/reader routes

**Files:**
- Modify: `apps/core/src/modules/comment/comment.controller.ts`
- Modify: `apps/core/src/modules/configs/configs.schema.ts`
- Modify: `apps/core/src/modules/configs/configs.default.ts`
- Modify: `packages/api-client/models/setting.ts`

- [ ] **Step 1: Extend comment settings with a failing test**

Add expectations that:
- `commentOptions.allowGuestComment` defaults to `true`
- `/comments/guest/:id` and `/comments/guest/reply/:id` are rejected when it is `false`
- `/comments/reader/:id` and `/comments/reader/reply/:id` do not require anonymous fields

- [ ] **Step 2: Run the test to verify RED**

Run: `pnpm -C apps/core test -- --runInBand apps/core/test/src/modules/comment/comment.controller.spec.ts`

Expected: Failures because the config field does not exist and anonymous writes are still permitted.

- [ ] **Step 3: Add the config field**

Implement:
- `allowGuestComment` in `CommentOptionsSchema`
- default `allowGuestComment: true` in `generateDefaultConfig`
- client-side config type update in `packages/api-client/models/setting.ts`

- [ ] **Step 4: Update controller branching**

In `comment.controller.ts`:
- add `POST /comments/guest/:id`
- add `POST /comments/guest/reply/:id`
- add `POST /comments/reader/:id`
- add `POST /comments/reader/reply/:id`
- remove the old mixed write routes
- remove owner-only write routes
- ensure guest routes enforce `allowGuestComment`
- ensure reader routes require the authenticated reader/owner context and only validate the reader DTO

- [ ] **Step 5: Collapse owner write paths onto the same content-only contract**

Make sure owner comment/reply uses the same `reader` routes and relies on `readerId` identity, not hard-coded snapshot injection.

- [ ] **Step 6: Run targeted tests to verify GREEN**

Run: `pnpm -C apps/core test -- --runInBand apps/core/test/src/modules/comment/comment.controller.spec.ts`

Expected: `reader` routes accept text-only writes for `reader` and `owner`; `guest` routes honor `allowGuestComment`.

---

## Chunk 3: Dynamic Identity Rendering

### Task 4: Stop persisting logged-in snapshot identity

**Files:**
- Modify: `apps/core/src/modules/comment/comment.service.ts`
- Modify: `apps/core/src/modules/comment/comment.model.ts`

- [ ] **Step 1: Write the failing service tests**

Add or update tests to prove:
- logged-in create/reply stores `readerId`
- logged-in create/reply does not rely on `author/mail/avatar/url/source` payload values
- anonymous create/reply still stores snapshot identity

- [ ] **Step 2: Run the targeted test to verify RED**

Run: `pnpm -C apps/core test -- --runInBand apps/core/test/src/modules/comment/comment.controller.spec.ts`

Expected: Failures because `assignReaderToComment` still copies reader identity into the document payload.

- [ ] **Step 3: Refactor persistence logic**

In `comment.service.ts`:
- change `assignReaderToComment` to resolve and return reader info without mutating comment identity fields
- preserve `readerId` assignment in create/reply
- remove any `source` write path

In `comment.model.ts`:
- remove the active `source` property definition
- keep anonymous snapshot fields intact

- [ ] **Step 4: Run the targeted tests to verify GREEN**

Run: `pnpm -C apps/core test -- --runInBand apps/core/test/src/modules/comment/comment.controller.spec.ts`

Expected: Tests confirm logged-in comments persist by `readerId` without legacy `source`.

### Task 5: Rebuild comment response identity from `readerId`

**Files:**
- Modify: `apps/core/src/modules/comment/comment.service.ts`
- Modify: `apps/core/src/modules/comment/comment.controller.ts`
- Modify: `apps/core/src/modules/comment/comment.interceptor.ts`
- Modify: `packages/api-client/models/comment.ts`

- [ ] **Step 1: Write the failing read-path tests**

Add assertions that:
- comments with `readerId` expose reader-backed `author/avatar`
- anonymous comments still expose stored snapshot `author/avatar`
- mail filtering still hides anonymous `mail`

- [ ] **Step 2: Run the targeted test to verify RED**

Run: `pnpm -C apps/core test -- --runInBand apps/core/test/src/modules/comment/comment.controller.spec.ts`

Expected: Failures because read paths currently depend on stored comment fields or only attach `reader` inconsistently.

- [ ] **Step 3: Implement dynamic identity assembly**

Update the comment read helpers to:
- batch-load reader docs for `readerId`s
- derive display-facing fields from readers for linked comments
- preserve anonymous snapshot fields for non-reader comments
- keep the `reader` object in response payloads where already supported

Adjust client model typing if a `reader` field or optional identity fields need to be reflected explicitly.

- [ ] **Step 4: Run the targeted tests to verify GREEN**

Run: `pnpm -C apps/core test -- --runInBand apps/core/test/src/modules/comment/comment.controller.spec.ts`

Expected: Read responses stay backward compatible while reflecting dynamic reader identity.

---

## Chunk 4: Historical Migration

### Task 6: Add migration tests for legacy comment reader linking

**Files:**
- Create: `apps/core/test/src/migration/v10.4.2.spec.ts`

- [ ] **Step 1: Write the failing migration tests**

Cover at least:
- unique `mail + source` match sets `readerId` and unsets `author/mail/avatar/url/source`
- zero match skips the comment
- multi match skips the comment
- existing `readerId` skips the comment
- string/ObjectId mixed `userId` shapes still match safely if the implementation supports them

Use mocked collections and assert concrete `updateOne`/`updateMany` calls like existing migration tests.

- [ ] **Step 2: Run the migration test to verify RED**

Run: `pnpm -C apps/core test -- --runInBand apps/core/test/src/migration/v10.4.2.spec.ts`

Expected: Fail because the migration file does not exist yet.

### Task 7: Implement the migration and register it

**Files:**
- Create: `apps/core/src/migration/version/v10.4.2.ts`
- Modify: `apps/core/src/migration/history.ts`

- [ ] **Step 1: Write the migration implementation**

Implement `defineMigration('v10.4.2-comment-reader-ref', async (db) => { ... })` that:
- queries only comments missing `readerId` and containing `mail` and `source`
- resolves candidate readers by `email`
- joins `accounts` and matches `provider` or `providerId`
- rewrites only unique matches
- unsets `author`, `mail`, `avatar`, `url`, and `source` only on unique matches
- skips unmatched or multi-matched comments

- [ ] **Step 2: Register migration in history**

Append `v10_4_2` after `v10_4_1` in `apps/core/src/migration/history.ts`.

- [ ] **Step 3: Run migration tests to verify GREEN**

Run: `pnpm -C apps/core test -- --runInBand apps/core/test/src/migration/v10.4.2.spec.ts`

Expected: All migration scenarios pass.

- [ ] **Step 4: Run the migration test suite around recent versions**

Run: `pnpm -C apps/core test -- --runInBand apps/core/test/src/migration/v10.1.0.spec.ts apps/core/test/src/migration/v10.4.1.spec.ts apps/core/test/src/migration/v10.4.2.spec.ts`

Expected: Existing migration tests remain green.

---

## Chunk 5: Integration Verification

### Task 8: Update ancillary types and documentation

**Files:**
- Modify: `packages/api-client/models/comment.ts`
- Modify: `packages/api-client/models/setting.ts`
- Modify: `packages/api-client/dtos/comment.ts`
- Modify: `docs/migrations/v10.md` or the new focused migration doc

- [ ] **Step 1: Align client-facing types**

Remove `source` from comment/client DTOs and settings models. Add any missing `allowGuestComment` field and dynamic reader-friendly response typing.

- [ ] **Step 2: Re-read the migration doc for operator clarity**

Run: `sed -n '1,260p' docs/migrations/v10-comment-reader-ref.md`

Expected: The doc clearly explains dump-first migration, matching rules, and skip behavior for ambiguous comments.

### Task 9: Run final verification commands

**Files:**
- No code changes expected

- [ ] **Step 1: Run focused comment tests**

Run: `pnpm -C apps/core test -- --runInBand apps/core/test/src/modules/comment/comment.controller.spec.ts`

Expected: All comment behavior tests pass.

- [ ] **Step 2: Run focused migration tests**

Run: `pnpm -C apps/core test -- --runInBand apps/core/test/src/migration/v10.1.0.spec.ts apps/core/test/src/migration/v10.4.1.spec.ts apps/core/test/src/migration/v10.4.2.spec.ts`

Expected: All migration tests pass.

- [ ] **Step 3: Run type-aware verification for touched packages**

Run: `pnpm -C apps/core exec tsc --noEmit`

Expected: No TypeScript errors in touched modules.

- [ ] **Step 4: Commit implementation in logical slices**

Suggested commit sequence:

```bash
git add apps/core/src/modules/comment apps/core/src/modules/configs packages/api-client
git commit -m "feat: use reader refs for logged-in comments"

git add apps/core/src/migration apps/core/test/src/migration docs/migrations
git commit -m "feat: migrate legacy comments to reader refs"
```
