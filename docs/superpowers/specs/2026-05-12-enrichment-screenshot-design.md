# Enrichment Screenshot Capture & UI

> 2026-05-12 · scope: `apps/core/src/modules/enrichment` + Yohaku link-card UI · status: design

## Background

The Open Graph fallback provider (`OpenGraphProvider`) now has two fetch modes (see `2026-05-12-enrichment-resolve-hardening-design.md` and the recent `safe-fetch.ts` + `browser-fetch.service.ts` work):

- `fetch` — plain HTTP via `safeFetch`, default.
- `browser` — agent-browser headless rendering, opt-in via `thirdPartyServiceIntegration.openGraph.fetchMode = 'browser'`. Used for Cloudflare-walled / SPA / heavily-rendered sites.

Browser mode unlocks signals that plain HTTP cannot deliver. The biggest single win is a **page screenshot**: many indie blogs and SPA sites ship no `og:image`, and the link card falls back to a bare title row. A first-paint screenshot fills that gap, and the same screenshot lets us derive a dominant-color palette to tint the card.

On the Yohaku side, link cards are rendered through `dispatch.tsx`. The `web` category lands on `FallbackCard`, which composes `LinkCardShell` + `WideOgMedia` + a meta row. `WideOgMedia` consumes `EnrichmentResult.image` (url + width/height + blurhash). `HoverLinkCard` reuses the same atom in a 360px popover. `InkWash` reads `--color-accent` (currently sourced from `<meta theme-color>` only).

## Goals

1. When `fetchMode = 'browser'`, capture a first-paint screenshot of the target page in the same agent-browser session that fetched HTML, with no second navigation.
2. Persist screenshots to S3-compatible object storage (re-using `S3Uploader`) under a **double-quota cap** (item count + total bytes). Oldest-by-access entries are evicted before each new write so disk/storage growth is bounded.
3. Surface the screenshot, blurhash, and palette through `EnrichmentResult.screenshot` so existing API consumers stay backward-compatible (purely additive field).
4. In Yohaku, use the screenshot as an `og:image` fallback (so empty cards become visual) and as the **primary media** for `HoverLinkCard` (so the hover popover always shows the actual destination, even when an `og:image` is present).
5. Tint the card via the screenshot's dominant color when no `<meta theme-color>` is set, raising visual-consistency coverage from the small subset of sites that ship `theme-color` to virtually all browser-mode-captured pages.

## Non-Goals

- Mobile-viewport capture (`set viewport 375 812`). Doubles storage cost for marginal product value; revisit after observing P0 in production.
- A dedicated "screenshot-only" link card variant (the "P2 `ScreenshotCard`" sketch from brainstorming). Wait until we can quantify how many cards land in browser mode *and* lack `description`/`site`.
- A full-page (long) screenshot. Capture is fixed-viewport 16:9 only; full-page screenshots blow out the popover height budget.
- Screenshot for the `fetch` HTTP path. Plain `fetch` has no renderer, so the only way to add screenshots there would be to invoke agent-browser purely for visuals — defeats the cost trade-off the user chose by picking `fetchMode = 'fetch'`.
- A lightbox / zoomable preview of the screenshot. Out of scope; users tap through to the live page.
- Re-capturing on TTL refresh of existing cached enrichments before this feature ships. Backfill is opt-in via admin refresh and not automatic.

## Architecture

```
                 ┌─────────────────────────────┐
                 │   OpenGraphProvider.fetch   │
                 │   (fetchMode == 'browser')  │
                 └──────────────┬──────────────┘
                                │
                                ▼
              ┌───────────────────────────────────┐
              │   BrowserFetchService.fetchPage   │
              │   (one agent-browser session)     │
              │                                   │
              │   1. open <url>                   │
              │   2. wait 1500                    │
              │   3. eval outerHTML               │  ← already exists
              │   4. screenshot to .webp          │  ← NEW
              │   5. close session                │
              └──────────────┬────────────────────┘
                             │  { html, screenshotBytes }
                             ▼
              ┌───────────────────────────────────┐
              │      ScreenshotPipeline           │
              │                                   │
              │   sharp(buf):                     │
              │    - downscale 1280x720           │
              │    - extract dominant + swatches  │
              │    - encode blurhash 32x32        │
              │    - re-encode webp q75           │
              └──────────────┬────────────────────┘
                             │
                             ▼
              ┌───────────────────────────────────┐
              │   ScreenshotStorageService        │
              │                                   │
              │   1. evictIfOverQuota()           │
              │      → DELETE oldest by LRU until │
              │        items ≤ max && bytes ≤ max │
              │      → S3 deleteObject on each    │
              │   2. S3 putObject .webp           │
              │   3. INSERT enrichment_screenshots│
              └──────────────┬────────────────────┘
                             │
                             ▼
              ┌───────────────────────────────────┐
              │   OpenGraphProvider injects       │
              │   result.screenshot = {url,...}   │
              └───────────────────────────────────┘
```

API → Yohaku → `dispatch` → `FallbackCard` / `HoverLinkCard` consume `result.screenshot` (purely additive; no schema break).

## Components

### Backend

#### `BrowserFetchService.fetchPage(url, opts)` (extends the existing `fetchHtml`)

Returns `{ html: string, screenshotBytes?: Buffer }`. The existing batch chain (`open`, `wait 1500`, `eval ...`) is extended with one extra step inside the same session:

```
agent-browser --session og-<hex> batch --bail --json \
  "open <url>" \
  "wait 1500" \
  "eval -b <b64> --json" \
  "set viewport 1280 720" \
  "screenshot --screenshot-format webp --screenshot-quality 75 --screenshot-dir <tmpdir>"
```

The CLI writes the screenshot to a tempfile; the service reads the bytes back and unlinks the file. If the screenshot step fails (CLI error, timeout, missing file), HTML is still returned and `screenshotBytes` is `undefined`. The HTML path must not regress on screenshot failure.

Existing CLI args are kept where they are (no flag changes). Failure to find a screenshot file after the batch completes is logged at `debug` and treated as "no screenshot," not an error.

Timeout (`opts.timeoutMs`, default 25_000 in browser mode) covers the entire batch. The existing `AbortController` + `SIGKILL` path needs no change.

#### `ScreenshotPipelineService` (new, in `providers/open-graph/`)

Pure compute. Takes raw screenshot bytes; returns:

```ts
interface ProcessedScreenshot {
  webp: Buffer        // re-encoded at configured quality, possibly downscaled
  width: number
  height: number
  blurhash: string         // lowercase to match the existing EnrichmentImage shape
  palette: {
    dominant: string         // #RRGGBB
    swatches?: string[]      // top-3 distinct, optional
  }
}
```

Implementation:

- `sharp(input).resize(1280, 720, { fit: 'inside', withoutEnlargement: true })`
- `.stats()` for `.dominant` (re-used pattern from `helper.image.service.ts`)
- Swatches via histogram bucketing on a 64x64 downscale (top 3 colors by frequency, distance-filtered so swatches do not collapse into near-duplicates). Cheap; ~5ms.
- Blurhash via the same `blurhash` package and 32x32 raw read pattern already used by `helper.image.service.ts:147-158`. Field name stays lowercase (`blurhash`) to match the existing `EnrichmentImage` shape on the wire; the `JSONTransformInterceptor` snake_case rule does not affect it (no camel hump).
- Final encode `.webp({ quality: configuredQuality })`.

If `processed.webp.length > maxBytesPerImage`, retry once at `quality - 15`. If still over, drop the screenshot (logged) — never store oversized blobs.

Reuses the existing `sharp` dependency. No new packages.

#### `ScreenshotStorageService` (new)

Owns the put/evict/delete cycle. Exposes:

```ts
interface ScreenshotStorageService {
  storeOrEvict(args: {
    enrichmentId: string            // Snowflake decimal string, matches enrichment_cache.id
    processed: ProcessedScreenshot
  }): Promise<{ url: string }>
  delete(enrichmentId: string): Promise<void>
  touchAccess(enrichmentId: string): Promise<void>  // throttled via Redis NX-EX 3600
}
```

`storeOrEvict` flow:

1. Read current `(count, sum_bytes)` from `enrichment_screenshots` (single aggregate query).
2. If `count + 1 > maxItems` or `sum_bytes + new.bytes > maxTotalBytes`, select oldest rows by `last_accessed_at ASC`, delete S3 objects (best-effort, swallow 404s), and delete DB rows in batches of 50 until quotas pass.
3. Run a single SQL transaction: `S3 putObject` first (S3 is the source of truth; if it fails, nothing is written), then `INSERT ... ON CONFLICT (enrichment_id) DO UPDATE` (a re-capture of the same enrichment overwrites bytes + clears old object key first).
4. Return the public CDN URL (re-uses `S3Uploader.getPublicUrl(objectKey)`).

`touchAccess` is invoked by `EnrichmentController.getOne` and `EnrichmentController.resolve` on cache hit. To prevent write amplification, it short-circuits if `last_accessed_at` was updated within the last hour — checked via a Redis key `enrich:scr:touch:<id>` with `EX 3600 NX`. The Redis check is the same pattern already used by other "touch" paths (see existing `EnrichmentService` cache layer).

`delete` is called from admin "delete enrichment" / "purge cache" paths (best-effort; failure does not block the enrichment delete).

#### Schema: `enrichment_screenshots` table

New table, additive only. No changes to existing `enrichments` table.

```sql
CREATE TABLE enrichment_screenshots (
  enrichment_id      TEXT PRIMARY KEY REFERENCES enrichment_cache(id) ON DELETE CASCADE,
  object_key         TEXT NOT NULL,
  bytes              INTEGER NOT NULL,
  width              INTEGER NOT NULL,
  height             INTEGER NOT NULL,
  blurhash           TEXT,
  palette            JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_accessed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX enrichment_screenshots_lru_idx
  ON enrichment_screenshots (last_accessed_at ASC);
```

`enrichment_id` is `TEXT` because `enrichment_cache.id` is a Snowflake decimal string stored via `pkText()` (see `packages/db-schema/src/schema/columns.ts`). The matching Drizzle helper for the FK column is `refText('enrichment_id')`. Column name `blurhash` is lowercase to match the wire shape — see the pipeline interface note above.

Migration safety (rolling deploy, Dokploy 2 replicas — see `2026-05-05-database-migration-release-phase-design.md`):

- Pure additive `CREATE TABLE` + `CREATE INDEX`. New replicas reference the table; old replicas never touch it. Expand-only; no contract step needed.
- The `ON DELETE CASCADE` removes screenshot rows when an enrichment is deleted, so admin "purge" continues to work without explicit join cleanup; S3 cleanup runs through `ScreenshotStorageService.delete` in the same path.
- The matching Drizzle schema definition lives under `packages/db-schema/src/schema/enrichment.ts` (extend the existing file rather than creating a new one — the `enrichment_cache` table already lives there). Re-export from `packages/db-schema/src/schema/index.ts` if not already covered by the file-level `*` re-export. Repository is a new class `EnrichmentScreenshotRepository extends BaseRepository<typeof enrichmentScreenshots>` registered through `apps/core/src/processors/database/repository.tokens.ts` per existing pattern.

This migration is authored using the `mx-migration-author` skill and validated by `pnpm -C apps/core run lint:migrations`.

#### `OpenGraphProvider` integration

Inside the `fetchMode === 'browser'` branch (currently `await this.browserFetch.fetchHtml(...)`):

1. Switch the call to `browserFetch.fetchPage(...)` to receive `{ html, screenshotBytes? }`.
2. Parse HTML through the existing `parseOpenGraph` path (no change).
3. If `screenshotBytes` is present and `screenshot.enabled` is true:
   - Pipe through `ScreenshotPipelineService`.
   - Call `ScreenshotStorageService.storeOrEvict({ enrichmentId, processed })`.
   - Set `result.screenshot = { url, width, height, blurHash, palette }` on the enrichment payload.
4. The enrichment row write path is unchanged; `screenshot` is part of the JSON result column.

If processing or storage fails at any point, the enrichment result is still returned (just without `screenshot`). Failure is logged at `warn`; the user-visible card degrades to the existing fallback behavior.

The enrichment row must exist (have an `id`) before the screenshot row is written, since `enrichment_screenshots.enrichment_id` is a foreign key. The natural place is inside `EnrichmentService.fetchAndPersist` *after* the `INSERT ... RETURNING id` step, not inside the provider's `fetch()` (which does not see the row id).

To keep `OpenGraphProvider.fetch`'s public return type unchanged, `BrowserFetchService` owns a request-scoped channel for the raw bytes:

```ts
// inside BrowserFetchService
private readonly bytesByResult = new WeakMap<EnrichmentResult, Buffer>()

takeScreenshotBytes(result: EnrichmentResult): Buffer | undefined {
  const buf = this.bytesByResult.get(result)
  this.bytesByResult.delete(result)
  return buf
}
```

`OpenGraphProvider.fetch()` writes into the WeakMap with the result instance it is about to return; `EnrichmentService.fetchAndPersist` calls `browserFetch.takeScreenshotBytes(result)` *after* persisting the row, runs the pipeline + storage steps, then updates the row's `screenshot` JSON field. The WeakMap auto-clears once the result object is garbage-collected, so there is no manual TTL to track. The `EnrichmentResult` public shape (and therefore the API response) never carries `screenshotBytes`.

#### Config

Adds a new sub-section under `thirdPartyServiceIntegration.openGraph`:

```ts
screenshot: {
  enabled: false,                  // default OFF; opt-in
  maxItems: 500,
  maxTotalBytes: 100 * 1024 * 1024,
  maxBytesPerImage: 512 * 1024,
  webpQuality: 75,
}
```

Schema validation lives in `configs.schema.ts` next to the existing `openGraph` schema. Defaults wired through `configs.default.ts`. Schema field uses `field.number` + `z.preprocess` mirroring the existing `timeoutMs`/`maxBodyBytes` fields.

#### Touch path (LRU access bookkeeping)

`EnrichmentController.getOne` and `EnrichmentController.resolve` already return the `EnrichmentResult` from the repository on cache hit. After the response is produced, fire-and-forget:

```ts
if (result.screenshot) {
  this.storage.touchAccess(result.id).catch(() => {/* ignored */})
}
```

The Redis NX-with-TTL gate inside `touchAccess` keeps this from generating a write per hover. Worst case: ~24 writes/day per active link card, well within `enrichment_screenshots` capacity.

### Frontend (Yohaku)

#### Model: `EnrichmentResult.screenshot`

Add to `apps/web/src/models/enrichment.ts`:

```ts
export interface EnrichmentScreenshot {
  url: string
  width: number
  height: number
  blurhash?: string
  palette?: { dominant: string; swatches?: string[] }
}

export interface EnrichmentResult {
  // ...existing fields
  screenshot?: EnrichmentScreenshot
}
```

`@mx-space/api-client` types receive the same additive field: extend `packages/api-client/models/recently.ts` (which is where `EnrichmentImage`, `EnrichmentAttribute`, and `EnrichmentResult` already live) with `EnrichmentScreenshot` and `screenshot?: EnrichmentScreenshot` on `EnrichmentResult`. Yohaku imports re-export this through `apps/web/src/models/enrichment.ts` per existing convention.

#### `WideOgMedia` — image-with-screenshot fallback

`WideOgMedia.tsx:12` currently bails when `!image?.url`. Change to:

- Accept an optional `fallbackScreenshot?: EnrichmentScreenshot`.
- When `image?.url` is absent but `fallbackScreenshot` is present, render the screenshot as the media. The aspect ratio for screenshots is fixed 16:9; the existing portrait/ultra-wide clamping (`safeRatio` line 19) becomes a no-op for screenshots (already inside [1, 3]).
- When both are absent, render nothing (existing behavior).
- Blurhash comes from whichever source actually rendered.

Both `FallbackCard` and `HoverLinkCard` already mount this atom — single change site.

#### `FallbackCard` — pass screenshot as fallback

`FallbackCard.tsx:76` — pass `fallbackScreenshot={data.screenshot}` alongside `image={data.image}`. Inline article cards still prefer the `og:image` (matches the design discussion's P1: inline = curated, hover = real).

#### `HoverLinkCard` — screenshot wins when both exist

`HoverLinkCard.tsx:29` — invert the priority. Render the screenshot when present; fall back to `og:image` otherwise. This realizes "hover shows the actual destination," the design point users responded to most strongly.

```tsx
<WideOgMedia
  alt={data.image?.alt ?? data.title}
  image={data.screenshot ? screenshotToImage(data.screenshot) : data.image}
/>
```

A small helper `screenshotToImage(s): EnrichmentImage` shapes the screenshot into the existing `EnrichmentImage` shape so `WideOgMedia` does not need a separate code path. Defined locally in `HoverLinkCard.tsx`.

#### `InkWash` — palette-tinted accent

`InkWash.tsx` currently reads `--color-accent` (set inline by `FallbackCard` from `data.color`). Two changes:

1. In `FallbackCard`, when `data.color` does not produce a valid `#RRGGBB`, fall back to `data.screenshot?.palette?.dominant` before giving up. The same `HEX_RE` check applies (palette values come server-side and are sanitized but front-end stays defensive).
2. Apply the same fallback inside `HoverLinkCard` (currently no accent injection; the popover uses static colors). Adding the inline style here keeps the hover popover visually coherent with the page.

No change to `InkWash` itself — it already reads the CSS variable; we just widen what feeds the variable.

#### `dispatch.tsx`

No change. P2 `ScreenshotCard` is explicitly out of scope.

## Data Flow

1. User visits a page with an inline link → `InlineLinkAnchor` mounts.
2. On hover, `useInlineLinkEnrichment(href)` triggers React Query → calls `GET /enrichment/resolve?url=<href>`.
3. Cache miss → `EnrichmentService.fetchAndPersist` → matches `open-graph` provider → `OpenGraphProvider.fetch` runs in `browser` mode.
4. `BrowserFetchService.fetchPage` runs one agent-browser session, returns `{ html, screenshotBytes }`.
5. Provider returns `EnrichmentResult`; raw screenshot bytes live in `BrowserFetchService`'s `WeakMap<EnrichmentResult, Buffer>` keyed off the result instance.
6. `EnrichmentService` persists the row → reads back `id` → calls `browserFetch.takeScreenshotBytes(result)` → pipeline + storage → updates the row's `screenshot` JSON field.
7. Response is returned to Yohaku. `HoverLinkCard` renders with the screenshot.
8. On cache hit (subsequent visitors), `EnrichmentController.resolve` returns the cached row and fires `touchAccess` (throttled).

## Error Handling

| Failure | Behavior |
|---|---|
| agent-browser CLI missing | `browser-fetch.service.ts` already throws a clear instruction error. No new path. |
| agent-browser timeout | Existing `AbortController.abort()` → SIGKILL; full enrichment fetch fails (status 500 to caller) — same as today. |
| HTML returned, screenshot step failed | HTML path proceeds; `result.screenshot` absent. Card degrades to title-only or `og:image` if present. Logged at `debug`. |
| Sharp processing fails | Same — log at `warn`, no `screenshot` field. |
| S3 put fails | Same — log at `warn`, no `screenshot` field. The DB row already exists; we just do not add the screenshot fields. |
| LRU eviction S3 delete returns 404 | Treated as success (object already gone). |
| LRU eviction DB delete fails | Abort the eviction batch; do not proceed to put. The new screenshot is dropped; next request retries. Prevents quota overrun. |
| `touchAccess` Redis miss / failure | Skip the access update. LRU may drift slightly toward marking active rows as stale; recoverable on next access. |
| Frontend: `screenshot.url` 404 (S3 object evicted between row read and image load) | `<img>` falls back to error; consumer-side `onError` clears `screenshot` and `WideOgMedia` re-renders with the `og:image` path. The link card never breaks visually. |

## Testing

### Backend

- `BrowserFetchService` unit tests: mock `execFile`; assert the batch arg array includes the new `screenshot` step in browser mode; assert tempfile cleanup.
- `ScreenshotPipelineService` unit tests: feed a fixture PNG (`apps/core/test/fixtures/screenshot-*.png`), assert width/height clamp, palette extraction returns valid `#RRGGBB`, blurhash decodes back to a non-trivial canvas, retry-at-lower-quality path triggers when size > threshold, drop path triggers when retry still over.
- `ScreenshotStorageService` unit tests: in-memory `S3Uploader` mock + a real PG test container (`pg-testcontainer.ts` already exists); cover insert, update-on-conflict, LRU eviction at item-cap, LRU eviction at byte-cap, mixed eviction (cap reached on items but bytes still under). Confirm S3 delete is invoked before DB delete.
- `EnrichmentService.fetchAndPersist` integration test: fetchMode = 'browser' + capture stub returns bytes → row created → screenshot fields populated → subsequent `resolve` returns the screenshot.
- Migration test: lives next to `20260506-enrichment-backfill.spec.ts`; verifies the new table exists, indexes are correct, FK cascade fires.

### Frontend

- `WideOgMedia.test.tsx` — add cases:
  - `image` absent, `fallbackScreenshot` present → renders screenshot.
  - both present → renders `image`.
  - both absent → renders nothing.
- `FallbackCard.test.tsx` — add cases:
  - `data.color` invalid, `screenshot.palette.dominant` valid → `--color-accent` uses palette dominant.
  - `og:image` present and `screenshot` present → renders `og:image` (inline preference).
- `HoverLinkCard.test.tsx` — add cases:
  - `og:image` present, `screenshot` present → renders screenshot (hover preference).
  - `screenshot` absent, `og:image` present → renders `og:image`.
- `InlineLinkAnchor` tests do not need changes (they assert popover lifecycle, not media).

## Rollout

1. Ship the migration + Drizzle schema + repository, with the screenshot pipeline behind `screenshot.enabled = false`. Verifies the table exists in prod without touching any user-visible behavior.
2. Ship the `BrowserFetchService.fetchPage` extension + pipeline + storage service. Still behind the flag.
3. Ship the `api-client` type extension and the `EnrichmentResult.screenshot` field plumbing in `EnrichmentService` (still no-op while flag is off).
4. Ship the Yohaku consumer changes (`WideOgMedia`, `FallbackCard`, `HoverLinkCard`). Optional `screenshot` field; renders identically to today when undefined.
5. Flip `screenshot.enabled = true` in admin config. Browse the site; watch new rows in `enrichment_screenshots`; confirm S3 bucket fills and LRU eviction kicks in once `maxItems` is exceeded (set a temporary low cap for the test cycle).

Each step is independently revertable. Steps 1-4 are pure-additive code paths. Step 5 is a config flip.

## Open Questions

None blocking. Tracking for future iterations:

- **Mobile-viewport second capture**: if real traffic shows wide gap between mobile/desktop layouts (e.g. publication sites that show full content only on desktop), capture both. Doubles storage cost; decide post-launch.
- **`ScreenshotCard` variant** (the "P2" sketch): only if observed traffic shows a meaningful slice of cards with `screenshot` but no `description`/`site`. Premature without data.
- **Refresh policy**: should TTL-expired enrichment refresh also re-capture the screenshot, or only re-fetch HTML? Default behavior: yes, re-capture (one path, same code). Cost: an extra screenshot write per refresh. Revisit if S3 traffic becomes a budget concern.
