# Knowledge Base — Book + Tree Node Design

**Date:** 2026-05-11
**Status:** Draft (pending implementation plan)
**Module:** `apps/core/src/modules/book/`

## 1. Goals

Extend the personal blog with a knowledge-base subsystem that hosts multiple independent "books" — long-form structured works such as novels, manuals, wikis, or tutorials. Each book is a self-contained tree of nodes. The subsystem is a brand-new module that does not retrofit existing `post`/`note`/`page` entities; cross-entity coupling is loose (URL/soft references only).

Primary use cases:

- Author a novel chapter-by-chapter with drafts, locked chapters, and reader navigation.
- Build a structured wiki / handbook with arbitrary-depth folders and entries.
- Reuse existing platform capabilities: Lexical content, BM25 multilingual search, AI summary/translation/insights, comments, i18n.

Non-goals (deferred to later iterations):

- Cross-book "knowledge graph" computed automatically.
- Multi-author collaboration / role-based ACL inside a single book.
- Reading progress per visitor, bookmarks, annotations.
- RSS/feed of new chapters (will hook into existing subscribe module later).
- Yohaku (Next.js) reader UI — out of scope for the server-side spec; the public APIs are designed so that a SSR reader can be built on top.

## 2. Domain Model

Four tables, Snowflake `bigint` ids, snake_case at the API boundary (handled by the existing `JSONTransformInterceptor`).

### 2.1 `book`

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint` (snowflake) | PK |
| `slug` | `text` | Unique, URL-safe |
| `title` | `text` |  |
| `subtitle` | `text nullable` |  |
| `cover_url` | `text nullable` |  |
| `author_id` | `text` | Better Auth user id |
| `status` | `enum('draft','unlisted','published')` |  |
| `default_locale` | `text` | e.g. `zh-CN` |
| `description` | `jsonb nullable` | Lexical JSON — book-level intro |
| `meta` | `jsonb` default `{}` | Free-form (genre, tags, ISBN-like) |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `published_at` | `timestamptz nullable` |  |

Indexes: `(slug)` unique, `(status, published_at desc)` for public listing.

### 2.2 `book_node`

Adjacency-list tree, sibling-ordered by integer rank.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint` | PK |
| `book_id` | `bigint` | FK → `book.id`, on delete cascade |
| `parent_id` | `bigint nullable` | FK → `book_node.id`, on delete cascade |
| `sort_order` | `int` | Sibling rank; default in 1024-step increments to allow cheap reorder |
| `type` | `enum('folder','chapter')` | folder ⇒ container only |
| `slug` | `text` | Unique within `book_id` |
| `title` | `text` |  |
| `content` | `jsonb nullable` | Lexical JSON; null for folder |
| `status` | `enum('draft','unlisted','published')` |  |
| `password` | `text nullable` | bcrypt hash; per-node lock |
| `word_count` | `int` default 0 | Computed on save |
| `meta` | `jsonb` default `{}` |  |
| `created_at` / `updated_at` / `published_at` | `timestamptz` |  |

Indexes:

- `(book_id, parent_id, sort_order)` — TOC traversal
- `(book_id, slug)` unique — public addressability
- `(book_id, status)` — visibility filtering

Constraints:

- `parent_id` must point to a node with the same `book_id` (enforced at service layer; CHECK constraint optional via trigger if needed).
- `type='folder'` ⇒ `content IS NULL` (CHECK constraint).
- `type='chapter'` ⇒ `content` may be null (empty chapter is allowed for outlining).

### 2.3 `book_node_locale`

Locale overrides; main `book_node` row holds the `default_locale` content.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint` | PK |
| `node_id` | `bigint` | FK → `book_node.id`, cascade |
| `locale` | `text` |  |
| `title` | `text` |  |
| `content` | `jsonb` | Lexical JSON |
| `status` | `enum(...)` | Mirrors node states (a translation may lag) |
| `source_content_hash` | `text` | Hash of the source `book_node.content` at translation time — UI flags "source updated" when mismatched |
| `created_at` / `updated_at` | `timestamptz` |  |

Unique `(node_id, locale)`.

### 2.4 `book_backlink`

Reverse-link adjacency, computed from a scan of Lexical content on save.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint` | PK |
| `source_node_id` | `bigint` | FK → `book_node.id`, cascade |
| `target_node_id` | `bigint` | FK → `book_node.id`, NOT cascade (see Stale below) |
| `occurrence` | `int` default 1 | Count of links in source |
| `is_stale` | `bool` default false | Set true when target deleted |
| `created_at` / `updated_at` | `timestamptz` |  |

Unique `(source_node_id, target_node_id)`. Indexes on `target_node_id` (lookup backlinks for a chapter) and `source_node_id` (recompute on save).

Stale handling: when a node is deleted, rows where it is `target_node_id` are *not* deleted; they are marked `is_stale=true` so the UI can surface "broken reference". Author may manually clean.

## 3. Tree Operations

### 3.1 Storage strategy

Adjacency list with integer `sort_order`. Subtree queries use recursive CTE scoped by `book_id`:

```sql
WITH RECURSIVE descendants AS (
  SELECT * FROM book_node WHERE id = $1
  UNION ALL
  SELECT n.* FROM book_node n
  JOIN descendants d ON n.parent_id = d.id
)
SELECT * FROM descendants;
```

`book_id` filter is always present to limit branching and let PostgreSQL prune via the `(book_id, parent_id, sort_order)` index.

### 3.2 Reorder

Siblings carry integer `sort_order` (initial 1024 steps). Insert-between picks midpoint; if the gap shrinks to ≤ 1, run a per-parent compaction transaction that rewrites siblings to fresh 1024-step ranks. Compaction is O(k) on a single parent's children — cheap.

### 3.3 Move

Endpoint `POST /books/:bookId/nodes/:id/move` with `{ newParentId, beforeId? }`:

1. Validate `newParentId` belongs to the same book.
2. Validate that `newParentId` is not the node itself nor any descendant (single recursive CTE check).
3. Acquire a per-book advisory lock (`pg_advisory_xact_lock(book_id)`) to serialize concurrent moves within a book.
4. Compute new `sort_order` based on `beforeId`.
5. Update `parent_id` + `sort_order`.

### 3.4 Delete

Default mode: cascade — the node and all descendants are removed (DB-level cascade FK).
Optional mode (`?mode=reparent`): children are reparented to the deleted node's parent. Implementation: in a single transaction, update children's `parent_id` to grandparent and `sort_order` to slot in after the deleted node, then delete.

## 4. HTTP API

All admin routes are `@Auth()`-protected; public routes are open and apply visibility filters.

### 4.1 Admin

```
POST   /books
PATCH  /books/:id
DELETE /books/:id

GET    /books/:bookId/nodes/:id            (incl. drafts)
POST   /books/:bookId/nodes                { parent_id, type, title, slug?, content? }
PATCH  /books/:bookId/nodes/:id
DELETE /books/:bookId/nodes/:id?mode=cascade|reparent

POST   /books/:bookId/nodes/:id/move       { newParentId, beforeId? }
POST   /books/:bookId/nodes/:id/reorder    { sortOrder }

PUT    /books/:bookId/nodes/:id/locales/:locale   upsert translation row
DELETE /books/:bookId/nodes/:id/locales/:locale

POST   /books/:bookId/nodes/:id/translate?targetLocale=en   (kick off ai-translation; writes to locale row)
POST   /books/:bookId/nodes/:id/summarize                   (kick off ai-summary)
POST   /books/:bookId/reindex                                (full BM25 rebuild for book)
```

### 4.2 Public

```
GET /books                                  paginated list, published only
GET /books/:slug                            book metadata + TOC tree (published nodes only)
GET /books/:bookSlug/:nodeSlug?locale=en    node detail + prev/next + locale negotiation
GET /books/:bookSlug/:nodeSlug/backlinks    list of (book, node) referrers, published only, stale filtered
POST /books/:bookSlug/:nodeSlug/unlock      { password } → returns content + short-lived unlock token
```

Response shapes follow existing platform conventions:

- Lists with `@Paginator()` produce `{ data, pagination }`.
- TOC is an object (not paginated), returned directly.
- All keys snake_case at boundary (`JSONTransformInterceptor`).
- `?format=markdown` flag triggers Lexical → Markdown via `helper.lexical.service`.

### 4.3 TOC payload (illustrative)

```json
{
  "book": { "id": "...", "slug": "...", "title": "..." },
  "tree": [
    {
      "id": "...", "slug": "preface", "title": "Preface",
      "type": "chapter", "has_password": false,
      "child_count": 0, "children": []
    },
    {
      "id": "...", "slug": "part-1", "title": "Part 1",
      "type": "folder", "has_password": false,
      "child_count": 12, "children": [ /* ... */ ]
    }
  ]
}
```

The TOC is computed in a single recursive CTE per request; for very large books (≫ 1000 nodes) we can add a depth cap parameter later.

## 5. Visibility & Access

Effective visibility of a node = `min(book.status, node.status)` where the order is `draft < unlisted < published`.

| Plane | draft | unlisted | published |
|---|---|---|---|
| Public list / sitemap / feed | no | no | yes |
| Direct URL access | owner only | yes | yes |
| BM25 search index | no | no | yes |
| AI auto-summary on event | no | no | yes |

`book-node-visibility.service.ts` exposes:

- `applyPublicFilter(query)` — `status='published'` plus parent chain published.
- `assertReadable(node, currentUser)` — throws `403` if hidden, `404` if draft and not owner.

The repository's `find*` methods accept a visibility option; controllers select it based on the route (admin vs public). No bypass at the controller-level — visibility is owned by the service layer.

## 6. Per-Node Password Lock

- `password` column stores a bcrypt hash; never returned in any response.
- Public node detail for a locked node returns:
  ```json
  { "id": "...", "title": "...", "slug": "...", "has_password": true, "content": null }
  ```
- Client posts `POST /books/.../:nodeSlug/unlock { password }`; on success the response returns the full content plus a JWT cookie scoped to the node id, valid 15 minutes. Subsequent fetches with the cookie return content directly.
- BM25 indexer skips locked nodes entirely (no token leakage via search snippets).
- AI summary, translation, insights are admin-triggered only for locked nodes — never auto-run on publish; any cached output is keyed by node id and access-gated through the same unlock flow on the public side.
- Locked chapters disable public comment posting; existing comments remain hidden until unlocked.

## 7. Lexical Integration

### 7.1 Content nodes

`content` reuses the same Lexical JSON shape as `note`. The headless editor and `$toMarkdown()` conversion in `helper.lexical.service.ts` are reused unchanged.

### 7.2 Wiki links — URL scheme

To avoid touching `@haklex/rich-headless`, wiki links are encoded as standard Lexical link nodes with URL scheme `book://<bookSlug>/<nodeSlug>` (or `book://./<nodeSlug>` for same-book links). The scanner (`lexical/wiki-link.scanner.ts`) walks the Lexical tree on save, extracts target slugs, resolves to node ids, and produces a `{ targetNodeId, occurrence }[]` list.

A future enhancement can introduce a dedicated `BookWikiLinkNode` in haklex for richer UI (preview popovers, broken-link badges); the scanner contract is stable enough to accommodate both.

### 7.3 On-save pipeline

When a chapter is created or updated:

1. Compute `word_count` from Lexical text nodes.
2. Run wiki-link scanner → diff against existing `book_backlink` rows where `source_node_id = node.id` → upsert / delete / increment occurrence.
3. Emit `BookNodeUpdated` (or `BookNodePublished` if status transitions to published).

Word count and backlink upsert happen synchronously inside the save transaction; event-driven consumers (search index, AI) run async.

## 8. Multi-language

The main `book_node` row holds the canonical content in `book.default_locale`. `book_node_locale` stores per-locale overrides for title + content.

Locale negotiation on read:

1. Read query `?locale=xx`; default to `Accept-Language` header → `book.default_locale`.
2. If a `book_node_locale` row exists for `(node_id, locale)`, return it; otherwise return the main row.
3. Response meta includes `locale`, `locale_fallback: boolean`.

AI translation (`POST /books/.../:id/translate?targetLocale=en`):

- Runs `ai-translation` over the canonical content.
- Output is parsed through `lexical-translation-parser`.
- Resulting Lexical JSON is written to `book_node_locale` with `source_content_hash` set to the hash of the canonical content at translation time.
- Public API exposes `locale_source_stale: true` when `source_content_hash` no longer matches.

TOC titles likewise honor locale negotiation per node.

## 9. Search (BM25)

The existing `multilingual-bm25-search` indexer gains a new source type `book-node`. Indexed document:

```
{
  id: node.id,
  source: 'book-node',
  book_id, book_slug, book_title,
  node_slug, title, content_text, locale,
  status: 'published'
}
```

Triggers:

- `BookNodePublished` → upsert document for canonical + each published locale row.
- `BookNodeUpdated` (already published) → upsert document(s).
- `BookNodeUnpublished` / `BookNodeDeleted` → remove document(s).
- Locked-node and `status != published` rows are never indexed.

Admin endpoint `POST /books/:id/reindex` rebuilds all docs for a book — recovery hatch for index drift.

## 10. AI Integration

All three AI surfaces (summary, translation, insights) integrate by extending their entity key shape to include `book-node`.

- `ai-summary` — cache key `(entity='book-node', node_id, locale, content_hash)`. Reuses chunk-and-reduce logic from existing post/note path. Book-level summary derived from chapter summaries is a later iteration.
- `ai-translation` — wired via §8.
- `ai-insights` — adds `book-node` as a tracked entity; pipeline unchanged.

Default behavior is manual trigger only. A boolean option `book.ai_auto_summary_on_publish` (in the existing `option` module) can flip auto-run on for published, non-locked chapters. Token cost considerations gate this default off.

## 11. Comments

Extend `comment.refType` enum to include `book-node`. Comment service's entity loader dispatches on `refType` and loads a `BookNode` via `BookNodeService.findByIdForComment(nodeId, currentUser)`, which:

- Enforces visibility.
- Refuses to load locked chapters for public posting.
- Returns minimal node info (book slug + node slug + title) for comment rendering.

Notifications follow the existing reader subscription flow keyed by comment thread.

## 12. Module Layout

```
apps/core/src/modules/book/
  book.module.ts
  controllers/
    book.controller.ts
    book.public.controller.ts
    book-node.controller.ts
    book-node.public.controller.ts
  services/
    book.service.ts
    book-node.service.ts
    book-node-tree.service.ts          # recursive CTE, move, reorder, advisory lock
    book-node-locale.service.ts
    book-node-visibility.service.ts
    book-backlink.service.ts
  repositories/
    book.repository.ts
    book-node.repository.ts
    book-node-locale.repository.ts
    book-backlink.repository.ts
  schemas/                              # Zod
    book.schema.ts
    book-node.schema.ts
    book-node-locale.schema.ts
  dto/
    create-book.dto.ts
    update-book.dto.ts
    create-book-node.dto.ts
    update-book-node.dto.ts
    move-book-node.dto.ts
    upsert-locale.dto.ts
    unlock-node.dto.ts
  events/
    book-node.events.ts                 # BookNodePublished, Updated, Unpublished, Deleted
  lexical/
    wiki-link.scanner.ts
```

Database schema files under `apps/core/src/database/schema/`:

- `book.ts`
- `book-node.ts` (+ `book_node_locale`)
- `book-backlink.ts`

Repositories register in `repository.tokens.ts` and extend `BaseRepository`.

File-size budget: 500 lines max. Tree-service may approach the limit; if so, split visibility filtering into `book-node-visibility.service.ts` (already planned) and keep `book-node-tree.service.ts` focused on structural mutations.

## 13. Events

Defined in `events/book-node.events.ts`:

| Event | Payload | Consumers |
|---|---|---|
| `BookNodePublished` | `{ nodeId, bookId, locale }` | search indexer, optional AI summarizer, subscribe (future) |
| `BookNodeUpdated` | `{ nodeId, bookId, changedFields }` | search indexer, backlink propagator |
| `BookNodeUnpublished` | `{ nodeId, bookId }` | search indexer |
| `BookNodeDeleted` | `{ nodeId, bookId }` | search indexer, backlink staleness |
| `BookNodeLocaleUpserted` | `{ nodeId, locale }` | search indexer |

Consumers subscribe via the project's existing `EventManager`. All event handlers must be idempotent; retries are best-effort.

## 14. Migrations

Authored with the `mx-migration-author` skill following the expand-contract pattern (mx-core runs rolling deploys with two replicas via Dokploy).

Phase 1 — expand (this spec):

- Create `book`, `book_node`, `book_node_locale`, `book_backlink` tables with all columns and indexes.
- Add `book-node` to `comment.refType` enum (Postgres `ADD VALUE`, expand-only operation).

No contract phase required for this initial introduction. Future schema changes (e.g., adding `materialized_path` or switching to `ltree`) will follow expand-contract on their own.

`pnpm -C apps/core run lint:migrations` must pass.

## 15. Testing

Vitest with Postgres testcontainers (`startPgTestContainer()`) and the existing `createE2EApp` helper.

Unit:

- `book-node.repository`: insert/find/visibility filter matrix.
- `book-node-tree.service`: build, move (anti-cycle), reorder, compaction, delete cascade vs reparent.
- `book-backlink.service`: wiki-link scanner against Lexical fixtures; upsert/delete diff; stale marking on target deletion.
- `book-node-visibility.service`: status × parent-status × locked matrix.
- `wiki-link.scanner`: same-book `./` resolution, cross-book resolution, malformed slugs.

E2E:

- Admin CRUD happy path.
- Public list + TOC filters drafts/unlisted.
- Locked node returns redacted payload; unlock round-trip with cookie.
- Locale negotiation: hit, fallback, stale flag.
- Move endpoint rejects self-descendant move, succeeds otherwise; sort_order persisted.
- Backlink upserted on save; stale flag on target delete.
- Comment with `refType=book-node` end-to-end.
- Search indexer mock receives expected events on publish/update/delete.

Performance baseline:

- TOC query for a synthetic 1000-node book < 50 ms warm cache via the recursive CTE.
- `EXPLAIN ANALYZE` captured in test setup for regression detection.

## 16. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Concurrent moves within a book corrupt tree state | `pg_advisory_xact_lock(book_id)` in move/delete txns |
| Backlink scan blocks save on large chapters | Run scanner inline only on diff'd link set; offload to event queue if measured > 50 ms p99 |
| BM25 index drifts vs DB | Admin `POST /books/:id/reindex` full-rebuild endpoint |
| AI translation drifts after source edit | `source_content_hash` stored; public response flags stale |
| Locked content accidentally indexed | Visibility filter applied at indexer entry; explicit unit test |
| Tree height explodes (pathological recursion) | Optional depth cap parameter on TOC; can hard-cap at 16 in service if needed |
| Migration introduces downtime | Expand-only schema add; rolling deploy safe by construction |

## 17. Rollout

Sequenced as separate PRs to keep diffs reviewable:

1. **PR-1 — Foundation**: schema migrations, repositories, book + book_node CRUD, public read, visibility, locale tables and negotiation, per-node password.
2. **PR-2 — Backlinks**: wiki-link scanner, `book_backlink` table, on-save pipeline, public backlinks endpoint.
3. **PR-3 — Search**: BM25 indexer extension + reindex endpoint + event handlers.
4. **PR-4 — AI**: summary/translation/insights wiring + admin endpoints.
5. **PR-5 — Comments**: refType extension and entity loader.
6. **PR-6 — (later)** subscribe/feed integration, Yohaku reader UI (separate repo).

Each PR is independently deployable behind the rolling-deploy contract.

## 18. Open Questions

- Should books support arbitrary metadata fields editable via UI, or stay closed to a fixed `meta` jsonb? — left open; UI design decides.
- Reading-progress per visitor: deferred. May land as a separate module that references `book_node.id` without coupling.
- Cross-book wiki links: stored, but should the public backlink listing show them? — start with same-book only in the response; cross-book can be opted-in per book later.

---

End of spec.
