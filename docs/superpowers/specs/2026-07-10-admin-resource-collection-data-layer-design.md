# Admin Resource Collection Data Layer — Design

Date: 2026-07-10
Status: Approved
Supersedes: PR #2741 POC (`apps/admin/src/data/post-category-resource/`)

## Background

PR #2741 validated a core thesis for admin UI state: business entities should
live in a normalized client store, with React Query demoted to a transport
layer, and optimistic writes expressed as pending transactions that survive
stale query hydration. The POC proved the thesis (9 passing store tests,
including the stale-hydration case) but its implementation has known defects:

1. `upsertPost` replaces entities wholesale, so a partial list row clobbers a
   full detail entity (edit-page data-loss risk).
2. `categoryIds` mixes two sources of truth (managed list membership vs.
   entities seen via embedded post categories).
3. `ResourceCategory` union punched through with `as CategoryModel` casts.
4. Transaction commit/rollback depends on caller-written handlers; a throwing
   handler leaks pending ops forever.
5. Selector identity churn re-renders every list subscriber on any store
   change.

This design replaces the POC with a generic, reusable kernel. Semantics are
deliberately aligned with TanStack DB (collections, optimistic transactions,
query-backed collections) so a future migration to it, post-1.0, stays cheap.
We build our own light kernel now (TanStack DB is beta 0.6).

## Goals

- One generic data layer for all admin entities; post/category migrate first.
- React Query stays as transport: retry, dedupe, invalidation, devtools.
  Query cache holds only hydration receipts, never business entities.
- Optimistic writes with automatic commit/rollback; pending state survives
  stale hydration.
- Call-site DX: one-line collection ops for the common case, an explicit
  transaction for multi-op/batch.
- No unbounded re-render storms; entity-level subscription granularity.

## Non-Goals

- Entity-level refcount GC (admin is single-user; entity counts are small).
- Offline persistence, sync engines, cross-tab state.
- Migrating note/page/comment/etc. in this iteration.

## Architecture

```
apps/admin/src/data/
  resource/                    # kernel, zero business knowledge
    collection.ts              # defineCollection: entity table + lifecycle
    transaction.ts             # optimistic overlay + createTransaction
    list-index.ts              # query-keyed ordered id lists + pagination
    hooks.ts                   # useEntity / useEntityList / useCollectionListQuery / useCollectionDetailQuery
    key.ts                     # stable stringify (key-order independent)
  resources/                   # one file per domain
    post.ts                    # posts collection: normalize + persistence
    category.ts                # categories collection
```

## Collection Kernel

Each collection owns an independent zustand store (subscription isolation,
per-collection reset/GC later).

```ts
export const categories = defineCollection<CategoryEntity>({
  name: 'category',
  getKey: (c) => c.id,
  onUpdate: ({ id, patch }) => updateCategory(id, patch),
  onDelete: ({ id }) => deleteCategory(id),
})

export const posts = defineCollection<PostModel>({
  name: 'post',
  getKey: (p) => p.id,
  normalize: (post) => {
    if (post.category) categories.upsert(post.category)
  },
  onUpdate: ({ id, patch }) => patchPost(id, patch),
  onDelete: ({ id }) => deletePost(id),
})
```

Internal state, three layers; base/overlay separation is what makes pending
writes survive stale hydration (inherited from the POC):

- `entitiesById` — server truth (base). Only hydration and transaction commit
  write here.
- `pendingOpsByKey` — ordered optimistic op chains, layered over base at read
  time.
- `versionByKey` — monotonic per-entity version for cheap selector equality.

Rules:

- **Upsert always merges** (`{ ...prev, ...next }` by default), never
  replaces. A partial list row can no longer clobber a hydrated detail
  entity. Domains may override with a custom `merge(prev, next)`.
- **Membership is not collection state.** A collection is only an entity
  table. "Which categories appear in the management list" is a list-index
  written exclusively by its owning query. Embedded categories enter the
  table but never any list.

## Write Path

Common case, one line:

```ts
posts.update(id, (draft) => {
  draft.isPublished = true
})
```

Internal flow: compute patch via immer → register pending op (overlay is
immediately visible) → call `onUpdate` → on resolve, commit (merge server
echo into base, drop op) → on reject, rollback (drop op, record error in
`errorsByKey`). **Commit/rollback is guaranteed by the kernel in a `finally`
path — a throwing user handler cannot leak a pending op.**

`posts.delete(id)` and `posts.insert(entity)` follow the same lifecycle with
`onDelete`/`onInsert`.

Multi-op / batch escape hatch:

```ts
const tx = createTransaction()
ids.forEach((id) => tx.delete(posts, id))
await tx.commit(async () => {
  const results = await Promise.allSettled(ids.map(deletePost))
  return { fulfilledKeys: succeeded(results, ids) }
})
```

`tx.commit(request)` semantics:

- Request resolves with `{ fulfilledKeys }`: ops on those keys commit, all
  other ops roll back (partial success).
- Request resolves without `fulfilledKeys`: all ops commit.
- Request rejects: all ops roll back, error rethrown.

Side effects (toasts, navigation, query invalidation) live at the call site
via `.then`/`.catch`, never inside the kernel.

## Read Path

```ts
const post = useEntity(posts, id)          // base ⊕ overlay
const { items, pagination, status } = useEntityList(posts, queryKey)
const category = useEntity(categories, post?.categoryId)
```

Re-render control:

- `useEntity` subscribes to `versionByKey[id]`; unchanged version returns the
  previous reference.
- `useEntityList` subscribes to the id array (shallow) plus the sum of member
  versions; a missing index returns a module-level `EMPTY` constant.
- Joins (post→category) are composed in the hook layer with memoization.
  No store-side reverse indexes and no full-table rebuild routines
  (`postIdsByCategoryId` from the POC is dropped). If a join proves slow
  later, add a targeted index then.

## React Query Integration

```ts
const listQuery = useCollectionListQuery(posts, {
  queryKey: adminQueryKeys.posts.list(params),
  queryFn: () => getPosts(params),
  toPage: (r) => ({ items: r.data, pagination: r.pagination }),
})
```

- Hydration runs each entity through `normalize` then merge-upsert, and
  writes the list-index under the stable-serialized query key.
- The query cache stores only a receipt (`{ hydratedAt }`).
- `useCollectionDetailQuery(collection, options)` is the single-entity
  variant.
- `keepPrevious: true` option on `useEntityList`: while the new key has no
  index and its query is pending, fall back to the previous key's index —
  restores the `placeholderData` pagination UX the POC lost.

## Types

No entity unions, no casts. One entity type per collection; progressively
hydrated fields are explicitly optional:

```ts
interface CategoryEntity {
  id: string
  name: string
  slug: string
  type: CategoryType
  count?: number      // present only after a list/detail query hydrates it
  createdAt?: string
}
```

Consumers handle optional fields directly. Type guards that fake completeness
(`isCategoryModel`) are removed.

## Lifecycle

- `collection.reset()` for every collection on logout.
- List-index LRU cap per collection (e.g. 50 keys).
- No entity-level GC in v1 (YAGNI for a single-user admin).

## Error Handling

- Per-entity last error in `errorsByKey`, cleared on the next successful op
  or hydration for that key.
- Transaction rollback restores visible state to base ⊕ remaining ops (later
  pending ops on the same entity replay over base, as in the POC).

## Testing

Kernel unit tests (vitest, node environment), extending the POC's nine store
tests:

- merge-upsert: partial list row does not clobber detail fields
- pending op survives stale hydration; commit clears it
- rollback of one op replays later pending ops
- throwing `onUpdate`/user handler still releases the pending op
- partial batch: `fulfilledKeys` commit, remainder rolls back
- `useEntity`/`useEntityList` reference stability across unrelated writes
- stable key serialization is object-key-order independent
- list-index LRU eviction

## Rollout

1. Kernel + unit tests.
2. Migrate category domain (small surface, validates DX).
3. Migrate post domain (list, detail, write page — the POC's footprint,
   rewritten on the new kernel).
4. Delete `apps/admin/src/data/post-category-resource/`.
5. note/page/comment and other domains in later iterations.
