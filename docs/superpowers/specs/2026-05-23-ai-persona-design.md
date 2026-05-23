# ai-persona — Design

- **Date:** 2026-05-23
- **Status:** Design — pending review
- **Author:** Innei (brainstormed with assistant)
- **Parent:** [AI Echo System Root](./2026-05-23-ai-echo-system-root.md)
- **Sibling specs:** [ai-echo engine](./2026-05-23-ai-echo-engine-design.md), [ai-embeddings](./2026-05-23-ai-embeddings-design.md), [ai-memory](./2026-05-23-ai-memory-design.md)

## 1. Scope

Persona definitions consumed by `ai-echo` prompts:

- New module: `apps/core/src/modules/ai/ai-persona/`
- New table: `persona_profiles`
- Code-level `PersonaRegistry` (no admin CRUD; personas are added via code at MVP)
- Two personas shipped at MVP: `inner-self` (dynamic) and `passerby` (static)
- Persona profile distillation (single-pass LLM call in MVP; map-reduce deferred to v2)
- Exemplar selection (length window + recency-weighted random in MVP; vector-by-query selection deferred to v2)
- New task: `PERSONA_DISTILL`
- New endpoints: list personas, get profile, manual refresh

Cross-cutting decisions (IDs, model config, distance vs similarity) are defined in the root spec.

## 2. Module layout

```
apps/core/src/modules/ai/ai-persona/
├── ai-persona.module.ts
├── ai-persona.controller.ts          # admin endpoints
├── ai-persona.service.ts             # getProfile, refresh, pickExemplars
├── ai-persona.repository.ts
├── ai-persona.schema.ts              # Zod DTOs
├── ai-persona.types.ts               # PersonaKey, PersonaDefinition, PersonaProfile, ExemplarPassage
├── ai-persona.constants.ts
├── ai-persona.errors.ts
├── persona-registry.ts               # code-level const map
├── prompts.ts                        # static prompt templates
├── exemplar-selector.ts              # MVP: length + recency; v2: vector
└── tasks/
    └── persona-distill.processor.ts
```

## 3. Persona registry

```ts
// ai-persona.types.ts
export type PersonaKey = 'inner-self' | 'passerby'  // open union extended by future personas

export interface PersonaDefinition {
  key: PersonaKey
  displayName: string
  description: string
  needsProfile: boolean       // inner-self: true; passerby: false
  needsRetrieval: boolean     // inner-self: true; passerby: false
  usesExemplars: boolean      // inner-self: true; passerby: false
  staticPrompt: string        // base system instruction (always present)
}

// persona-registry.ts
export const PERSONA_REGISTRY: Record<PersonaKey, PersonaDefinition> = {
  'inner-self': {
    key: 'inner-self',
    displayName: 'Inner Self (另我)',
    description: 'The author\'s alternate voice — distilled from their own writing.',
    needsProfile: true,
    needsRetrieval: true,
    usesExemplars: true,
    staticPrompt: AI_PERSONA_PROMPTS.innerSelf,   // from prompts.ts
  },
  passerby: {
    key: 'passerby',
    displayName: 'Passerby (路人)',
    description: 'A visiting stranger; brief, fresh-eyed reactions.',
    needsProfile: false,
    needsRetrieval: false,
    usesExemplars: false,
    staticPrompt: AI_PERSONA_PROMPTS.passerby,
  },
}
```

Adding a future persona is a code edit only (new key + entry); no schema migration, no admin UI.

## 4. Data model

```sql
-- migration 00XX_ai_persona_profiles.sql
CREATE TABLE persona_profiles (
  id              text PRIMARY KEY,                  -- snowflake string (pkText)
  persona_key     text NOT NULL UNIQUE,              -- 'inner-self'; passerby never appears here
  profile         text NOT NULL,                     -- full distilled voice description (≤ 2k tokens)
  profile_summary text,                              -- shorter version for prompt embedding (≤ 300 tokens)
  corpus_version  integer NOT NULL,                  -- corpus_embeddings row count snapshot at distill time
  distill_model   text NOT NULL,                     -- resolved model id at distill time
  refreshed_at    timestamptz NOT NULL,
  auto_next_at    timestamptz,                       -- v2: schedule next auto refresh; nullable in MVP
  metadata        jsonb NOT NULL DEFAULT '{}',       -- tone tags, recurring themes, signal words
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

Only personas with `needsProfile=true` get a row. Drizzle definition in `packages/db-schema/src/schema/ai.ts`.

## 5. Distillation pipeline

### 5.1 MVP: single-pass distill

```
PersonaDistillTaskProcessor.handle({ personaKey }):
  if personaKey !== 'inner-self': fail('AI_PERSONA_NOT_DISTILLABLE')

  lock = redis.setNX(`persona:distill:${personaKey}`, '1', EX=600)
  if !lock: skip (concurrent run; another worker picked it up)

  try:
    1. corpus = await sampleCorpus({
         sourceTypes: ['post','note','page'],         // recently excluded in MVP (see ai-embeddings v2)
         maxTokens: configs.aiPersona.distillSampleMaxTokens,   // default 60_000
         recencyWeighted: true,
         perTypeQuota: { post: 0.5, note: 0.3, page: 0.2 },
       })
    2. runtime = await aiService.getPersonaDistillModel()
    3. messages = buildDistillPrompt(corpus)   // single call; see §5.3
    4. result = await runtime.chat(messages)
    5. { profile, profileSummary, metadata } = parseDistillOutput(result)
    6. UPSERT persona_profiles WHERE persona_key='inner-self' SET:
         profile, profile_summary=profileSummary, corpus_version=count(corpus_embeddings),
         distill_model=runtime.modelId, refreshed_at=now(), metadata
    7. emit PERSONA_PROFILE_REFRESHED
  finally:
    redis.del(`persona:distill:${personaKey}`)
```

The MVP single-pass approach passes the entire sampled corpus (capped at ~60k tokens) directly to one LLM call. This trades naively higher per-call cost for radical simplicity; v2 replaces with a map-reduce path for larger corpora and reduced token cost.

### 5.2 Sampling

`sampleCorpus`:

1. List all source IDs of the requested types.
2. Weight each by recency (exponential decay; half-life ~ 365 days).
3. Probabilistic sample without replacement until cumulative token estimate ≥ `maxTokens` × 1.1 (slight overshoot then trim).
4. Maintain per-type ratios via stratified sampling.
5. Return as a structured list of `{ sourceType, sourceId, title?, createdAt, body }`.

### 5.3 Distill prompt (single-pass)

```
SYSTEM:
  You are profiling a single author from their own writing.
  Read the passages below and produce a JSON object with three fields:

  - "profile": a description (200–600 words) covering the author's voice,
    cadence, vocabulary, recurring themes, value tendencies, signature
    phrases. Write in second person ("the author tends to…"). Be specific
    and citable, not generic.

  - "profile_summary": a 60–120 word condensation suitable for embedding
    into another prompt.

  - "metadata": {
      "tone_tags": [string],      // e.g. ["wry", "self-deprecating", "quiet-confident"]
      "recurring_themes": [string],
      "signature_phrases": [string]  // verbatim or near-verbatim phrasings the author returns to
    }

  Reply with raw JSON, no markdown fences.

USER:
  Passages (oldest first):

  [post:abc — 2025-03-14] {body}
  [note:def — 2025-04-02] {body}
  ...
```

`parseDistillOutput` accepts the JSON, validates with Zod, and falls back to a textual profile (no `profile_summary`, empty metadata) if parsing fails. The fallback is logged but does not fail the task — operator can refresh manually.

### 5.4 Refresh triggers

**MVP**: admin endpoint only.

**v2 (deferred)**:

- Cron: `configs.aiPersona.autoRefreshCron` (default `'0 4 * * 1'`).
- Threshold: a Redis counter increments on `POST_CREATE` / `NOTE_CREATE` / `PAGE_CREATE`; when counter ≥ `configs.aiPersona.autoRefreshThreshold` (default 30), enqueue refresh and reset counter.

Both v2 triggers reuse the same task processor; only the trigger logic is new.

## 6. Exemplar selection

`pickExemplars(personaKey, opts)` is called by the ai-echo task processor for personas with `usesExemplars=true`.

### 6.1 MVP: length window + recency-weighted random

```ts
async pickExemplars(personaKey: 'inner-self', opts: { count: number, query?: string }): Promise<ExemplarPassage[]> {
  // Read raw passages directly from source tables (notes/pages) — NOT from corpus_embeddings.
  // Rationale: chunk boundaries optimize for retrieval, not style. We want intact paragraphs.
  const candidates = await loadCandidates({
    sourceTypes: ['note', 'page'],
    paragraphLengthRange: [200, 800],          // characters
    maxCandidates: 200,                         // recency-weighted sample
  })
  return weightedRandomPick(candidates, opts.count)
}
```

`loadCandidates` runs a small SQL query that joins notes/pages, splits each by paragraph boundaries (a pure function), and keeps paragraphs whose length is in the configured window. Result is cached in Redis for 1h (key: `persona:exemplars:candidates:${personaKey}`).

### 6.2 v2: vector-by-query selection

Defer to v2: when `opts.query` is provided, compute its embedding and pick paragraphs whose chunk-level embedding is in the upper similarity quartile of `query`. This requires either (a) embedding paragraphs separately from corpus_embeddings (preserving chunk boundaries) or (b) accepting the corpus chunk boundaries as exemplars (lossy but cheap). Choice deferred.

### 6.3 Output shape

```ts
interface ExemplarPassage {
  sourceType: 'note' | 'page'
  sourceId: string
  content: string                // paragraph text, no markdown fences
  createdAt: Date
}
```

## 7. API surface

| Method | Path | Auth | Body / Query | Returns |
| --- | --- | --- | --- | --- |
| GET | `/ai-persona` | @Auth | — | List of `PersonaDefinition[]` from registry (with `hasProfile: boolean` derived from db). |
| GET | `/ai-persona/:key/profile` | @Auth | — | `PersonaProfile` row or 404. Returns 404 for personas with `needsProfile=false`. |
| POST | `/ai-persona/:key/refresh` | @Auth | — | `{ taskId }`. 409 (`AI_PERSONA_REFRESH_IN_PROGRESS`) when Redis lock held. |

The v2 endpoint `/ai-persona/:key/refresh/status/:taskId` is deferred; admin UI can poll `ai-task` queue's existing status endpoint.

## 8. Errors

| Code | HTTP | Notes |
| --- | --- | --- |
| `AI_PERSONA_NOT_FOUND` | 404 | Unknown `personaKey` in registry. |
| `AI_PERSONA_PROFILE_NOT_FOUND` | 404 | Persona has `needsProfile=false`, or no row yet. |
| `AI_PERSONA_NOT_DISTILLABLE` | 400 | Distill called for a persona with `needsProfile=false`. |
| `AI_PERSONA_REFRESH_IN_PROGRESS` | 409 | Redis lock held. |
| `AI_PERSONA_DISTILL_MODEL_NOT_CONFIGURED` | 400 | Neither `personaDistillModel` nor `echoModel` configured. |

## 9. Configuration

Additions in `configs.schema.ts → AISchema`:

```ts
personaDistillModel: field.plain(AIModelAssignmentSchema.optional(), 'Persona distill model',
  { description: 'Falls back to echoModel when empty' }),
aiPersona: field.plain(z.object({
  distillSampleMaxTokens: z.number().int().min(1000).default(60_000),
  exemplarsLengthMin: z.number().int().min(40).default(200),
  exemplarsLengthMax: z.number().int().min(80).default(800),
  exemplarsCandidateCacheTtlSec: z.number().int().min(60).default(3600),
  // v2 fields, accepted but ignored in MVP:
  autoRefreshCron: z.string().default('0 4 * * 1'),
  autoRefreshThreshold: z.number().int().min(1).default(30),
}).optional(), 'Persona parameters'),
```

`AIFeatureKey.PersonaDistill` added. `AiService.getPersonaDistillModel()` resolves it with fallback to `AIFeatureKey.Echo` when unset.

## 10. Testing

### 10.1 Unit

- `persona-registry`: returns expected entries; unknown key throws `AI_PERSONA_NOT_FOUND`.
- `parseDistillOutput`: valid JSON → struct; malformed JSON → fallback profile with text-only content; empty input → throws.
- `exemplar-selector` (MVP): deterministic given seeded random; respects length window; honors `count`.

### 10.2 Integration (pg + redis containers)

- `POST /ai-persona/inner-self/refresh` → row appears in `persona_profiles`; `PERSONA_PROFILE_REFRESHED` event emitted.
- Two concurrent refresh requests → second returns 409.
- `GET /ai-persona` lists registry; `hasProfile` true for `inner-self` after refresh.
- `GET /ai-persona/passerby/profile` returns 404 (`AI_PERSONA_PROFILE_NOT_FOUND`).
- Distill model unconfigured → refresh returns 400 (`AI_PERSONA_DISTILL_MODEL_NOT_CONFIGURED`).
- `pickExemplars` with a fixture corpus returns the expected count of paragraph passages in the length window.

### 10.3 Mocks

- Reuse `test/mock/processors/ai-runtime.mock.ts` (declared in ai-echo engine spec). For persona distillation tests, the mock returns a fixed JSON profile.

## 11. Migration

```
00XX_ai_persona_profiles.sql      -- this spec
```

Additive; no changes to existing tables. Drizzle definition in `packages/db-schema/src/schema/ai.ts`.

## 12. MVP / v2 boundary

**MVP:**
- Module + table + registry (`inner-self`, `passerby`)
- Single-pass distill with parsed JSON profile
- Manual refresh endpoint
- Exemplar selection by length window + recency (no vector-by-query)
- Static `passerby` prompt
- Config additions for distill sample size and exemplar window

**v2:**
- Map-reduce distill for larger corpora and reduced token cost
- Auto-refresh: cron + threshold counter
- Vector-by-query exemplar selection
- Optional `persona_exemplars` curated table if auto selection proves insufficient
- Per-persona prompt overrides editable in admin (turning the code-level registry into a hybrid)

## 13. Acceptance criteria

- `inner-self` profile is created on first refresh; profile content reflects sampled corpus content.
- Refresh emits `PERSONA_PROFILE_REFRESHED`; subsequent runs upsert the same row.
- Concurrent refresh requests return 409.
- `passerby` has no profile row and is never distilled.
- `pickExemplars` returns paragraphs (not chunks) from notes/pages within the length window.
- ai-echo task processor consumes the profile via `getProfile('inner-self')` and the exemplars via `pickExemplars('inner-self', ...)`.
