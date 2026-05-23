# AI Echo System — Root

- **Date:** 2026-05-23
- **Status:** Design — pending review
- **Author:** Innei (brainstormed with assistant)
- **Scope:** `apps/core/` server. Admin UI (admin-vue3) and Yohaku frontend are downstream and tracked separately.

This is the root spec for an AI-driven response system anchored on the `recently` (wishing-well / 树洞) module. It coordinates four sibling sub-specs and records cross-cutting decisions that apply to all of them.

---

## 1. Vision

The site owner publishes short markdown thoughts via `recently`. The owner's framing: *if it's a wishing well, it should have echoes.* The system gives each new thought a small set of AI-written replies, voiced by configurable **personas**:

- **inner-self** (另我) — dynamic voice distilled from the owner's own writing (notes + pages + selected past recently).
- **passerby** (路人) — a fixed prompt; no distillation, no retrieval.

Echoes are public; visitors see them under each thought. The system is intentionally generic so that future scenarios (comment auto-reply, reader companion) plug into the same engine without rewriting it.

## 2. Module map

```
apps/core/src/modules/ai/
├── ai/              (existing — provider/runtime/feature resolution)
├── ai-task/         (existing — async task queue)
├── ai-inflight/     (existing — streaming substrate, not used in MVP echoes)
├── ai-embeddings/   (NEW — see ai-embeddings spec)
├── ai-persona/      (NEW — see ai-persona spec)
├── ai-memory/       (NEW — see ai-memory spec)
└── ai-echo/         (NEW — see ai-echo engine spec)
```

Dependency direction:

```
ai-echo ──► ai-persona ──► ai-embeddings ──► ai
   │            │
   ├──► ai-memory ──► ai-embeddings
   │
   └──► ai-task, gateway, event-manager, configs
```

## 3. Sub-specs

| Spec | Owns | Status |
| --- | --- | --- |
| [ai-echo engine](./2026-05-23-ai-echo-engine-design.md) | `ai-echo` module, `ai_echoes` table, `EchoScenario` abstraction, recently scenario | Design |
| [ai-embeddings](./2026-05-23-ai-embeddings-design.md) | `ai-embeddings` module, `corpus_embeddings` table, pgvector custom type, chunking, retrieval | Design |
| [ai-persona](./2026-05-23-ai-persona-design.md) | `ai-persona` module, `persona_profiles` table, `PersonaRegistry`, distillation | Design |
| [ai-memory](./2026-05-23-ai-memory-design.md) | `ai-memory` module, `ai_memories` table, recall pipeline | Design |

## 4. Cross-cutting decisions

These bind every sub-spec; do not redecide them locally.

### 4.1 Storage / IDs

All new tables use **text PK/FK** via the existing `pkText()` / `refText()` helpers in `packages/db-schema/src/schema/columns.ts`. IDs are snowflake values serialized as text — same as `recentlies.id`. No `bigserial` or `bigint` for IDs in new tables.

### 4.2 pgvector substrate

Retrieval is built on pgvector, not on Postgres `tsvector`. Rationale: at personal-blog Chinese corpus scale, full-text search produces enough silent misses to make the "voice that remembers" persona feel incoherent.

Operational constraints (the **"A-lite"** profile):

- Async embed writes; missing embeddings are normal and do not block reads.
- Hybrid retrieval gate: top-k followed by a minimum similarity threshold. If empty after the gate, the echo prompt is built without a retrieval section and the prompt explicitly forbids "I remember" claims.
- No ANN index in MVP (rows ≤ ~10k → exact scan suffices). A future migration adds HNSW or IVFFLAT.
- The `vector` column stores no fixed dimension at the type level; each row records its own `embedding_model` and `dim` so multiple models can coexist during gradual rebuilds.

### 4.3 Distance vs similarity

pgvector operators return **distance** (`<=>` is cosine distance). All sub-specs and config keys use **similarity** in user-facing names, defined as `similarity = 1 - cosine_distance`. Helper functions in `ai-embeddings` compute and expose similarity scores; threshold config keys are named `minSimilarity`, never `minScore` or `maxDistance` (the latter only appears in SQL fragments where it is the actual operator output).

### 4.4 AI model configuration

Model selection follows the existing `AIFeatureKey` + `AIModelAssignment` pattern (see `apps/core/src/modules/configs/configs.schema.ts` and `apps/core/src/modules/ai/ai.types.ts`).

Add to `AIFeatureKey`:

- `Echo` — echo generation
- `Embedding` — embedding model
- `PersonaDistill` — persona profile distillation (optional; falls back to `Echo` when unset)

Add to `AISchema` as `field.plain(AIModelAssignmentSchema.optional(), ...)`:

- `echoModel`
- `embeddingModel`
- `personaDistillModel`

Add toggles consistent with existing `enableSummary` / `enableInsights` style:

- `enableEcho` (master switch)
- `enableAutoGenerateEchoOnCreate` (auto-generate on `recently` create)

Do **not** introduce parallel `xxxProvider` keys; provider is resolved via `AIModelAssignment.providerId`.

The OpenAI-compatible runtime's model listing (see `runtime/openai-compatible.runtime.ts`) is split into `listChatModels()` (existing behavior) and `listEmbeddingModels()` (reverses the filter). Admin UI calls the appropriate variant per slot.

### 4.5 Scenario registration

The `ai-echo` engine is generic and does not hard-code `recently`. Scenarios register via **Nest multi-provider injection**: an `ECHO_SCENARIO` injection token marked `provide` with `multi: true`. Each scenario module declares one provider; the engine constructor receives `EchoScenario[]`. No global registry, no module-init side effects, no race between two ways of subscribing.

The `recently` module ships one provider (`recentlyEchoScenarioProvider`); the engine consumes it without knowing about `recently` specifically. Future scenarios (comment-reply, reader-companion) ship the same way.

### 4.6 Task lifecycle and idempotency

`ai_echoes` rows persist `metadata.taskId` once a task is enqueued. The task processor reloads the row before doing work and **only proceeds when status is `pending` or `generating`**. Rows in `ready`, `edited`, `failed`, or `archived` are skipped and the task completes as a no-op. This prevents:

- Zombie tasks re-running after `regenerate force=true` archived the original row
- Replay of stale tasks after queue recovery / restart
- Two writers racing on the same `(scenarioKey, subjectType, subjectId, personaKey)` tuple

Subject-delete handlers mark in-flight echoes `failed` with `metadata.aborted=true` and suppress the ready broadcast.

### 4.7 Failure principles

- Public read endpoints never crash on missing AI rows. Empty data is normal.
- `recently` create is never blocked by AI work. If echo generation fails for every persona, the recently entry still publishes.
- Transient upstream failures retry via `ai-task` backoff (max 3). Structural errors (subject missing, model unconfigured, scenario unknown) terminate immediately and persist `metadata.errorCode`.
- Operator triage runs through the admin echo list (`GET /ai-echo?status=failed`).

### 4.8 Visibility

Echoes are **public** under each `recently` entry. Visitors see them via `GET /ai-echo/by-subject/recently/:id`. Hidden states (`pending`, `generating`, `failed`, `archived`) are filtered out of public reads; `ready` and `edited` are shown.

## 5. Phasing

Each sub-spec marks its own MVP scope and v2 roadmap. The system-level cuts:

**MVP (this sprint):**
- ai-echo: engine + `ai_echoes` + recently scenario + public list + admin regenerate/edit/delete/list. No rating endpoint.
- ai-embeddings: corpus for `page` and `note` only; sync events; retrieval; admin backfill + stats. No reindex endpoint, no recently embedding.
- ai-persona: single-pass LLM distill (no map/reduce), manual refresh only. Exemplar selection by length window + recency-weighted random (no vector-by-query selection).
- ai-memory: CRUD + recall + total count. No `/from-passage` LLM draft, no KPI nudge widget, no STM.

**v2 (next slice):**
- ai-echo: rating endpoint, comment-reply scenario, reader-companion scenario.
- ai-embeddings: recently embedding (eligibility threshold), reindex endpoint, HNSW/IVFFLAT index migration.
- ai-persona: map/reduce distill, auto-refresh cron + threshold, vector-based exemplar selection, optional `persona_exemplars` table.
- ai-memory: `/from-passage` LLM draft, extract task with forced review workflow, decay task, supersede detection, KPI nudge widget, STM as cached rolling summary.

The MVP slice is self-coherent: the operator can configure providers/models, run backfill, refresh persona once, seed a few memories, and start receiving echoes on new recently posts. Every v2 item slots into an existing table or interface; no v2 work invalidates an MVP migration.

## 6. Migration order

All migrations are additive (expand-only); rolling deploys tolerate them.

1. `00XX_ai_vector_extension.sql` — `CREATE EXTENSION IF NOT EXISTS vector;`
2. `00XX_ai_corpus_embeddings.sql` (ai-embeddings spec)
3. `00XX_ai_persona_profiles.sql` (ai-persona spec)
4. `00XX_ai_memories.sql` (ai-memory spec)
5. `00XX_ai_echoes.sql` (ai-echo engine spec)

Drizzle pgvector helper (`vector` custom type) is added in `packages/db-schema/src/schema/columns.ts` as part of the ai-embeddings work; sub-spec owns the implementation details.

Data backfill (`corpus_embeddings` for existing notes/pages) runs as an app-migration entry (`src/database/app-migrations/`) using the existing ledger pattern — see ai-embeddings spec.

## 7. System-level acceptance criteria

After deploying all four sub-specs and configuring providers/models:

- A new `recently` entry produces two `ai_echoes` rows (one per default persona) within seconds, both reaching `status='ready'` with non-empty content under normal AI conditions.
- WebSocket subscribers receive a `RECENTLY_ECHO_LANDED` event per echo.
- Public `GET /ai-echo/by-subject/recently/:id` returns only `ready` and `edited` echoes.
- Admin can edit, delete, and regenerate any echo. Regenerate with `force=true` archives the old row and produces a fresh one.
- Persona refresh produces a populated `persona_profiles` row for `inner-self`. Concurrent refresh requests return 409.
- Embedding sync produces correct `corpus_embeddings` rows for new notes/pages; re-syncing an unchanged source is a no-op (content-hash dedupe).
- Memory CRUD works; recall integrates into echo prompts and is reflected in `ai_echoes.metadata.memoryIds`.
- With embedding model unconfigured, sync and retrieval no-op gracefully; echoes still generate (without a retrieval section).
- All existing `recently` and AI tests pass unchanged.

## 8. Cross-spec open questions

- **`AI_ECHO_DAILY_QUOTA_EXCEEDED` granularity**: global vs per-scenario. MVP: global. If reader-companion v2 has much higher volume, split.
- **Public visibility of `failed` echoes**: MVP hides. Confirm — alternative is a subtle placeholder ("the well is quiet today").
- **STM cadence**: MVP defers entirely. If echoes start repeating phrasing within a week of usage, ship the cached rolling summary from v2 early.
- **Recently embed eligibility threshold**: MVP does not embed recently at all. v2 calibrates the threshold from observed usage.

---

*Cross-references each sub-spec; sub-specs do not duplicate cross-cutting decisions, they cite this root.*
