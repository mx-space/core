# ai-echo Engine — Design

- **Date:** 2026-05-23
- **Status:** Design — pending review
- **Author:** Innei (brainstormed with assistant)
- **Parent:** [AI Echo System Root](./2026-05-23-ai-echo-system-root.md)
- **Sibling specs:** [ai-embeddings](./2026-05-23-ai-embeddings-design.md), [ai-persona](./2026-05-23-ai-persona-design.md), [ai-memory](./2026-05-23-ai-memory-design.md)

## 1. Scope

This spec covers the **generic echo engine** and its **first concrete consumer** (the `recently` scenario):

- New module: `apps/core/src/modules/ai/ai-echo/`
- New table: `ai_echoes` (polymorphic across scenarios)
- New abstraction: `EchoScenario` interface + Nest multi-provider registration
- New task: `ECHO_GENERATE`
- One scenario provider shipped in MVP: `recentlyEchoScenarioProvider`, registered from `apps/core/src/modules/recently/scenarios/recently-echo.scenario.ts`
- New endpoints: public read + admin manage

Cross-cutting decisions (IDs, model config, scenario registration pattern, failure principles, visibility) are defined in the root spec; this spec applies them.

## 2. Module layout

```
apps/core/src/modules/ai/ai-echo/
├── ai-echo.module.ts
├── ai-echo.controller.ts             # admin + public endpoints
├── ai-echo.service.ts                # orchestrator: takes (scenarioKey, subjectType, subjectId), enqueues, returns echo rows
├── ai-echo.repository.ts             # extends BaseRepository
├── ai-echo.schema.ts                 # Zod DTOs (RegenerateDto, EditEchoDto, …)
├── ai-echo.types.ts
├── ai-echo.views.ts                  # AiEchoViews.public / .admin
├── ai-echo.constants.ts              # ECHO_SCENARIO token, default config keys
├── ai-echo.errors.ts                 # registers new AppErrorCode entries
├── scenario.types.ts                 # EchoScenario interface + helper types
├── echo-prompt-builder.ts            # uniform prompt assembly given profile / retrieval / memories / exemplars
└── tasks/
    └── echo-generate.processor.ts    # AiTaskType.ECHO_GENERATE processor

apps/core/src/modules/recently/scenarios/
└── recently-echo.scenario.ts         # Nest provider {provide: ECHO_SCENARIO, useValue: ..., multi: true}
```

`recently.module.ts` imports `AiEchoModule` and adds the scenario provider. Nothing in `recently.service.ts` or `recently.controller.ts` changes.

## 3. Data model

### 3.1 `ai_echoes` table

```sql
-- migration 00XX_ai_echoes.sql
CREATE TABLE ai_echoes (
  id            text PRIMARY KEY,                -- snowflake string (pkText)
  scenario_key  text NOT NULL,                   -- 'recently' | future
  subject_type  text NOT NULL,                   -- 'recently' | 'comment' | 'post' | …
  subject_id    text NOT NULL,                   -- snowflake string of the subject
  persona_key   text NOT NULL,                   -- 'inner-self' | 'passerby' | …
  content       text,                            -- null until status='ready'
  status        text NOT NULL,                   -- pending|generating|ready|edited|failed|archived
  model         text,                            -- resolved model id at generation time
  metadata      jsonb NOT NULL DEFAULT '{}',     -- {taskId, retrievalIds[], retrievalSimilarities[], memoryIds[], profileRefreshedAt, errorCode, aborted, …}
  generated_at  timestamptz,
  edited_at     timestamptz,
  edited_by     text,                            -- user id (text)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_echoes_subject
  ON ai_echoes (scenario_key, subject_type, subject_id);

CREATE INDEX ai_echoes_status
  ON ai_echoes (scenario_key, status);

CREATE INDEX ai_echoes_persona_subject
  ON ai_echoes (subject_type, subject_id, persona_key);
```

Drizzle definition added in `packages/db-schema/src/schema/ai.ts`.

### 3.2 Status state machine

```
pending ──► generating ──► ready ──► edited (terminal-but-mutable)
   │            │             │
   ▼            ▼             ▼
 failed      failed       archived  (e.g. force-regenerate, subject deleted)
```

`failed` is terminal; operator action moves it via regenerate (which creates a new row, leaves the failed row archived).

`archived` is terminal; rows are kept for audit, hidden from public reads.

## 4. EchoScenario abstraction

### 4.1 Interface

```ts
// scenario.types.ts
export interface EchoScenario<Subject = unknown> {
  /** Unique key per scenario; used as ai_echoes.scenario_key */
  readonly key: string

  /** Business event that auto-triggers; omit for purely on-demand scenarios */
  readonly triggerEvent?: BusinessEvents

  /** Personas invoked by default on each generation */
  readonly defaultPersonas: PersonaKey[]

  /** Whether generated content should persist to ai_echoes (false for streaming/ephemeral) */
  readonly persistEchoes?: boolean   // default true

  /** Event emitted when an echo row reaches status='ready' */
  readonly emitOnReady?: BusinessEvents

  /** Fetch the subject by id; null when subject no longer exists (echo aborts) */
  loadSubject(subjectId: string): Promise<Subject | null>

  /** Extract the natural-language query used for retrieval and memory recall; null skips both */
  extractRetrievalQuery(subject: Subject): string | null

  /** Build the chat message list from all available context */
  buildPrompt(input: EchoPromptInput<Subject>): ChatMessage[]

  /** Optional post-processing (strip code fences, trim, etc.) */
  postProcess?(content: string, subject: Subject): string
}

export interface EchoPromptInput<Subject> {
  subject: Subject
  persona: PersonaDefinition
  profile: PersonaProfile | null      // null if persona.needsProfile=false or no row yet
  retrieval: RetrievalResult[]        // [] when below similarity threshold or query null
  memories: AiMemory[]                // [] when none above similarity threshold
  exemplars: ExemplarPassage[]        // [] for personas without exemplars
}
```

### 4.2 Registration

```ts
// ai-echo.constants.ts
export const ECHO_SCENARIO = Symbol('ECHO_SCENARIO')

// recently/scenarios/recently-echo.scenario.ts
export const recentlyEchoScenarioProvider: Provider = {
  provide: ECHO_SCENARIO,
  useValue: {
    key: 'recently',
    triggerEvent: BusinessEvents.RECENTLY_CREATE,
    defaultPersonas: ['inner-self', 'passerby'],
    persistEchoes: true,
    emitOnReady: BusinessEvents.RECENTLY_ECHO_LANDED,
    async loadSubject(id) { /* RecentlyService.findById(id) via injected service */ },
    extractRetrievalQuery(recently) { return recently.content ?? null },
    buildPrompt(input) { return buildRecentlyEchoPrompt(input) },
  } satisfies EchoScenario<RecentlyRow>,
  multi: true,
}

// ai-echo.service.ts
constructor(@Inject(ECHO_SCENARIO) private readonly scenarios: EchoScenario[]) {
  this.byKey = new Map(scenarios.map((s) => [s.key, s]))
}
```

The orchestrator subscribes to each `scenario.triggerEvent` via the event manager during `OnModuleInit`. On the event, it calls `dispatch(scenario.key, subjectType, subjectId)`.

Subjects whose deletion should cascade to echoes are handled by per-scenario listeners. The recently scenario also subscribes to `RECENTLY_DELETE` and calls `aiEchoService.handleSubjectDeleted('recently', id)` — which marks in-flight rows `failed/aborted` and `ready` rows `archived`.

### 4.3 Dependency direction

`recently.module` imports `AiEchoModule` and provides `recentlyEchoScenarioProvider`. `ai-echo.module` does **not** import `recently.module` — it only knows about `ECHO_SCENARIO` providers. The recently scenario file's `loadSubject` resolves `RecentlyService` via constructor injection (the provider is `useFactory` or accesses services through a small adapter pattern; see implementation plan).

This direction avoids circular imports and keeps the engine generic.

## 5. Generation pipeline

### 5.1 Orchestrator (synchronous, fast)

```
event RECENTLY_CREATE { recently } received
  └─► AiEchoService.dispatch('recently', 'recently', recently.id)
        1. scenario = scenarios.byKey('recently')
        2. for each persona in scenario.defaultPersonas:
             a. INSERT ai_echoes (status='pending', persona_key, scenario_key, subject_type, subject_id, metadata={})
             b. taskId = aiTaskService.enqueue(ECHO_GENERATE, { echoId })
             c. UPDATE ai_echoes SET metadata = jsonb_set(metadata, '{taskId}', $taskId) WHERE id = $echoId
        3. return
```

The HTTP `recently.create` response is already returned by this point — dispatch runs from an event listener, not the HTTP path.

### 5.2 `ECHO_GENERATE` task processor

```
EchoGenerateTaskProcessor.handle({ echoId }):
  1. row = repo.findById(echoId)
  2. if !row OR row.status NOT IN ('pending', 'generating'): return  // no-op (idempotent replay guard)
  3. UPDATE status='generating', updated_at=now()
  4. scenario = scenariosByKey.get(row.scenario_key)
     if !scenario: fail('AI_ECHO_SCENARIO_NOT_REGISTERED'); return
  5. subject = await scenario.loadSubject(row.subject_id)
     if !subject: fail('AI_ECHO_SUBJECT_NOT_FOUND', terminal=true); return
  6. persona = personaRegistry.get(row.persona_key)
     if !persona: fail('AI_PERSONA_NOT_FOUND', terminal=true); return
  7. profile = persona.needsProfile ? aiPersonaService.getProfile(persona.key) : null
  8. query = scenario.extractRetrievalQuery(subject)
  9. retrieval = (persona.needsRetrieval && query)
       ? await aiEmbeddingsService.search(query, { topK, minSimilarity, sourceTypes: ['note','page'] })
       : []
 10. memories = await aiMemoryService.recall({ scope: ['global', `persona:${persona.key}`], query, topK, minSimilarity })
 11. exemplars = persona.usesExemplars
       ? await aiPersonaService.pickExemplars(persona.key, { count, query })
       : []
 12. messages = scenario.buildPrompt({ subject, persona, profile, retrieval, memories, exemplars })
 13. runtime = await aiService.getEchoModel()
 14. content = await runtime.chat(messages)
 15. content = scenario.postProcess?.(content, subject) ?? content
 16. UPDATE row:
       status='ready', content, model=runtime.modelId, generated_at=now(),
       metadata = metadata || {
         retrievalIds: retrieval.map(r => `${r.sourceType}:${r.sourceId}#${r.chunkIndex}`),
         retrievalSimilarities: retrieval.map(r => r.similarity),
         memoryIds: memories.map(m => m.id),
         profileRefreshedAt: profile?.refreshedAt ?? null,
       }
 17. if scenario.emitOnReady: emit event with the row, scope=TO_SYSTEM_VISITOR
```

### 5.3 Failure handling

- Transient failures (network, 5xx from provider): task queue retries with backoff `[5_000, 30_000, 120_000]`, `maxRetries=3`. On final failure, write `status='failed'`, `metadata.errorCode='AI_ECHO_GENERATION_FAILED'`, `metadata.upstreamMessage` (truncated to 1k chars).
- Structural failures (subject gone, scenario missing, model unconfigured): terminate immediately, no retry.
- Quota exceeded (`AI_ECHO_DAILY_QUOTA_EXCEEDED`): terminate immediately, no retry; surfaced via admin list filter.

The `recently` HTTP create path never sees any of this.

### 5.4 Regenerate flow

```
POST /ai-echo/regenerate/recently/:subjectId   body: { personaKey, force?: boolean }

  1. existing = repo.findOne({ scenario_key:'recently', subject_type:'recently', subject_id, persona_key })
  2. if existing && existing.status IN ('pending','generating') && !force:
        throw 409 AI_ECHO_REGENERATE_IN_PROGRESS
  3. if existing && force:
        UPDATE existing SET status='archived', updated_at=now()
  4. dispatch new row via same flow as 5.1
  5. return { echoId: newRow.id, taskId: newRow.metadata.taskId }
```

Force-archived rows are not deleted; admin list can still see them with `?status=archived`.

### 5.5 Subject-delete cascade

Recently scenario listener for `RECENTLY_DELETE`:

```
aiEchoService.handleSubjectDeleted('recently', id):
  - rows = repo.findAll({ scenario_key:'recently', subject_type:'recently', subject_id: id })
  - for r in rows:
      if r.status IN ('pending', 'generating'):
        UPDATE status='failed', metadata.aborted=true
        (the running task will check status on next step and no-op)
      else:
        UPDATE status='archived'
```

The task processor's step-2 guard ensures any in-flight work either completes harmlessly (if it already passed the guard) or stops before writing.

## 6. Prompt assembly (recently scenario)

`echo-prompt-builder.ts` exports `buildRecentlyEchoPrompt(input)`. For `inner-self`:

```
SYSTEM:
  <persona base instruction from ai-persona/prompts.ts: 'inner-self'>

  <if input.profile> Voice summary:
    {input.profile.profileSummary || input.profile.profile}

  <if input.exemplars.length> Mimic the cadence of these passages:
    1. {exemplars[0].content}
    2. {exemplars[1].content}
    ...

  <if input.memories.length> Canonical facts (apply only if relevant):
    - {memories[0].content}
    - {memories[1].content}
    ...

  <if input.retrieval.length> Relevant past thoughts (reference only if directly applicable):
    [{sourceType}:{sourceId}@{date}] {retrieval[0].content}
    ...

  RULES:
  - Reply in 1–3 short sentences.
  - <if input.retrieval.length == 0 AND input.memories.length == 0>
      Do NOT claim to remember the author's past ("you wrote", "back when", "I remember", "我记得").
    </if>
  - Match the author's first-person voice.
  - Plain markdown only; no code fences.

USER:
  {subject.content}
```

For `passerby` the SYSTEM is the fixed prompt from `ai-persona/prompts.ts` with no profile, exemplars, memories, or retrieval. USER is the same `subject.content`.

The no-unverified-memory rule is the most important MVP guardrail; it's enforced by prompt and verified by unit test (assert the rule appears whenever retrieval+memories are empty).

## 7. API surface

All endpoints under `@ApiController('ai-echo')` and the V2 envelope. Errors use `BizException` with codes from §8.

### 7.1 Public

| Method | Path | Auth | Body / Query | Returns |
| --- | --- | --- | --- | --- |
| GET | `/ai-echo/by-subject/:subjectType/:subjectId` | — | `?personaKey=&scenarioKey=` | `AiEchoViews.public[]` (filters to `status IN ('ready','edited')`) |

### 7.2 Admin (all `@Auth()`)

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/ai-echo/regenerate/:subjectType/:subjectId` | `{ personaKey, force?: boolean }` | `{ echoId, taskId }` |
| PUT | `/ai-echo/:id` | `{ content }` | `AiEchoViews.admin` (`status='edited'`, `edited_at`, `edited_by` populated) |
| DELETE | `/ai-echo/:id` | — | 204; soft-deletes to `status='archived'` |
| GET | `/ai-echo` | `?scenarioKey=&status=&personaKey=&subjectType=&page=&size=` | Paginated `AiEchoViews.admin[]` with `MetaObjectBuilder` pagination |

Rating endpoint, KPI endpoints, and streaming endpoints are not part of this MVP.

### 7.3 Views

```ts
// ai-echo.views.ts
export const AiEchoViews = {
  public: ZodObject<{
    id, scenarioKey, subjectType, subjectId, personaKey,
    content, status, generatedAt, editedAt,
    metadata: { profileRefreshedAt?, retrievalIds?, memoryIds? }, // public-safe subset
  }>,
  admin: ZodObject<{ ...full row... }>,
}
```

Recently `getList` / `getOne` do **not** embed echoes. The Yohaku frontend issues a separate `GET /ai-echo/by-subject/recently/:id` per item (or batch). This decision keeps recently endpoints cacheable and decouples failure modes.

## 8. Errors

New entries in `AppErrorCode`:

| Code | HTTP | Notes |
| --- | --- | --- |
| `AI_ECHO_NOT_FOUND` | 404 | |
| `AI_ECHO_SUBJECT_NOT_FOUND` | 404 | Returned by regenerate when subject is gone; processor uses internally to terminal-fail. |
| `AI_ECHO_SCENARIO_NOT_REGISTERED` | 400 | Defensive; only on misconfigured deploy. |
| `AI_ECHO_GENERATION_FAILED` | 500 | Persisted on row; not normally surfaced to public. |
| `AI_ECHO_REGENERATE_IN_PROGRESS` | 409 | When `force=false` and a row is already pending/generating. |
| `AI_ECHO_MODEL_NOT_CONFIGURED` | 400 | `AIFeatureKey.Echo` has no assignment. |
| `AI_ECHO_DAILY_QUOTA_EXCEEDED` | 429 | Task-level fail; queue does not retry. |

## 9. Configuration

Schema additions in `configs.schema.ts → AISchema` (see root §4.4 for conventions):

```ts
echoModel: field.plain(AIModelAssignmentSchema.optional(), 'Echo model'),
enableEcho: field.toggle(z.boolean().optional(), 'Allow AI echo'),
enableAutoGenerateEchoOnCreate: field.toggle(z.boolean().optional(), 'Auto-generate echo on recently create',
  { description: 'Requires enableEcho to also be enabled' }),
echoDailyQuota: field.number(
  z.preprocess(/* numeric coerce */, z.number().int().min(0).optional()),
  'Echo daily quota',
  { description: 'Max echo generation calls per day; 0 means unlimited. Default 200' }),
echoRetrievalTopK: field.number(/* … */, 'Echo retrieval top-K', { description: 'Default 5' }),
echoRetrievalMinSimilarity: field.number(/* numeric 0..1 */, 'Echo retrieval min similarity',
  { description: 'Cosine similarity threshold; below this no retrieval section is injected. Default 0.72' }),
echoExemplarsCount: field.number(/* … */, 'Echo exemplars count', { description: 'Default 4' }),
```

The `enableAutoGenerateEchoOnCreate` toggle gates the orchestrator's event listener; when off, echoes are only generated via the admin regenerate endpoint.

## 10. Testing

Project conventions: `vitest`, `@testcontainers/postgresql`, `redis-mock`, `createE2EApp`.

### 10.1 Unit

- `echo-prompt-builder`: deterministic given inputs; the no-unverified-memory rule appears iff retrieval+memories are empty.
- Scenario registration: `AiEchoService` resolves scenarios by key, throws when unknown.
- `EchoGenerateTaskProcessor` step-2 guard: row with status NOT IN ('pending','generating') causes no writes and emits no events.

### 10.2 Integration (pg + redis containers)

- `recently.create` → mock runtime → two `ai_echoes` rows reach `status='ready'`; `RECENTLY_ECHO_LANDED` fires twice on the event bus.
- `recently.delete` mid-flight → in-flight row marked `failed/aborted`; subsequent task wake is a no-op.
- `POST /ai-echo/regenerate` (force=true) archives old row, inserts fresh one.
- `PUT /ai-echo/:id` → `status='edited'`, `edited_by` matches authenticated user.
- Runtime throws → row `status='failed'`, `metadata.errorCode='AI_ECHO_GENERATION_FAILED'`, retries observed up to `maxRetries`.
- `echoDailyQuota=1` → second enqueue terminates with `AI_ECHO_DAILY_QUOTA_EXCEEDED`.
- Replay (task fires twice for same echoId after first ready) → second invocation no-ops.

### 10.3 Mocks

- Extend or add `test/mock/processors/ai-runtime.mock.ts` with controllable chat responses + throw modes. Shared with persona + embeddings tests.

## 11. Migration

```
00XX_ai_echoes.sql    -- this spec
```

Additive only. Drizzle schema for `ai_echoes` added in `packages/db-schema/src/schema/ai.ts`. Repository registered in `repository.tokens.ts` per project convention.

## 12. MVP / v2 boundary

**MVP (this spec):**
- ai-echo module, `ai_echoes` table, EchoScenario abstraction, multi-provider registration
- Recently scenario provider in `recently/scenarios/`
- Generate / regenerate / edit / delete / list endpoints
- Public list endpoint
- ECHO_GENERATE task with idempotency guards
- Subject-delete cascade for recently
- Configuration (`echoModel`, `enableEcho`, `enableAutoGenerateEchoOnCreate`, quota, retrieval thresholds, exemplar count)

**v2 (not this spec):**
- `POST /ai-echo/:id/rating` endpoint and rating field
- Comment-reply scenario (subscribes to `COMMENT_CREATE` with article filter)
- Reader-companion scenario (`persistEchoes=false`, uses ai-inflight streaming)
- Per-scenario quota / pricing surfaces
- Streaming echo delivery (ai-inflight integration)

## 13. Acceptance criteria (engine-specific)

- `EchoScenario` providers register cleanly via Nest DI; unit test verifies multi-injection works.
- A new `recently` row produces two echoes within seconds; force-regenerate replaces the previous row's status and emits a new task.
- Step-2 status guard verified by an integration test that double-fires the same task.
- All Echo-related errors carry stable codes from §8.
- Adding a hypothetical new scenario in test (`provide: ECHO_SCENARIO, multi: true`) requires zero changes to `ai-echo.service.ts`.
