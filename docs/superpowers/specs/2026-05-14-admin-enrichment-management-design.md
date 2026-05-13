# Admin Enrichment Management — Design

**Date:** 2026-05-14
**Scope:** Expose enrichment cache, OpenGraph fetch, and browser-mode screenshot operations through the admin-vue3 dashboard. Backend already implements the resolve / refresh / invalidate pipeline and the screenshot LRU; the admin UI today only lists cache rows. This spec adds row detail, screenshot management, and a URL probe console — all under the existing `/enrichment` route, using `MasterDetailLayout`.

## 1. Background

Backend pieces shipped recently:

- `EnrichmentService` — SWR resolve, locale-aware cache, provider registry, refresh task queue
- `OpenGraphProvider` — fetch & browser modes, oEmbed fallback, screenshot capture
- `ScreenshotPipelineService` + `ScreenshotStorageService` — WebP encode, blurhash, palette, S3 put, LRU eviction
- `EnrichmentScreenshotRepository` — `enrichment_screenshots` rows (object_key, bytes, w/h, blurhash, palette, last_accessed_at)

Admin endpoints currently exposed:

- `GET /enrichment/admin/list` (page / size / onlyFailed / locale)
- `GET /enrichment/admin/providers`
- `POST /enrichment/admin/refresh/:provider/*`
- `DELETE /enrichment/admin/cache/:provider/*`

Admin frontend has `views/enrichment/index.tsx`: providers status bar, list, all/failed filter, refresh and invalidate actions. No row detail, no screenshot data, no probe console.

`openGraph.screenshot.*` is already editable through the generic settings → integrations page; we will NOT duplicate it in the enrichment screen.

## 2. Goals

1. Surface the **full enrichment row** — normalized fields, raw payload, screenshot preview — without leaving the page.
2. Make **screenshot blobs** first-class: list them, see quota usage, recapture or delete individually, drop screenshot without dropping the cache row.
3. Provide a **URL probe** so the operator can debug a link card without polluting the cache.

## 3. Non-goals

- No new sidebar entries. Keep one route: `/maintenance/enrichment`.
- No bulk operations beyond what's already possible (refresh / invalidate per row).
- No re-implementing the integrations settings panel.
- No exposing the raw S3 bucket browser (LRU is the source of truth).
- No tab-based subnavigation inside the page (forbidden by `admin-page-layout` skill).

## 4. Layout

The page uses `MasterDetailLayout` per the `admin-page-layout` skill. Three concerns coexist:

**List pane** has a **source switcher** at the top of the list header — a segmented control with three values:

| source | list shows | detail shows |
|---|---|---|
| `cache` (default) | enrichment cache rows (existing list) | row detail panel: normalized + raw + screenshot + actions |
| `screenshots` | screenshot blobs (one per `enrichmentId`) | screenshot detail panel: image + meta + recapture / delete |
| `probe` | recent probe history (in-memory, last 20) | probe console: URL input → live resolve preview, no persistence |

The detail pane re-binds to the selected item according to the current source. Selection state per source is independent (changing source clears the current selection).

Header actions (top-right) via `setActions`:

- Source `cache`: refresh-all button + "仅失败" toggle (kept from current page)
- Source `screenshots`: refresh + quota chip (`523 / 100MB · 312 / 500`)
- Source `probe`: clear-history button

## 5. UI Decomposition

```
views/enrichment/
  index.tsx                          # page setup, MasterDetailLayout, source state
  components/
    source-switcher.tsx              # segmented 3-way control
    providers-status-bar.tsx         # extracted from current index.tsx (no behavior change)
    cache/
      cache-list.tsx                 # list pane for source=cache
      cache-list-item.tsx
      cache-detail-panel.tsx         # detail pane for source=cache
      cache-empty-state.tsx
    screenshots/
      screenshot-list.tsx            # list pane for source=screenshots (grid)
      screenshot-list-item.tsx       # thumbnail card with bytes + age
      screenshot-detail-panel.tsx    # detail pane: full image + meta + actions
      screenshot-quota-chip.tsx
    probe/
      probe-list.tsx                 # left rail: recent probes (in-memory)
      probe-console.tsx              # right pane: URL input + result viewer
```

### 5.1 Cache detail panel

Shows for the selected `EnrichmentRow`:

- Header: provider chip + category/subtype, external link to source URL, age (`fetchedAt`), expiry (`expiresAt`), locale tag
- **Normalized** section: `title`, `description`, `image` (thumbnail with blurhash if present), `attributes` table, `links` list
- **Screenshot** section: thumbnail (if `screenshot.url` present) — clicking opens the screenshot detail panel by switching source to `screenshots` and selecting the same `enrichmentId`. If no screenshot: hint "无截图" + "立即截图" button (when provider in browser mode).
- **Raw** section: collapsible `<pre>` with JSON, copy-to-clipboard button
- **Failure** section: only when `failureCount > 0` — count + `lastError` + recompute backoff window
- Actions: 刷新 / 失效（保留 / 失效）

### 5.2 Screenshot detail panel

- Header: linked back to the parent enrichment row (provider + title)
- Full-size image (lazy load, click to open in new tab)
- Meta: dimensions, bytes (human), `createdAt`, `lastAccessedAt`, palette swatches
- Actions:
  - **删除截图** — calls new `DELETE /enrichment/admin/screenshots/:enrichmentId`; cache row preserved
  - **重新截图** — calls new `POST /enrichment/admin/screenshots/:enrichmentId/recapture`; only enabled when OG provider is in browser mode and `openGraph.screenshot.enabled` is true. Otherwise tooltip explains why.

### 5.3 Probe console

The cheapest possible debugging surface — no DB writes.

- Input: URL textbox + "试抓" button
- Result: matched provider, EnrichmentResult JSON, the rendered link card mock
- "如已有缓存则使用缓存" toggle (default off — always force a fresh fetch)
- "持久化结果" button — only appears when the result was a forced fresh fetch; calls existing refresh endpoint

In-memory probe history list (last 20) lives in a `ref` inside the page setup; not persisted across reloads.

## 6. Backend additions

All under `EnrichmentController` with `@Auth()`. Schema validation via Zod following project conventions.

### 6.1 Cache row detail

```
GET /enrichment/admin/by-id/:id
→ EnrichmentRow & { screenshot: EnrichmentScreenshotRow | null }
```

Already trivial — `enrichmentRepository.findById` (add method) + `screenshotRepository.findByEnrichmentId`. Returns 404 if no row.

### 6.2 Screenshot list

```
GET /enrichment/admin/screenshots?page&size&sort=last_accessed|created|bytes&order=asc|desc
→ {
    data: Array<{
      enrichmentId: string
      provider: string             // joined from enrichment_cache
      externalId: string
      url: string
      title: string                // normalized.title
      objectKey: string
      publicUrl: string            // S3Uploader.getPublicUrl
      bytes: number
      width: number
      height: number
      blurhash: string | null
      palette: EnrichmentScreenshotPalette | null
      createdAt: string
      lastAccessedAt: string
    }>
    pagination: Pager
  }
```

Repository method `EnrichmentScreenshotRepository.listJoined(page, size, sort, order)` does a LEFT JOIN with `enrichment_cache` and selects the joined columns.

### 6.3 Quota

```
GET /enrichment/admin/screenshots/quota
→ {
    used: { count, totalBytes }
    cap:  { maxItems, maxTotalBytes }
    enabled: boolean
    fetchMode: 'fetch' | 'browser'
  }
```

Reuses `EnrichmentScreenshotRepository.getQuotaUsage()` + `ConfigsService.get('thirdPartyServiceIntegration')`.

### 6.4 Screenshot delete

```
DELETE /enrichment/admin/screenshots/:enrichmentId  → 204
```

Calls `ScreenshotStorageService.delete(enrichmentId)` (already exists) + `EnrichmentRepository.clearScreenshot(enrichmentId)` to strip `normalized.screenshot`. Cache row preserved.

### 6.5 Screenshot recapture

```
POST /enrichment/admin/screenshots/:enrichmentId/recapture  → ScreenshotMeta
```

Looks up the cache row, asserts OG provider is in browser mode AND `screenshot.enabled`, calls `enrichmentService.refresh(provider, externalId, locale)`. Refresh already runs the screenshot pipeline post-persist. Returns the new screenshot metadata or 409 with a code if browser mode is off / screenshot disabled.

### 6.6 Probe

```
POST /enrichment/admin/probe
body: { url: string, useCache?: boolean }
→ {
    matched: { provider: string, externalId: string } | null
    result: EnrichmentResult | null
    cached: boolean
    error?: { code: 'unknown_provider' | 'token_missing' | 'provider_disabled' | 'fetch_failed', message: string }
  }
```

- `useCache=true`: `enrichmentService.resolve(url, lang)` — normal path
- `useCache=false`: bypass cache → call `provider.fetch` directly via a thin service method `enrichmentService.probe(url)` that mirrors `fetchAndPersist` minus the DB upsert. Image meta enrichment runs (it's local + free); screenshot pipeline does NOT run (avoids accidental S3 puts).

## 7. API client

Add to `apps/admin/src/api/enrichment.ts`:

```ts
enrichmentApi.byId(id) → request.get(...)
enrichmentApi.screenshots.list({ page, size, sort, order })
enrichmentApi.screenshots.quota()
enrichmentApi.screenshots.delete(enrichmentId)
enrichmentApi.screenshots.recapture(enrichmentId)
enrichmentApi.probe(url, useCache)
```

`models/enrichment.ts` gains `EnrichmentScreenshot`, `EnrichmentScreenshotJoinedRow`, `EnrichmentQuota`, `EnrichmentProbeResult`, and a `screenshot?` field on `EnrichmentResult` to match the backend type.

`hooks/queries/keys.ts`: extend `queryKeys.enrichment` with `byId`, `screenshots.list`, `screenshots.quota`.

## 8. Empty / error / loading states

- Cache source: existing empty + filtered-empty (keep).
- Screenshots source: empty → "暂无截图缓存" + hint about enabling `openGraph.screenshot.enabled`; show quota chip even when empty.
- Probe source: empty → just shows the URL input centered, history list empty hint.
- Detail empty (no selection): generic placeholder card with icon matching the source.

## 9. Data flow & invalidation

| action | invalidates |
|---|---|
| `cache.refresh(row)` | `enrichment.byId(row.id)`, `enrichment.list`, `enrichment.screenshots.list` (recapture may change screenshot) |
| `cache.invalidate(row)` | `enrichment.list`, `enrichment.byId(row.id)`, `enrichment.screenshots.list`, `enrichment.screenshots.quota` |
| `screenshot.delete(id)` | `enrichment.byId(id)`, `enrichment.screenshots.list`, `enrichment.screenshots.quota` |
| `screenshot.recapture(id)` | same as above |
| `probe` (force) | nothing — fresh fetch is local to the response |
| `probe.persist` | full `enrichment.all` |

## 10. Mobile

`MasterDetailLayout` already collapses. Source switcher remains visible at the top of the list pane. Selection slides in the detail pane; back arrow inside detail header pops back.

## 11. Risks & mitigations

- **Recapture without screenshot enabled** — server returns 409 with a code; UI disables the button preemptively from the quota endpoint's `enabled`/`fetchMode` flags.
- **Screenshot list scale** — current cap is 500 items via LRU; paginated query handles it. Grid renders 20 per page.
- **Probe abuse** — `@Auth()` already gates it; respect the existing 30 req/min `EnrichmentOriginGuard` style throttle (apply `@Throttle` similarly).
- **Stale `normalized.screenshot`** after delete — handled by `EnrichmentRepository.clearScreenshot` (already exists, used by LRU eviction).

## 12. Testing

- E2E (`apps/core/test`): one test per new endpoint, asserting auth, happy path, and the recapture 409 case.
- Repository test: `EnrichmentScreenshotRepository.listJoined` joins, sorts, and paginates correctly.
- Frontend (manual + existing component-test rigging): three sources render, switching clears selection, recapture button reflects config, probe persists optionally.

## 13. Out of scope (followups)

- Bulk select + bulk delete for screenshots
- "Try as browser mode" toggle inside the probe console
- Screenshot diff against previous capture
- Server-side reconciliation for orphan S3 objects
