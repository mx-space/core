# AI Generation Metrics — Design

Date: 2026-08-08
Status: approved, pending implementation
Scope: admin AI detail drawers (Summary / Insights / Translation / TTS)

## Goal

Persist per-generation usage and cost for AI artifacts, and surface the latest
metrics inside each admin AI detail (edit/playback) drawer so operators can see
what generating that item cost — including token and cost breakdowns (input,
output, cache read/write).

## Decisions

| Topic | Decision |
|---|---|
| Storage | Dedicated ledger table `ai_generation_metrics` (not columns on resource rows) |
| History | One insert per successful generation; detail UI shows **latest** row only |
| Display | Edit/detail drawer meta only — no list-row badge, no article-level total |
| Old data | No cost backfill; backfill model/provider only where resource tables already had it |
| Dedup | Remove generation-provenance fields from resource tables; move to ledger |
| Task queue | Keep `incrementCost` / Task `totalCost` for live task UI; ledger is durable |

## Non-goals

- Translation entries ledger
- Agent chat / image generation ledger (can reuse the same table later)
- Article-level cost aggregation UI
- Generation history list UI
- Estimating or inventing cost when the provider does not report it (except optional TTS character pricing when config exists)
- List-row cost badges

## Problem

Generation cost is only accumulated on ephemeral task hashes (`totalCost` in
Redis). After the task expires, the admin AI resource pages cannot show spend.

Separately, generation provenance is scattered:

- `ai_translations.ai_model` / `ai_provider`
- `ai_insights.model_info` (jsonb)

Runtime usage already has a richer shape in pi-ai / agent code
(`input`, `output`, `cacheRead`, `cacheWrite`, and matching `cost.*` fields), but
`mapUsage` currently collapses to prompt/completion tokens + total cost only.

## Data model

### Table `ai_generation_metrics`

| Column | Type | Notes |
|---|---|---|
| `id` | snowflake pk | |
| `created_at` | timestamptz | ledger write time |
| `resource_type` | text not null | `summary` \| `insights` \| `translation` \| `tts` |
| `resource_id` | snowflake not null | target artifact id |
| `ref_id` | snowflake not null | article id (future aggregation) |
| `lang` | text null | when applicable |
| `task_id` | text null | source task when generation ran via queue |
| `provider_id` | text null | |
| `model` | text null | |
| `input_tokens` | int null | |
| `output_tokens` | int null | |
| `cache_read_tokens` | int null | |
| `cache_write_tokens` | int null | |
| `total_tokens` | int null | provider total, or server sum when partials present |
| `cost_input_usd` | numeric null | USD |
| `cost_output_usd` | numeric null | |
| `cost_cache_read_usd` | numeric null | |
| `cost_cache_write_usd` | numeric null | |
| `cost_total_usd` | numeric null | prefer provider total; else sum of non-null parts |

Indexes:

- `(resource_type, resource_id, created_at desc)` — latest metrics for an item
- `(ref_id, created_at desc)` — reserved for future per-article rollups

No FK to resource tables (resource types are polymorphic). On admin resource
delete, the application deletes matching metrics rows.

### Resource table cleanup

| Table | Remove | Keep |
|---|---|---|
| `ai_translations` | `ai_model`, `ai_provider` | content / hash / lang fields |
| `ai_insights` | `model_info` | content / hash / translation link fields |
| `ai_summaries` | — | no overlapping fields |
| `ai_tts` | — | `model` / `voice` / `speed` / `format` / `char_count` stay — they are the **incremental generation lock** (see TTS design), not mere provenance |

TTS still **also** writes a metrics row on each generation (cost/usage + model
snapshot for the ledger). That does not replace the locked config on `ai_tts`.

## Usage capture

### Runtime shape

Extend mapped usage to match pi-ai:

```ts
type GenerationUsage = {
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  totalTokens?: number
  cost?: {
    input?: number
    output?: number
    cacheRead?: number
    cacheWrite?: number
    total?: number
  }
}
```

`pi-runtime.adapter` `mapUsage` must forward cache token and cost subfields
instead of dropping them. Call sites accumulate this structure in memory for the
whole generation (including multi-step translation review loops).

### Dual write

On each successful artifact upsert (or TTS lang complete):

1. `context.incrementCost(costTotalUsd)` when total > 0 (task live badge, unchanged)
2. `AiGenerationMetricsService.record({ resourceType, resourceId, refId, lang, taskId, providerId, model, usage })`

Rules:

- Cache-hit / skip-generate paths do **not** write metrics (same as no cost today)
- Manual content edit in admin does **not** change metrics
- Re-generate inserts a **new** metrics row; UI reads latest
- Any dimension the provider omits stays `null`
- `cost_total_usd`: use provider `cost.total` when present and > 0; else sum
  available cost parts; else `null`

### TTS

TTS does not go through pi text runtime. Record whatever is available:

- Always: `provider_id`, `model` when known
- Cost: only if the adapter/API reports it, or a config-based character estimate
  can be applied honestly; otherwise leave cost/token fields null

### Service API

```ts
// modules/ai/ai-generation-metrics/
AiGenerationMetricsService.record(input): Promise<void>
AiGenerationMetricsService.latestByResources(
  resourceType,
  resourceIds: string[],
): Promise<Map<string, GenerationMetricsRow>>
AiGenerationMetricsService.deleteByResource(resourceType, resourceId): Promise<void>
```

## API

### Attach latest metrics to admin AI responses

Item payloads for Summary / Insights / Translation / TTS (grouped + by-ref + any
detail shapes used by admin) gain:

```ts
generationMetrics: {
  inputTokens: number | null
  outputTokens: number | null
  cacheReadTokens: number | null
  cacheWriteTokens: number | null
  totalTokens: number | null
  costInputUsd: number | null
  costOutputUsd: number | null
  costCacheReadUsd: number | null
  costCacheWriteUsd: number | null
  costTotalUsd: number | null
  providerId: string | null
  model: string | null
  createdAt: string // ISO
} | null
```

Batch-load latest rows for the page’s resource ids; missing → `null`.

Wire casing: response interceptor snake_cases as usual
(`generation_metrics`, `cost_total_usd`, …). Admin client types stay camelCase.

### Remove from resource DTOs

- Translation: drop `aiModel`, `aiProvider` from API and `@mx-space/api-client`
- Insights: drop `modelInfo` from API and api-client

### Public `translationMeta.model`

Resolve from latest metrics for that translation id; omit when absent.
Backfilled model-only rows keep public meta working after column drop.

## Admin UI

Shared component `GenerationMetricsMeta` used by:

- `SummaryEditBody`
- `InsightsEditBody`
- `TranslationEditBody` (replace hard-coded Provider/Model rows)
- `TtsPlaybackBody` (metrics block in addition to existing model·voice·speed lock line)

Visibility:

- If `generationMetrics` is null → render nothing
- Else show available rows only (skip null dimensions)
- Cost formatting: reuse Tasks style (`$X.XXXX USD`, title with higher precision)
- Token counts: locale-aware integers, tabular-nums

No list-row changes. No article total.

## Migrations (expand-contract)

Single release path (one deploy unit):

1. **Create** `ai_generation_metrics` + indexes
2. **Backfill** provenance-only rows:
   - From `ai_translations` where `ai_model` or `ai_provider` is not null  
     → `resource_type=translation`, tokens/costs null
   - From `ai_insights` where `model_info` is not null  
     → parse provider/model if object-shaped; tokens/costs null
3. Ship application code that writes metrics and stops writing removed columns;
   reads model from metrics for public meta and admin attach
4. **Drop** `ai_translations.ai_model`, `ai_translations.ai_provider`,
   `ai_insights.model_info`

Follow `mx-migration-author` skill for SQL safety. Prefer nullable new columns
and additive create first; drops only after writers no longer depend on columns
(same PR acceptable for this monorepo single-service deploy if expand steps run
in order within migrate).

Drizzle schema lives in `packages/db-schema/src/schema/ai.ts`.

## Implementation sketch

### Core

1. Schema + migration(s) + repository + `AiGenerationMetricsService`
2. Enrich `mapUsage` / generation accumulators
3. Hook record calls after successful write in:
   - `ai-summary.service`
   - `ai-insights.service` (+ insights translation)
   - `ai-translation.service` / strategies
   - `ai-tts.service`
4. Stop writing `aiModel`/`aiProvider`/`modelInfo` on resources
5. Attach metrics in list/by-ref mappers; delete metrics on resource delete
6. Public translation meta model from metrics
7. Tests: record + latest batch; generation writes metrics; delete cascades app-side; backfill shape

### Admin

1. Extend `apps/admin/src/api/ai.ts` types
2. `GenerationMetricsMeta` component + i18n (en-US / zh-CN)
3. Wire four edit/playback bodies
4. Remove translation drawer’s legacy Provider/Model rows

### api-client

Update models/fixtures for removed fields and optional `generationMetrics` if
exposed to the client package’s AI types.

## Testing

- Unit: usage mapping includes cache fields; cost total fallback sum
- Unit: `latestByResources` returns newest per id
- Service/integration: generate path inserts metrics; second generate yields new
  latest; skip path inserts none
- Migration: backfill inserts expected provenance rows; columns drop after
- Admin: component renders only present fields; null metrics → empty

## Risks

| Risk | Mitigation |
|---|---|
| Providers omit cost | Nullable fields; hide empty UI rows |
| Multi-step translation double-count | Accumulate once per resource write, not per sub-call blindly |
| TTS no usage payload | Accept null costs; still store model |
| Public meta regression after drop | Backfill + metrics join for `translationMeta.model` |
| Orphan metrics | Delete on resource delete |

## Acceptance

1. New Summary / Insights / Translation / TTS generation writes a metrics row
   with whatever usage/cost dimensions the provider returned.
2. Admin detail drawers show latest metrics when present; show nothing when not.
3. Resource tables no longer store `ai_model`/`ai_provider`/`model_info`.
4. TTS lock fields unchanged; incremental TTS still uses row config.
5. Task page cost badge behaviour unchanged.
6. Old artifacts without metrics (and without backfillable model) show no cost block.
