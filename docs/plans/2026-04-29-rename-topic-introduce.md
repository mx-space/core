# Rename `topic.introduce` → `topic.subtitle`

> **Status:** Deferred. Plan only — do not execute until the author signs off.
> **For Claude:** When the user asks to execute this, use `superpowers:executing-plans`.

**Goal:** Resolve the long-standing naming ambiguity in the `Topic` schema, where `introduce` is in fact a one-line subtitle and `description` is the longer prologue. The current naming reverses the English convention (where "description" is the short caption and "introduction" is the long prose), which has caused content miscategorisation in production.

**Architecture:** Single-direction rename of one field on `TopicModel` plus all consumers. `description` keeps its current name; only the storage format and meaning are clarified through documentation. The translation `keyPath` literal `topic.introduce` is renamed in lockstep with the field. A Mongo migration renames the stored field and rewrites `translation_entries.keyPath` for affected rows. The public API contract changes — bump `@mx-space/api-client` major.

**Tech Stack:** TypeScript, NestJS, Mongoose/Typegoose, MongoDB, Zod, monorepo migration helper at `apps/core/src/migration/version/`.

**Out of Scope:**

- `OwnerProfileModel.introduce` (a separate biographical field on the blog owner — same word, unrelated entity). Decide independently.
- Any `note.introduce` field (none exists — `note.controller.ts` only references the embedded `topic.introduce` translation path).
- Renaming `description` → `prologue`. Investigated and rejected because `description` is the more conventional web-schema name; only the *short* field is misnamed.

---

## Decision Record

| Option | Action | Verdict |
|---|---|---|
| A — Rename `introduce` → `subtitle`, keep `description` | Minimum semantic fix; matches Open Graph / common web convention | **Adopted** |
| B — Rename to `subtitle` + `prologue` | More symmetric, but `prologue` is rare in web schemas; adds churn | Rejected |
| C — Document only, no code change | Zero risk, but readers continue to be confused; field name keeps lying | Rejected |

---

## Touch Site Inventory

All paths are relative to repo root.

### Backend — `apps/core/src/`

| File | Line(s) | Change |
|---|---|---|
| `modules/topic/topic.model.ts` | 16 | `introduce: string` → `subtitle: string` |
| `modules/topic/topic.controller.ts` | 14–18, 28–32 | Both `topicTranslateFields` and `topicTranslateListFields` entries: `path: 'introduce'` → `'subtitle'`, `keyPath: 'topic.introduce'` → `'topic.subtitle'` |
| `modules/note/note.controller.ts` | 205–206, 404, 409–410, 562, 567–568, 625, 630–631 | All 11 references switch `topic.introduce` → `topic.subtitle` (these are translation path strings, not direct field reads) |
| `modules/ai/ai-translation/translation-entry.model.ts` | 9 | Union member `'topic.introduce'` → `'topic.subtitle'` |
| `modules/ai/ai-translation/translation-entry.schema.ts` | 7 | Same in `validKeyPaths` |
| `modules/ai/ai-translation/ai-translation-event-handler.service.ts` | 229–236, 258–264, 277–284, 298 | Replace `'topic.introduce'` and `doc.introduce` with `'topic.subtitle'` and `doc.subtitle` in `handleTopicCreate` / `handleTopicUpdate` (×2 blocks) / `handleTopicDelete` |
| `modules/ai/ai-translation/translation-entry.service.ts` | 224, 234–241 | `.select('name introduce description')` → `.select('name subtitle description')`; rename `topic.introduce` to `topic.subtitle` and `topic.introduce` source field accordingly |

### SDK — `packages/api-client/`

| File | Change |
|---|---|
| `models/topic.ts:5` | `introduce: string` → `subtitle: string` on `TopicModel` |
| `dist/index.d.{mts,cts}:510` | Regenerated from build; no manual edit |

> The `models/user.ts` `introduce` field is the owner profile bio — leave alone.

### Migration — `apps/core/src/migration/version/`

Create new file `vX.Y.Z-rename-topic-introduce-to-subtitle.ts` (pick the next version that aligns with the release that ships this rename — current is v11.4.5).

**Operations (atomic per collection where possible):**

1. `topics` — rename field for every doc:
   ```ts
   await db.collection(TOPIC_COLLECTION_NAME).updateMany(
     { introduce: { $exists: true } },
     { $rename: { introduce: 'subtitle' } },
   )
   ```
2. `translation_entries` — rewrite keyPath:
   ```ts
   await db.collection(TRANSLATION_ENTRY_COLLECTION_NAME).updateMany(
     { keyPath: 'topic.introduce' },
     { $set: { keyPath: 'topic.subtitle' } },
   )
   ```
3. Verify counts before / after; abort migration on mismatch.

> No new index needed — the unique index `{ keyPath, lang, keyType, lookupKey }` automatically covers the new key value.

### Constants

If `topic.introduce` appears as a string literal in any place not listed above (search the repo before opening the PR — `rg "topic\.introduce" --type ts`), update it. As of 2026-04-29 the inventory above is complete.

---

## Backward Compatibility

The DB rename is a **hard rename** (no dual-write window). The migration runs once on deploy, after which:

- API responses no longer include `introduce` on topic objects — clients reading `topic.introduce` will see `undefined`.
- The api-client SDK ships in the same release with the renamed field. Older SDK versions will be silently broken on this field.

**Bump `@mx-space/api-client` to a new major version** so consumers see the breaking change explicitly.

If a softer migration is wanted (rare for a single-tenant CMS), an alternative is:

1. Release N: add `subtitle` as a duplicate field, keep `introduce` populated via a setter; mark `introduce` `@deprecated`.
2. Release N+1: drop `introduce` and the duplication.

This is more work and should only be picked if there are external SDK consumers that need a deprecation window.

---

## Tasks

### Task 1: Backend rename

**Files:** all `apps/core/src` files in the inventory above.

1. Rename the schema field on `TopicModel`.
2. Update controller decorators (topic + note) to reference the new path.
3. Update the translation system enum, schema, service, and event handler in lockstep.
4. Run `pnpm -F core typecheck` and `pnpm -F core lint`.
5. Adjust any test file that asserts on `topic.introduce`.

### Task 2: SDK rename

**Files:** `packages/api-client/models/topic.ts`.

1. Rename the property.
2. Rebuild — `dist/*.d.{mts,cts}` regenerate.
3. Bump `package.json` version (major).
4. Update `packages/api-client/readme.md` migration notes if a migration section exists.

### Task 3: Mongo migration

**Files:** new `apps/core/src/migration/version/vX.Y.Z-rename-topic-introduce-to-subtitle.ts`.

1. Use `defineMigration` per existing convention (see `v9.7.4.ts` for shape).
2. Run both rename operations.
3. Read back counts and log them. Throw on count mismatch so the deployment fails fast rather than half-migrating.

### Task 4: Verification on staging / preview deployment

1. Deploy to a non-prod environment with copy of prod data.
2. Confirm migration log shows expected counts (topics renamed = total topics with `introduce` previously; translation_entries rewrites = old `topic.introduce` count).
3. Hit `GET /topic/all`, `GET /topic/:id`, and any note endpoint that embeds topic — confirm `subtitle` appears, `introduce` is absent.
4. Hit the same endpoints with `?lang=en` and `?lang=ja` — confirm subtitle translations are returned correctly.
5. Edit a topic via admin UI; confirm save round-trips and re-translation queue picks up the change.

### Task 5: Release & comms

1. Tag release with breaking-change note in the changelog.
2. Bump api-client major.
3. Mention the rename in the release notes for downstream sites.

---

## Verification Checklist

- [ ] `rg "topic\.introduce" --type ts` returns zero hits in `apps/` and `packages/api-client/`.
- [ ] `rg "\\bintroduce\\b" apps/core/src/modules/topic/` returns zero hits.
- [ ] Migration is idempotent (running twice does not error or double-rename).
- [ ] `translation_entries` count for `topic.subtitle` after migration equals `topic.introduce` count before.
- [ ] All 7 production topics (or whatever the current count is) have `subtitle` populated and `introduce` absent.

---

## Rollback

If the migration runs but the deployment must be reverted:

1. Reverse Mongo migration:
   ```ts
   await db.collection(TOPIC_COLLECTION_NAME).updateMany(
     { subtitle: { $exists: true } },
     { $rename: { subtitle: 'introduce' } },
   )
   await db.collection(TRANSLATION_ENTRY_COLLECTION_NAME).updateMany(
     { keyPath: 'topic.subtitle' },
     { $set: { keyPath: 'topic.introduce' } },
   )
   ```
2. Re-deploy the previous app version.

The rollback is symmetric and safe because no new data shape was introduced — only a name flipped.

---

## Open Questions

1. **Should `OwnerProfileModel.introduce` be renamed to `bio` in the same release?** It has the same misleading-name issue and would be cheap to bundle. Currently scoped out — confirm before opening the PR.
2. **Admin UI label**: when this lands, the admin form labels for topic should change from "介绍 / Introduce" to "副标题 / Subtitle" and from "描述 / Description" to "序章 / Description"（保持英文字段名，仅改中文 label）. The admin UI lives in a separate repo — coordinate the change.
3. **External consumers**: Is anyone else reading `mx-space/api-client` who needs a deprecation window? If yes, switch to the dual-field strategy in the Backward Compatibility section.

---

## Related

- Translation support for `topic.description` — landed at commit `27734a90` (2026-04-29). This plan builds on that work; the rename touches the same files.
