# ai-embeddings — Design

- **Date:** 2026-05-23
- **Status:** Design — pending review
- **Author:** Innei (brainstormed with assistant)
- **Parent:** [AI Echo System Root](./2026-05-23-ai-echo-system-root.md)
- **Sibling specs:** [ai-echo engine](./2026-05-23-ai-echo-engine-design.md), [ai-persona](./2026-05-23-ai-persona-design.md), [ai-memory](./2026-05-23-ai-memory-design.md)

## 1. Scope

The corpus embedding substrate consumed by `ai-echo`, `ai-persona`, and `ai-memory`:

- New module: `apps/core/src/modules/ai/ai-embeddings/`
- New extension: `vector` (pgvector)
- New table: `corpus_embeddings`
- New Drizzle helper: `vector` custom column type in `packages/db-schema/src/schema/columns.ts`
- New task: `EMBED_SYNC`
- Event listeners that keep the corpus in sync with source content (notes, pages; recently deferred to v2)
- New endpoints: admin backfill + stats
- New retrieval API consumed by sibling modules

Cross-cutting decisions (IDs, distance vs similarity, model config) are defined in the root spec.

## 2. Module layout

```
apps/core/src/modules/ai/ai-embeddings/
├── ai-embeddings.module.ts
├── ai-embeddings.controller.ts
├── ai-embeddings.service.ts          # public API: embedBatch, search, syncSource
├── ai-embeddings.repository.ts
├── ai-embeddings.schema.ts           # Zod DTOs (BackfillDto, …)
├── ai-embeddings.types.ts            # RetrievalResult, ChunkSpec, …
├── ai-embeddings.constants.ts
├── ai-embeddings.errors.ts
├── chunker.ts                        # paragraph-aware chunking, deterministic
├── listeners/
│   ├── note-events.listener.ts
│   └── page-events.listener.ts
└── tasks/
    ├── embed-sync.processor.ts
    └── corpus-backfill.driver.ts     # batched driver used by both endpoint and app-migration
```

`recently` event listener is intentionally deferred to v2 (see root §5).

## 3. pgvector setup

### 3.1 Extension

```sql
-- migration 00XX_ai_vector_extension.sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3.2 Drizzle custom type

Added in `packages/db-schema/src/schema/columns.ts`:

```ts
import { customType } from 'drizzle-orm/pg-core'

export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() { return 'vector' },        // dimension-less; per-row dim stored in a separate column
  toDriver(value) {
    if (!Array.isArray(value)) throw new TypeError('vector expects number[]')
    return `[${value.join(',')}]`
  },
  fromDriver(value) {
    if (typeof value !== 'string') throw new TypeError('expected pgvector string repr')
    return JSON.parse(value) as number[]
  },
})
```

Rationale for omitting the dimension at type level: we want multiple embedding models to coexist during gradual rebuilds. Each row records its own `embedding_model` and `dim`. Indexes (added in v2) will be expression/partial indexes constrained to a single model so dimensions match within the index.

## 4. Data model

```sql
-- migration 00XX_ai_corpus_embeddings.sql
CREATE TABLE corpus_embeddings (
  id              text PRIMARY KEY,                  -- snowflake string (pkText)
  source_type     text NOT NULL,                     -- 'post' | 'note' | 'page' | 'recently' (v2)
  source_id       text NOT NULL,                     -- snowflake string of source
  chunk_index     integer NOT NULL,
  content         text NOT NULL,
  content_hash    text NOT NULL,                     -- sha256(content); change detection
  embedding       vector NOT NULL,                   -- dim per-row, see embedding_model
  embedding_model text NOT NULL,                     -- e.g. 'text-embedding-3-small'
  dim             integer NOT NULL,                  -- redundant, enables multi-model coexistence
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX corpus_embeddings_source_chunk_model
  ON corpus_embeddings (source_type, source_id, chunk_index, embedding_model);

CREATE INDEX corpus_embeddings_source
  ON corpus_embeddings (source_type, source_id);

-- ANN index deferred to v2. Exact search is fine at ≤10k rows:
-- SELECT … ORDER BY embedding <=> $query LIMIT $k;
```

Drizzle definition in `packages/db-schema/src/schema/ai.ts`.

## 5. Chunking

`chunker.ts` is pure and deterministic.

```ts
chunk(markdown: string, opts: { maxTokens: number, overlapTokens: number }): ChunkSpec[]
interface ChunkSpec { index: number, content: string, hash: string }
```

Algorithm:

1. Strip fenced code blocks (replace with a placeholder); they distort embedding signal.
2. Split on paragraph boundaries (`\n\n+`).
3. Greedy pack paragraphs into chunks until adding the next would exceed `maxTokens`. If a single paragraph exceeds `maxTokens`, fall back to sentence splitting; if a single sentence exceeds, fall back to character window.
4. Overlap: prepend the last `overlapTokens` tokens of chunk N to chunk N+1.
5. Token counting uses a cheap byte-pair-equivalent approximation (chars / 3 for CJK-heavy text, chars / 4 for ASCII-heavy); precise token counting is not required because the model handles slight overflow gracefully.
6. `hash = sha256(normalized content)`.

Defaults (`configs.aiEmbedding.*`):

- `chunkMaxTokens` = 500
- `chunkOverlapTokens` = 50

## 6. Sync pipeline

### 6.1 Event listeners

Subscribe to:

- `NOTE_CREATE`, `NOTE_UPDATE`, `NOTE_DELETE`
- `PAGE_CREATE`, `PAGE_UPDATE`, `PAGE_DELETE`
- `POST_CREATE`, `POST_UPDATE`, `POST_DELETE` (also embed posts for retrieval)

Each handler enqueues `EMBED_SYNC { sourceType, sourceId, op }` and returns immediately.

Recently event listeners are not subscribed in MVP. Adding them in v2 requires only a new listener file + a length-eligibility filter; the rest of the pipeline is unchanged.

### 6.2 `EMBED_SYNC` task processor

```
EmbedSyncTaskProcessor.handle({ sourceType, sourceId, op }):
  if op === 'delete':
    DELETE FROM corpus_embeddings WHERE source_type=$sourceType AND source_id=$sourceId
    return

  source = await sourceLoader(sourceType, sourceId)   // routes to NoteService / PageService / PostService
  if !source: return   // raced with delete; idempotent no-op

  if !aiEmbeddingModelConfigured: return   // graceful no-op; admin can backfill later

  markdown = source.text ?? source.content ?? ''
  chunks = chunker.chunk(markdown, configs.aiEmbedding)

  existing = repo.findAll({ source_type, source_id, embedding_model: configs.embeddingModel })
  existingByIndex = Map(existing.map(e => [e.chunk_index, e]))

  // 1. Delete chunks whose index no longer exists
  staleIndices = existing.map(e => e.chunk_index).filter(i => i >= chunks.length)
  if staleIndices.length: repo.delete({ source_type, source_id, embedding_model, chunk_index IN staleIndices })

  // 2. Embed only changed/new chunks
  toEmbed = chunks.filter(c => existingByIndex.get(c.index)?.content_hash !== c.hash)
  if toEmbed.length === 0: return

  runtime = await aiService.getEmbeddingModel()
  vectors = await runtime.embedBatch(toEmbed.map(c => c.content))
  rows = toEmbed.map((c, i) => ({
    id: snowflake(),
    source_type, source_id,
    chunk_index: c.index, content: c.content, content_hash: c.hash,
    embedding: vectors[i], embedding_model: runtime.modelId, dim: vectors[i].length,
  }))
  repo.upsert(rows, conflictTarget: ['source_type','source_id','chunk_index','embedding_model'])
```

Idempotency: `(source_type, source_id, chunk_index, embedding_model)` unique constraint + content-hash diff. Re-running on unchanged source is a no-op.

### 6.3 Backfill

Two callers, same driver (`corpus-backfill.driver.ts`):

- `POST /ai-embeddings/backfill { sourceTypes?: string[] }` — admin-triggered.
- `2026XXXX-ai-corpus-initial-backfill.ts` app-migration entry — runs once at first deploy after this feature lands.

Driver:

```
async function backfill({ sourceTypes }):
  for st in sourceTypes ?? ['post','note','page']:
    cursor = null
    while:
      batch = await fetchSourceIds(st, { cursor, limit: configs.aiEmbedding.backfillBatchSize })
      if batch.length === 0: break
      await Promise.all(batch.map(id => embedSyncProcessor.handle({ sourceType: st, sourceId: id, op:'update' })))
      cursor = batch[batch.length - 1]
```

The driver calls the processor directly (not the queue), bypassing the queue's quota concerns for backfill operations. Honors rate limits via a small per-batch delay.

## 7. Retrieval API

```ts
class AiEmbeddingsService {
  async search(
    query: string,
    opts: {
      topK?: number                  // default 5
      minSimilarity?: number         // default 0.7
      model?: string                 // default: resolved embedding model
      sourceTypes?: string[]         // default: all
    },
  ): Promise<RetrievalResult[]>
}

interface RetrievalResult {
  sourceType: string
  sourceId: string
  chunkIndex: number
  content: string
  distance: number                    // raw pgvector cosine distance
  similarity: number                  // 1 - distance
}
```

Implementation (exact search, MVP):

```sql
SELECT
  source_type, source_id, chunk_index, content,
  (embedding <=> $query) AS distance
FROM corpus_embeddings
WHERE embedding_model = $model
  AND ($sourceTypes IS NULL OR source_type = ANY($sourceTypes))
ORDER BY embedding <=> $query
LIMIT $topK;
```

Service-layer post-processing:

```ts
results
  .map((r) => ({ ...r, similarity: 1 - r.distance }))
  .filter((r) => r.similarity >= (opts.minSimilarity ?? 0.7))
```

Consumers (`ai-echo`, `ai-memory`) always read `similarity`. The `distance` field is exposed for debugging / admin tooling only.

## 8. API surface

| Method | Path | Auth | Body / Query | Returns |
| --- | --- | --- | --- | --- |
| POST | `/ai-embeddings/backfill` | @Auth | `{ sourceTypes?: ('post'\|'note'\|'page')[] }` | `{ taskId }` (queued backfill driver invocation) |
| GET | `/ai-embeddings/stats` | @Auth | — | `{ byModel: [{ model, dim, rows }], bySourceType: [{ type, rows }], total }` |

`/ai-embeddings/reindex` is a v2 scaffold; not exposed in MVP.

## 9. Errors

| Code | HTTP | Notes |
| --- | --- | --- |
| `AI_EMBEDDING_MODEL_NOT_CONFIGURED` | 400 | Backfill / search called without `AIFeatureKey.Embedding` assignment. Sync listener treats this as a graceful no-op. |
| `AI_EMBEDDING_BATCH_FAILED` | 502 | Upstream embedding API failure during sync; task queue retries. |

Sync failures persist no row state on `corpus_embeddings`; the task itself owns retry. A permanently failing source is visible in task queue's dead-letter list.

## 10. Configuration

Additions in `configs.schema.ts → AISchema`:

```ts
embeddingModel: field.plain(AIModelAssignmentSchema.optional(), 'Embedding model'),
aiEmbedding: field.plain(z.object({
  chunkMaxTokens: z.number().int().min(64).default(500),
  chunkOverlapTokens: z.number().int().min(0).default(50),
  backfillBatchSize: z.number().int().min(1).default(50),
  defaultMinSimilarity: z.number().min(0).max(1).default(0.7),
  defaultTopK: z.number().int().min(1).default(5),
}).optional(), 'Embedding parameters'),
```

The `defaultMinSimilarity` and `defaultTopK` are fallbacks used when consumers don't pass per-call overrides; ai-echo overrides them via `echoRetrievalMinSimilarity` / `echoRetrievalTopK` (see ai-echo engine spec §9).

`AIFeatureKey.Embedding` added to the enum. `AiService.getEmbeddingModel()` resolves it. `openai-compatible.runtime.ts` gains `listEmbeddingModels()` (reverses the chat-model filter — only ids containing `embedding` are returned).

## 11. Testing

### 11.1 Unit

- `chunker.chunk` is deterministic on fixtures; correctly handles code blocks, oversized paragraphs, overlap.
- `vector` custom type round-trips through `toDriver` / `fromDriver`.
- `AiEmbeddingsService.search` correctly computes `similarity = 1 - distance` and applies the threshold filter.

### 11.2 Integration (pg container)

- `NOTE_CREATE` → `corpus_embeddings` rows written for new note; row count matches chunk count.
- `NOTE_UPDATE` with unchanged content → no new rows, no deletions.
- `NOTE_UPDATE` with one paragraph changed → only affected chunk re-embedded; `content_hash` updated.
- `NOTE_DELETE` → all rows for that source removed.
- `POST /ai-embeddings/backfill` → expected row count after run.
- `POST /ai-embeddings/backfill` is idempotent (run twice → no duplicates due to unique constraint).
- `search` returns rows ordered by similarity descending, all above threshold.
- Embedding model unconfigured: `NOTE_CREATE` → no rows written, no error thrown; `search` throws `AI_EMBEDDING_MODEL_NOT_CONFIGURED`.

### 11.3 Mocks

- `test/mock/processors/ai-embedding.mock.ts` — deterministic embedding model returning `vector = sha-derived float[8]` (small dim for fast tests). Used across all consumer tests.

## 12. Migration

```
00XX_ai_vector_extension.sql      -- CREATE EXTENSION (this spec, prereq to all others)
00XX_ai_corpus_embeddings.sql     -- table (this spec)
```

Plus Drizzle column helper added in `packages/db-schema/src/schema/columns.ts` (no migration; package change only).

Data:

```
src/database/app-migrations/2026XXXX-ai-corpus-initial-backfill.ts
```

Uses the existing app-migration ledger; runs once after deploy. Skips gracefully when embedding model unconfigured (admin can re-run via the backfill endpoint later).

## 13. MVP / v2 boundary

**MVP:**
- Extension + table + Drizzle helper
- Sync listeners for `post`, `note`, `page`
- `EMBED_SYNC` task with hash-diff idempotency
- Backfill (admin endpoint + initial app-migration)
- Retrieval API
- Stats endpoint
- Config additions

**v2:**
- Sync listener for `recently` with `embedRecentlyMinChars` threshold
- `POST /ai-embeddings/reindex` — change embedding model gracefully (writes new rows under new model, validates, then drops old model rows)
- ANN index migration (HNSW or IVFFLAT) when row count crosses threshold
- Embedding cost telemetry per task

## 14. Acceptance criteria

- New note → embeddings appear within seconds; chunk count matches expected.
- Repeated sync on unchanged note → no row changes.
- Note delete → all rows removed.
- Retrieval over a fixture corpus returns expected ordering and filters by similarity threshold.
- Stats endpoint reflects row counts by model and source type.
- Config switch of embedding model → new sync writes go under new model; old rows remain queryable until cleanup (no immediate breakage).
