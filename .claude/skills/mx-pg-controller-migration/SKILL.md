---
name: mx-pg-controller-migration
description: Use when verifying and porting an mx-core controller (Post/Note/Page/Comment/Category/etc.) after the MongoDB→PostgreSQL cutover, or when its data shape no longer matches what api-client and admin-vue3 expect. Triggers on "校验 controller"、"check controller"、"迁移 controller"、"修复迁移后的接口"、"data missing after PG migration"、"related/category 字段丢了" and similar.
---

# mx-core PG Cutover · Controller Verification & Downstream Sync

## Repos in scope (paths assume worktree root)

| Layer | Path | Concern |
| --- | --- | --- |
| Server | `apps/core/src/modules/<mod>/` | controller / service / repository correctness |
| SDK | `packages/api-client/{models,controllers}/` | type definitions must match server response |
| Dashboard | `/Users/innei/git/innei-repo/admin-vue3/apps/admin/src/{models,api,views/manage-<mod>}/` | consumer code reads new field names |

**No server-side back-compat shim.** If a field rename is correct on PG, propagate it through SDK and dashboard. The user has explicitly opted out of legacy aliases.

**Data completeness IS a bug.** A migration that compiles but silently drops `related`, `category`, or any joined value is broken. Always cross-check what the **old mongoose pipeline emitted** against what the new repository emits.

## Workflow (run in this order)

### 1 · Snapshot the migration delta

Identify the PG cutover commit for the module and diff against the last Mongo-era commit. The mx-core history convention:

```bash
# Last canonical pre-PG commit (refactor: comment module ...)
PRE_PG=58983aef
# PG cutover for content modules
PG_CUT=d5e582ba

git show $PRE_PG:apps/core/src/modules/<mod>/<mod>.controller.ts | head -200
git show $PRE_PG:apps/core/src/modules/<mod>/<mod>.model.ts
git log --oneline $PRE_PG..HEAD -- apps/core/src/modules/<mod>/
```

Look for: `autopopulate`, `aggregate(...$lookup, $project)`, `BaseModel`/`WriteBaseModel` virtuals, `count: { read, like }`, `pin`, `created`, `modified`. Any of these are likely lossy after migration.

### 2 · Walk every endpoint

Read the controller end to end. For each route, ask:

1. **Field names**: does the response shape still include what the dashboard / front-end consumes? (See mapping table below.)
2. **Joined data**: did mongoose emit a `category`, `related`, `topic`, `ref`, … via `populate`/`$lookup`? If yes, does the new repository attach it? Use `attach<Foo>` helpers; never trust that the controller's `(doc as any).related` is populated — the repo is the source of truth.
3. **Aggregate-pipeline order**: old code often did `$project (select)` BEFORE `$lookup`, so `$lookup`-injected fields survived `select` filtering. The PG port frequently inverts that order and silently drops joined fields. **Check `select`-style projections in the controller** — they must whitelist or unconditionally preserve joined fields.
4. **Dead JSON-string parsing**: code like `if (typeof doc.meta === 'string') doc.meta = JSON.safeParse(...)` is dead under `jsonb`. Delete it.
5. **Redundant aliases**: `related: body.relatedId as any` style props that the service no longer reads. Delete.
6. **Cross-cutting enums** (`DraftRefType`, `CollectionRefTypes`, `CommentRefType`, `RecentlyRefTypes`): commit `b9823fb6` unified `ref_type` to **singular lowercase** (`'post' | 'note' | 'page' | 'recently'`). The PG SQL UPDATE migrated existing rows. The dashboard's local enum copies still hold legacy plural/PascalCase values and MUST be re-checked when verifying any module that touches drafts, comments, recently, file-references or ai-translations.

### 3 · Field rename map (Mongo → PG, after snake-case → camel-case round-trip)

| Mongo field | PG field | Notes |
| --- | --- | --- |
| `_id` | *(removed)* | Only `id` (Snowflake bigint as string) exists |
| `created` | `createdAt` | server returns `created_at`, SDK camelcases |
| `modified` | `modifiedAt` | nullable |
| `pin` (Date or null) | `pinAt` | nullable |
| `count: { read, like }` | `readCount`, `likeCount` | flat int columns |
| `commentsIndex`, `allowComment` | *(usually removed)* | check the PG schema; `posts/notes/pages` no longer have them, only `recentlies` does |
| populated `category` / `related` | computed via repo `attach*` | not in the row, must be loaded explicitly |

When in doubt, read `apps/core/src/database/schema/*.ts` — it is authoritative.

### 4 · Fix the server (apps/core)

Typical patches:

- **Repository**: extend `<Mod>Row` with optional joined fields (`category?`, `related?`); add a private `attach<Foo>(rows)` that does **one batched query**, never per-row N+1; wire it into `findById` / `findBySlug` / `find<...>` / `list`.
- **Controller**: when applying `select` whitelisting, force-include joined keys that are not addressable by the query string (`selected.add('id'); selected.add('category')`). Document why with a brief comment.
- **Service / controller**: drop redundant aliases; fold legacy input fields (`created`, `pin`) into their PG counterparts in the write path (the comment in `post.service.ts` after commit `536f1df9` is the reference pattern).

Run, scoped to the module:

```bash
pnpm -C apps/core exec tsc --noEmit
pnpm -C apps/core exec eslint src/modules/<mod>/
```

### 5 · Sync the SDK (packages/api-client)

The SDK type IS the contract. It must reflect the actual server payload after `snake_case → camelCase`.

For each renamed field:

1. Update `models/<mod>.ts` — usually means *not* extending the legacy `TextBaseModel` (which still has `created`/`modified`); flatten the model with PG names instead. Keep `BaseModel`/`TextBaseModel` untouched until the matching module is also being migrated, to avoid touching unrelated SDK types.
2. Grep for `Pick<<Mod>Model, …>` across the SDK — `models/category.ts`, `models/aggregate.ts`, `controllers/<mod>.ts`, `controllers/search.ts` — and rename the picked keys.
3. Update `<Mod>ListOptions.sortBy` literal unions in `controllers/<mod>.ts` to the PG names.

```bash
pnpm -C packages/api-client exec tsc --noEmit   # ignore the TS6.0 deprecation noise
```

### 6 · Sync the dashboard (admin-vue3)

The dashboard uses its **own** model copies under `apps/admin/src/models/<mod>.ts` (not the api-client types). Both must be updated.

1. Rewrite `apps/admin/src/models/<mod>.ts` and any cross-module `Pick<...>` (e.g. `models/category.ts → PickedPostModelInCategoryChildren`).
2. Update views under `apps/admin/src/views/manage-<mod>/`:
    - Table column `key`s (used by `n-data-table`'s sorter)
    - `select` query strings sent to the server
    - All `row.<oldField>` reads → `row.<newField>` (search for `row.created`, `row.modified`, `row.pin`, `row.count`, `commentsIndex`, `allowComment`)
3. The reactive form state may keep boolean toggles (`pin: boolean`) — don't change the type, but in `loadPublished` map `payload.pinAt → data.pin = !!payload.pinAt` so the toggle still binds.
4. Components like `<RelativeTime>` require non-null time. For `modifiedAt` (nullable) use `row.modifiedAt ?? row.createdAt`.
5. **Re-check ref-type enums.** Dashboard ships its own copies — these are out of date:
    - `apps/admin/src/models/draft.ts → DraftRefType` was `'posts' | 'notes' | 'pages'`, must become `'post' | 'note' | 'page'`.
    - `apps/admin/src/models/recently.ts → RecentlyRefTypes` was `'Post' | 'Note' | 'Page'`, must become `'post' | 'note' | 'page' | 'recently'`.
    - Anywhere a controller verifies that touches drafts (post/note/page editor pages), recently, comments, or ai-translations: grep the dashboard for the enum, fix values, run typecheck — enum members keep the same names so call sites are unaffected.

```bash
cd /Users/innei/git/innei-repo/admin-vue3 && pnpm -C apps/admin run typecheck
```

(If pnpm version warnings appear, they're unrelated — only `tsc` errors matter.)

## Checklist (run per module)

- [ ] Read `<mod>.controller.ts`, list every route
- [ ] `git show <pre-pg>:.../<mod>.model.ts` — note virtuals, populates, count shape
- [ ] For each route, list (field rename × joined-data × dead-code) issues
- [ ] Patch repository: add `attach<Foo>` + wire into all read paths
- [ ] Patch controller: preserve joined fields under `select`; drop dead `JSON.safeParse(meta)` and redundant aliases
- [ ] `pnpm -C apps/core exec tsc --noEmit`
- [ ] Update `packages/api-client/models/<mod>.ts` + cross-references in `models/category.ts` / `models/aggregate.ts` / `controllers/{<mod>,search}.ts`
- [ ] `pnpm -C packages/api-client exec tsc --noEmit`
- [ ] Update admin-vue3 `models/<mod>.ts`, `models/category.ts`, `views/manage-<mod>/*`
- [ ] If module touches drafts/comments/recently/file-references/ai-translations: re-verify dashboard ref-type enum values are singular lowercase
- [ ] `pnpm -C apps/admin run typecheck` (in admin-vue3 worktree)
- [ ] Eyeball the diff one more time: any `row.created` / `row.pin` / `count?.read` left?

## Common bugs (caught while migrating PostController)

| Symptom | Root cause | Fix |
| --- | --- | --- |
| `related` is always `[]` on detail page | Repo's `findByCategoryAndSlug` / `findById` never call `getRelatedPosts`; controller does `(baseData as any).related ?? []` | Add `attachRelated()`, wire into all read paths |
| Joined `category` disappears after `select=...` | Old aggregate did `$lookup` AFTER `$project`; new code attaches first then filters keys | `selected.add('category')` (and `'id'`) before filtering |
| `sortBy=created` silently does nothing | Repository compares `params.sortBy === 'createdAt'`; dashboard still sends `created` | Either dashboard updates literal, or document failure mode (we chose: update dashboard) |
| `select: 'title _id created modified count pin'` returns nearly empty objects | The select string still uses Mongo names | Update select string to PG names: `'title id createdAt modifiedAt readCount likeCount pinAt'` |
| Edit form loses pin/publish state | `useParsePayloadIntoData` matches by key; reactive holds `pin`, payload has `pinAt` | Map in `loadPublished`: `postData.pin = !!postData.pinAt` |
| `JSON.safeParse(doc.meta)` branch unreachable | `meta` is `jsonb`, drizzle returns object | Delete the branch |

## Red flags — STOP and re-check

- A controller method returns `(doc as any).<something>` — the cast is hiding a missing repo attachment.
- New repository method has `await Promise.all(rows.map(r => this.attach<Foo>(r)))` shape — that's N+1; switch to a batched `attach<Foo>(rows: Row[])`.
- You're tempted to add a "back-compat alias" on the server. Don't. The user has rejected this — propagate the rename downstream instead.
- You changed `BaseModel` / `TextBaseModel` in api-client to fix a single module. Don't — that affects every module that hasn't been migrated yet. Flatten the single model instead.
- A dashboard column's sorter `key` doesn't match a real PG field (e.g. `key: 'count.read'`). Sorting is broken — pick a real key (`'readCount'`) or remove sortability.

## Reference: tools used during PostController pass

```bash
# Find every consumer of a model in the dashboard
grep -rn "<Mod>Model\b" /Users/innei/git/innei-repo/admin-vue3/apps/admin/src --include="*.ts" --include="*.tsx" --include="*.vue"

# Find dashboard accesses to old fields scoped to one module's views
grep -rn "row\.created\|row\.modified\|row\.pin\b\|row\.count\." \
  /Users/innei/git/innei-repo/admin-vue3/apps/admin/src/views/manage-<mod> 2>/dev/null

# Reference fix commit for write-side input mapping (created→createdAt, pin→pinAt)
git show 536f1df9 -- apps/core/src/modules/post/post.service.ts
```
