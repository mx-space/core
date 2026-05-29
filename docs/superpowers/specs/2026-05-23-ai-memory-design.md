# ai-memory — Design

- **Date:** 2026-05-23
- **Status:** Design — pending review
- **Author:** Innei (brainstormed with assistant)
- **Parent:** [AI Echo System Root](./2026-05-23-ai-echo-system-root.md)
- **Sibling specs:** [ai-echo engine](./2026-05-23-ai-echo-engine-design.md), [ai-embeddings](./2026-05-23-ai-embeddings-design.md), [ai-persona](./2026-05-23-ai-persona-design.md)

## 1. Scope

A **human-authored canonical-facts layer** that the ai-echo prompt can recall from. The metaphor and rationale: structured "this is who I am / what I think" facts that raw-passage retrieval cannot crystallize on its own (e.g., "I dislike morning meetings", "I value brevity"). Echo personas use them as ambient constraints, not as evidence to quote.

MVP is intentionally minimal: CRUD + recall. Autonomous extraction, decay, supersession are explicitly v2 — small-corpus scale doesn't justify the variance of LLM-driven memory pipelines without a forced operator review workflow.

- New module: `apps/core/src/modules/ai/ai-memory/`
- New table: `ai_memories`
- New endpoints: CRUD, list, total count
- Recall consumed by `ai-echo`

Cross-cutting decisions (IDs, model config, similarity semantics) are defined in the root spec.

## 2. Module layout

```
apps/core/src/modules/ai/ai-memory/
├── ai-memory.module.ts
├── ai-memory.controller.ts
├── ai-memory.service.ts             # CRUD + recall + embed-on-write
├── ai-memory.repository.ts
├── ai-memory.schema.ts              # Zod DTOs (CreateMemoryDto, UpdateMemoryDto)
├── ai-memory.types.ts
├── ai-memory.constants.ts
├── ai-memory.errors.ts
└── tasks/
    └── memory-embed.processor.ts    # async embedding for new/updated memory content
```

## 3. Data model

```sql
-- migration 00XX_ai_memories.sql
CREATE TABLE ai_memories (
  id              text PRIMARY KEY,                   -- snowflake string (pkText)
  scope           text NOT NULL,                      -- 'global' | 'persona:<key>' | 'scenario:<key>'
  type            text NOT NULL,                      -- 'fact' | 'event' | 'preference' | 'thread' | 'pattern'
  content         text NOT NULL,
  confidence      real NOT NULL DEFAULT 1.0,
  salience        real NOT NULL DEFAULT 1.0,
  source          jsonb NOT NULL DEFAULT '{}',        -- {kind:'manual', authorId} | {kind:'extraction', from:'recently:<id>'} (v2)
  embedding       vector,                             -- nullable; embedded async after write
  embedding_model text,
  dim             integer,
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,                        -- nullable; respected by recall
  supersedes_id   text REFERENCES ai_memories(id),    -- v2: extraction can chain supersessions
  status          text NOT NULL DEFAULT 'active',     -- 'active' | 'superseded' | 'archived' | 'pending_review' (v2)
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_memories_scope_status ON ai_memories (scope, status);
CREATE INDEX ai_memories_status_active ON ai_memories (status) WHERE status = 'active';
```

All v2 fields (`confidence`, `salience`, `last_seen_at`, `supersedes_id`, `expires_at`, `pending_review` status value) are present from MVP but **inert** — MVP code does not change them automatically. This avoids a future migration when v2 lights up.

`embedding` is nullable: a memory is queryable as soon as it's written; once the async embed lands, it becomes vector-recallable. Without an embedding, the row is excluded from query-based recall but remains visible to scope-only listing.

Drizzle definition in `packages/db-schema/src/schema/ai.ts`.

## 4. Service API

```ts
class AiMemoryService {
  // CRUD
  list(opts: { scope?: string|string[], type?: string, status?: string, page?: number, size?: number }): Promise<Paginated<AiMemory>>
  findById(id: string): Promise<AiMemory | null>
  create(input: CreateMemoryDto, actorId: string): Promise<AiMemory>      // enqueues embed task
  update(id: string, input: UpdateMemoryDto, actorId: string): Promise<AiMemory>  // re-enqueues embed if content changed
  archive(id: string): Promise<void>                                       // status='archived'

  // Recall (consumed by ai-echo)
  recall(opts: {
    scope: string | string[]
    query?: string                  // when present, vector-rank; when absent, salience-only
    topK?: number                   // default 5
    minSimilarity?: number          // default 0.7
  }): Promise<AiMemory[]>

  // KPI
  totalActive(): Promise<number>
}
```

### 4.1 `create` / `update` embed flow

```
create(input, actorId):
  1. row = INSERT ai_memories with source.kind='manual', source.authorId=actorId
  2. enqueue MEMORY_EMBED { memoryId }
  3. return row (embedding=null at this moment)

MemoryEmbedTaskProcessor.handle({ memoryId }):
  1. row = repo.findById(memoryId)
  2. if !row OR row.status NOT IN ('active', 'pending_review'): return
  3. if !aiEmbeddingModelConfigured: return                // graceful no-op
  4. runtime = await aiService.getEmbeddingModel()
  5. vec = await runtime.embedBatch([row.content]).then(v => v[0])
  6. UPDATE ai_memories SET embedding=vec, embedding_model=runtime.modelId, dim=vec.length WHERE id=$memoryId
```

`update` re-embeds only when `content` changes (other field updates skip the task).

### 4.2 `recall`

```
recall({ scope, query, topK=5, minSimilarity=0.7 }):
  scopeList = Array.isArray(scope) ? scope : [scope]

  if !query:
    // Salience-only ranking
    SELECT * FROM ai_memories
     WHERE status='active' AND scope = ANY($scopeList)
       AND (expires_at IS NULL OR expires_at > now())
     ORDER BY salience DESC, last_seen_at DESC
     LIMIT $topK;
    return.

  // Query-based: vector search with embedding model
  if !embeddingModelConfigured: return []

  q = await runtime.embed(query)
  rows = SELECT *,
                (embedding <=> $q) AS distance
         FROM ai_memories
         WHERE status='active' AND scope = ANY($scopeList)
           AND embedding IS NOT NULL
           AND embedding_model = $modelId
           AND (expires_at IS NULL OR expires_at > now())
         ORDER BY embedding <=> $q
         LIMIT $topK * 2;        // overfetch, filter, re-rank

  // Compute similarity, filter by threshold, re-rank by similarity × salience × confidence
  return rows
    .map(r => ({ ...r, similarity: 1 - r.distance }))
    .filter(r => r.similarity >= minSimilarity)
    .map(r => ({ ...r, score: r.similarity * r.salience * r.confidence }))
    .sort((a,b) => b.score - a.score)
    .slice(0, topK)
```

The ai-echo task processor passes both 'global' and `persona:<key>` scopes. The returned memories appear in the echo prompt under the "Canonical facts" section (see ai-echo engine spec §6).

## 5. API surface

| Method | Path | Auth | Body / Query | Returns |
| --- | --- | --- | --- | --- |
| GET | `/ai-memory` | @Auth | `?scope=&type=&status=&page=&size=` | Paginated `AiMemoryViews.detail[]` with `MetaObjectBuilder` pagination |
| GET | `/ai-memory/:id` | @Auth | — | `AiMemoryViews.detail` |
| POST | `/ai-memory` | @Auth | `CreateMemoryDto` | created row |
| PUT | `/ai-memory/:id` | @Auth | `UpdateMemoryDto` | updated row |
| DELETE | `/ai-memory/:id` | @Auth | — | 204; soft delete (`status='archived'`) |
| GET | `/ai-memory/kpi` | @Auth | — | `{ total, active, archived }` |

`/ai-memory/from-passage` (LLM-drafted memory from a highlighted passage) and KPI nudge fields (`referencedThisWeek`, `seedRecommended`) are v2.

### 5.1 DTOs

```ts
const CreateMemoryDto = z.object({
  scope: z.string().regex(/^(global|persona:[a-z0-9-]+|scenario:[a-z0-9-]+)$/),
  type: z.enum(['fact','event','preference','thread','pattern']),
  content: z.string().min(1).max(2000),
  confidence: z.number().min(0).max(1).optional().default(1.0),
  salience: z.number().min(0).max(10).optional().default(1.0),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const UpdateMemoryDto = CreateMemoryDto.partial()
```

### 5.2 Views

```ts
// ai-memory.views.ts
export const AiMemoryViews = {
  detail: ZodObject<{
    id, scope, type, content, confidence, salience, source, status,
    firstSeenAt, lastSeenAt, expiresAt, metadata, createdAt, updatedAt,
    hasEmbedding: boolean,   // derived; never expose vector to admin UI
  }>,
}
```

## 6. Errors

| Code | HTTP | Notes |
| --- | --- | --- |
| `AI_MEMORY_NOT_FOUND` | 404 | |
| `AI_MEMORY_INVALID_SCOPE` | 400 | Rejected by Zod regex; surfaced via VALIDATION_FAILED if Zod catches first. |
| `AI_MEMORY_INVALID_TYPE` | 400 | Same as above. |

Recall itself never throws on missing embedding model — it returns `[]` (graceful no-op).

## 7. Configuration

Additions in `configs.schema.ts → AISchema`:

```ts
aiMemory: field.plain(z.object({
  recallTopK: z.number().int().min(1).default(5),
  recallMinSimilarity: z.number().min(0).max(1).default(0.7),
  // v2-only, accepted but ignored:
  nudgeIfReferencedBelow: z.number().int().min(0).default(1),
}).optional(), 'Memory parameters'),
```

The actual recall thresholds used by ai-echo are read via `configs.aiMemory.*`; ai-echo doesn't introduce parallel memory thresholds.

## 8. Operational guidance (downstream-visible)

The MVP layer is only valuable if memories are actually seeded. The admin UI (downstream PR) should provide:

- A "Seed memories" call-to-action when `GET /ai-memory/kpi { active }` < 10.
- A simple add-memory form with type/scope dropdowns.
- A list view with type/scope filters and a soft-delete action.

The server exposes everything needed; the operational forcing is the admin UX's job. This spec documents the contract; v2 ships the `seedRecommended` and `referencedThisWeek` flags so the nudge widget has data.

## 9. Testing

### 9.1 Unit

- `CreateMemoryDto` regex accepts `global`, `persona:inner-self`, `scenario:recently`; rejects malformed.
- `recall` salience-only path: returns rows ordered by `salience DESC`, filters expired.
- `recall` query path: applies threshold; re-ranks by `similarity × salience × confidence`.

### 9.2 Integration (pg + redis containers)

- `POST /ai-memory` → row created with `embedding=null`; `MEMORY_EMBED` task enqueued.
- After task runs (mock embedding model) → `embedding` populated, `dim` matches.
- `PUT /ai-memory/:id` with content change → re-enqueues embed; row's embedding updated.
- `PUT /ai-memory/:id` without content change → no embed task enqueued.
- `DELETE /ai-memory/:id` → `status='archived'`; subsequent `recall` excludes it.
- `recall` with two memories (active + expired) returns only the active one.
- `recall` with embedding model unconfigured returns `[]` without throwing.
- `recall` with query → expected ordering across fixture memories.

### 9.3 Mocks

- Reuse `test/mock/processors/ai-embedding.mock.ts` (from ai-embeddings spec) for deterministic vectors.

## 10. Migration

```
00XX_ai_memories.sql       -- this spec
```

Additive only. Drizzle definition in `packages/db-schema/src/schema/ai.ts`.

## 11. MVP / v2 boundary

**MVP:**
- Table with all fields (v2 fields present but inert)
- CRUD endpoints
- Recall (salience-only when no query; vector-ranked when query provided)
- Async embed-on-write task
- KPI total/active/archived
- Config additions for recall parameters

**v2:**
- `POST /ai-memory/from-passage` — accepts a passage + ref, runs a small synchronous LLM call to draft `content`; operator reviews before saving.
- `MEMORY_EXTRACT` task — periodically extracts candidate memories from new corpus; writes as `status='pending_review'`.
- Forced review workflow — weekly digest email + blocking dashboard badge when `pending_review` count > 0.
- `MEMORY_DECAY` task — cron lowers `confidence` over time without reinforcement; below `archive_threshold` → archived.
- Auto-supersession — extract phase detects contradiction with existing active memories and proposes `supersedes_id` resolutions.
- KPI nudge fields (`referencedThisWeek`, `seedRecommended`) + admin dashboard widget.

## 12. Acceptance criteria

- Operator can create, list, edit, soft-delete memories via admin endpoints.
- `recall` returns the expected memories given fixture data and a query string.
- Memories without embeddings yet are excluded from query-based recall but included in salience-only listings.
- Recall integrates into echo prompts (verified end-to-end in ai-echo engine integration tests, not duplicated here).
- Embedding model unconfigured does not crash recall; returns `[]`.
- All v2 fields exist in schema and are exposed (read-only) via the detail view so future automation has no migration cost.
