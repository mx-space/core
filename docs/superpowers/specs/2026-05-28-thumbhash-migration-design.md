# Migrate blurhash to thumbhash across mx-core, packages, admin-vue3, Yohaku

**Date:** 2026-05-28
**Status:** Approved, pre-implementation
**Owner:** Innei

## Context

mx-core currently uses [Wolt blurhash](https://github.com/woltapp/blurhash) for
image placeholders. The hash is generated server-side (sharp → blurhash encoder)
in three places — the Markdown image meta pipeline
(`helper.image.service`), the link-card thumbnail extractor
(`image-meta.service`), and the OG screenshot capture pipeline
(`capture-pipeline.service`) — and persisted in two shapes:

- `enrichment_captures.blurhash text` column (Drizzle schema in
  `packages/db-schema/src/schema/enrichment.ts`).
- `images jsonb` columns on posts / notes / pages / recently, where each image
  object carries a `blurHash` camelCase key.

The frontend (Yohaku, admin-vue3) decodes via `react-blurhash` or
`blurhash.decode()` into a `<canvas>`.

Meanwhile the sibling `haklex` editor stack has already standardized on
[thumbhash](https://evanw.github.io/thumbhash/) (Evan Wallace). The Lexical
`ImageNode`, gallery renderer, and rich-renderer-image all carry a `thumbhash`
field (base64-encoded Uint8Array) and decode it to a PNG dataURL via
`thumbHashToDataURL`. Markdown emitted from mx-core's `helper.lexical.service`
already passes the `thumbhash` key through to renderers.

This split is now the only thing keeping `blurhash` and `react-blurhash` in the
dependency tree. thumbhash is smaller (~24-32 base64 chars vs ~30 base83),
supports transparency, decodes ~10× faster on the client, and removes the need
for a runtime `<canvas>` mount. The existing accent-color extraction is
orthogonal and stays.

## Goals

- Drop `blurhash` and `react-blurhash` entirely from mx-core, admin-vue3, and
  Yohaku. Unified on `thumbhash@^0.1.1`.
- Standardize the field name as `thumbhash` (lowercase, no camelCase) in every
  surface — DB columns, JSON keys inside `images`, Zod schemas, api-client
  models, webhook models, frontend types. Aligns with haklex's existing field
  name and avoids the wire `blur_hash`/`blurHash` case-transform branch.
- All new writes produce `thumbhash`. No backfill of old data.
- Old images with no `thumbhash` fall back to the existing `accent` color block
  as the placeholder. No "no placeholder" gap.
- Single coordinated release across four repos (mx-core, packages/*,
  admin-vue3, Yohaku) inside one maintenance window. No multi-phase
  compatibility shims.

## Non-goals

- Backfilling old data. Old blurhash strings are discarded; the corresponding
  images render with the `accent` fallback until they are re-saved.
- Async background re-computation of thumbhash for legacy images.
- Forward/backward compatibility code paths. After cutover, the frontend never
  reads `blurHash`/`blurhash` and the server never writes it.
- Rollback / reverse migration. Mitigation is rolling forward only.
- Changes to accent color extraction, swatch palette extraction, capture
  pipeline retry/quality logic, or sharp resize concurrency.
- SSR-injected placeholder dataURLs.

## Architecture overview

The pipeline shape is unchanged. Only the encoder, the field name, and the
client-side decoder change.

```
┌─────────────────────┐    sharp resize ≤100×100      ┌──────────────────────┐
│  source image bytes │ ──────────────────────────►  │  rgbaToThumbHash      │
└─────────────────────┘                              │  → Uint8Array         │
                                                     │  → base64 string      │
                                                     └──────────┬───────────┘
                                                                │
                                ┌───────────────────────────────┼──────────────────────────────┐
                                ▼                               ▼                              ▼
                       images jsonb              enrichment_captures.thumbhash       response meta.thumbhash
                       { thumbhash, accent,                    text                          (Zod)
                         width, height, ... }
                                │
                                ▼
                       wire (snake_case, key is already "thumbhash")
                                │
                                ▼
                       client: thumbHashToDataURL(base64ToUint8(hash))
                                │
                                ▼
                       <img src="data:image/png;base64,..." />  (placeholder)
                                │ on real image load
                                ▼
                       fade out → real <img>
```

## Field naming

- DB: `enrichment_captures.thumbhash text` (nullable).
- JSON inside `images`: `thumbhash` key (was `blurHash`, camel).
- Zod / TypeScript: `thumbhash?: string`.
- API wire: `thumbhash` (no case transform needed — already lowercase, single
  word).

Picking lowercase `thumbhash` matches the haklex editor stack and the
thumbhash npm package's own naming, and avoids both the `blur_hash` snake form
and the historical `blurHash` camel form.

## Data model

### Schema change — `packages/db-schema/src/schema/enrichment.ts`

```ts
export const enrichmentCaptures = pgTable('enrichment_captures', {
  // ...
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  thumbhash: text('thumbhash'),         // was: blurhash text
  palette: jsonb('palette').$type<EnrichmentImagePalette>(),
  // ...
})
```

### Schema change — `apps/core/src/shared/schema/image.schema.ts`

```ts
export const ImageSchema = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
  accent: zHexColor.optional(),
  type: z.string().optional(),
  src: zStrictUrl.optional(),
  thumbhash: z.string().optional(),     // was: blurHash
})
```

### Type change — `apps/core/src/shared/types/legacy-model.type.ts`

```ts
export interface ImageModel {
  // ...
  accent?: string
  thumbhash?: string                    // was: blurHash
}
```

### Migration — `0015_blurhash_to_thumbhash.sql`

Single forward migration, executed inside the maintenance window after both
mx-core replicas are stopped:

```sql
ALTER TABLE enrichment_captures DROP COLUMN blurhash;
ALTER TABLE enrichment_captures ADD COLUMN thumbhash text;

UPDATE posts SET images = (
  SELECT jsonb_agg(elem - 'blurHash')
  FROM jsonb_array_elements(images) elem
) WHERE images IS NOT NULL AND jsonb_typeof(images) = 'array';

UPDATE notes SET images = (
  SELECT jsonb_agg(elem - 'blurHash')
  FROM jsonb_array_elements(images) elem
) WHERE images IS NOT NULL AND jsonb_typeof(images) = 'array';

UPDATE pages SET images = (
  SELECT jsonb_agg(elem - 'blurHash')
  FROM jsonb_array_elements(images) elem
) WHERE images IS NOT NULL AND jsonb_typeof(images) = 'array';

UPDATE recently SET images = (
  SELECT jsonb_agg(elem - 'blurHash')
  FROM jsonb_array_elements(images) elem
) WHERE images IS NOT NULL AND jsonb_typeof(images) = 'array';
```

This is a destructive `DROP COLUMN`; `lint:migrations` will flag it. Allow with
an inline comment justifying the maintenance window. The mx-migration-author
expand-contract guidance does not apply here because the deploy plan stops both
replicas before running migrate.

## Server pipeline changes

### `apps/core/src/processors/helper/helper.image.service.ts`

- Replace `import { encode } from 'blurhash'` with
  `import { rgbaToThumbHash } from 'thumbhash'`.
- Rename helper `encodeImageToBlurhash` → `encodeImageToThumbhash`. New body:

  ```ts
  const encodeImageToThumbhash = (sharped: Sharp) =>
    new Promise<string>((resolve, reject) => {
      sharped
        .raw()
        .ensureAlpha()
        .resize(100, 100, { fit: 'inside' })   // was: 32, 32
        .toBuffer((err, buffer, { width, height }) => {
          if (err) return reject(err)
          const u8 = rgbaToThumbHash(width, height, buffer)
          resolve(Buffer.from(u8).toString('base64'))
        })
    })
  ```

- `getOnlineImageSizeAndMeta` returns `{ size, accent, thumbhash }` (was
  `blurHash`).
- The skip-recompute predicate at line 57 checks
  `['height', 'width', 'type', 'accent', 'thumbhash']`.
- The "no data" fallback at line 82 writes `thumbhash: undefined`.

### `apps/core/src/modules/enrichment/providers/image-meta.service.ts`

- `import { rgbaToThumbHash } from 'thumbhash'`.
- `ImageMeta.blurhash` → `ImageMeta.thumbhash`.
- `encodeBlurhash(sharped)` → `encodeThumbhash(sharped)` using the same
  100×100 pre-resize pattern as above.

### `apps/core/src/modules/enrichment/providers/open-graph/capture-pipeline.service.ts`

- `ProcessedCapture.blurhash` → `thumbhash`.
- Replace `encodeBlurhash` helper.
- Drop the `BLURHASH_SIZE / BLURHASH_COMP_X / BLURHASH_COMP_Y` constants;
  introduce a single `THUMBHASH_MAX_DIM = 100`.

### `apps/core/src/modules/enrichment/providers/open-graph/capture-storage.service.ts`

- `blurhash: processed.blurhash` → `thumbhash: processed.thumbhash`.

### `apps/core/src/modules/enrichment/enrichment-capture.repository.ts`

- All `blurhash` references (column, row mapper, upsert excluded clause) →
  `thumbhash`.

### `apps/core/src/modules/enrichment/enrichment.service.ts`

- `EnrichmentImageSchema.blurhash` → `thumbhash`.
- `EnrichmentScreenshotSchema.blurhash` → `thumbhash`.
- `captureImage = { ..., thumbhash: processed.thumbhash, ... }`.
- `enrichWithImageMeta`: `result.thumbnailImage.thumbhash = thumbhash`.

### `apps/core/src/modules/enrichment/enrichment.types.ts`

- `blurhash?` → `thumbhash?`.

### Deps — `apps/core/package.json`

- Remove `"blurhash": "2.0.5"`.
- Add `"thumbhash": "0.1.1"` (pinned to match the surrounding style in
  `apps/core/package.json`).

## API / cross-package contract changes

### `apps/core/src/common/response/meta.types.ts`

Both V2 response meta image schemas (image and capture) rename
`blurhash` → `thumbhash`.

### `packages/api-client/models/base.ts`

- `blurHash?` → `thumbhash?` (note: also drops the camelCase form; clients
  always read the wire-level `thumbhash`).

### `packages/api-client/models/enrichment.ts`

- `blurhash?` → `thumbhash?`.

### `packages/webhook/src/models.generated.ts`

- Auto-generated. Regenerate after mx-core type changes land via
  `bun scripts/extract-models.ts` from `packages/webhook/`.

### Case transform impact

`thumbhash` has no uppercase letters, so the response-side snake_case
conversion in `src/common/response/case-transform.ts` is a no-op on the
field. No `BypassCaseTransform` is required. The historical `blurHash` →
`blur_hash` translation is simply deleted.

## admin-vue3 changes

### `apps/admin/src/utils/image.ts`

- `import { rgbaToThumbHash } from 'thumbhash'`.
- Export `getThumbhash(imageObject: HTMLImageElement)` returning the base64
  string. The function:
  1. Downscales to ≤100×100 onto an offscreen canvas.
  2. `ctx.getImageData(0, 0, w, h).data` → `rgbaToThumbHash(w, h, rgba)`.
  3. `btoa(String.fromCharCode(...u8))` → base64.

### `apps/admin/src/models/base.ts`

- `blurHash?` → `thumbhash?`.

### `apps/admin/src/models/enrichment.ts`

- Both `blurhash` references → `thumbhash`.

### `apps/admin/src/components/drawer/components/image-detail-section.tsx`

- `import { thumbHashToDataURL } from 'thumbhash'`.
- Rename component `BlurHashPreview` → `ThumbhashPreview`.
  Implementation collapses from canvas+`decode`+`putImageData` to:

  ```tsx
  const ThumbhashPreview = defineComponent({
    props: { hash: { type: String, required: true } },
    setup(props) {
      const dataUrl = computed(() => {
        const u8 = Uint8Array.from(atob(props.hash), (c) => c.charCodeAt(0))
        return thumbHashToDataURL(u8)
      })
      return () => <img src={dataUrl.value} alt="Thumbhash preview" />
    },
  })
  ```

- Existing image-info reads `thumbhash` instead of `blurHash`.
- UI label `"BlurHash 预览"` → `"Thumbhash 预览"`.

### `packages/rich-react/src/types.ts`

- `blurhash?` → `thumbhash?`.

### Deps — `apps/admin/package.json`

- Remove `blurhash`. Add `thumbhash`.

## Yohaku changes

A shared placeholder primitive replaces every per-component blurhash render
site. New file `apps/web/src/components/ui/image/ImagePlaceholder.tsx`:

```tsx
import { thumbHashToDataURL } from 'thumbhash'

type Props = {
  thumbhash?: string
  accent?: string
  width?: number
  height?: number
  className?: string
}

export function ImagePlaceholder({
  thumbhash,
  accent,
  width,
  height,
  className,
}: Props) {
  if (thumbhash) {
    const u8 = Uint8Array.from(atob(thumbhash), (c) => c.charCodeAt(0))
    const src = thumbHashToDataURL(u8)
    return (
      <img
        src={src}
        alt=""
        width={width}
        height={height}
        className={className}
        aria-hidden
      />
    )
  }
  if (accent) {
    return (
      <div
        className={className}
        style={{ background: accent, width, height }}
        aria-hidden
      />
    )
  }
  return null
}
```

### Sites to migrate

- `apps/web/src/models/writing.ts` — `blurhash?` → `thumbhash?`.
- `apps/web/src/components/ui/markdown/renderers/image.tsx` — remove
  `react-blurhash`; render `<ImagePlaceholder thumbhash={...} accent={...} />`.
- `apps/web/src/components/ui/link-card/variants/atoms/OgThumbnail.tsx` and
  `WideOgMedia.tsx` — same swap.
- `apps/web/src/components/ui/link-card/variants/atoms/media-source.ts` —
  rename `blurhash?` → `thumbhash?`.
- `apps/web/src/components/ui/link-card/variants/PosterCard.tsx` — two
  blurhash render sites, both via `ImagePlaceholder`.
- `apps/web/src/components/ui/image/ZoomedImage.tsx` — `imageMeta.blurHash`
  → `imageMeta.thumbhash`; render via `ImagePlaceholder`.
- `apps/web/src/components/common/ScrollImageVeil/index.tsx` and
  `styles.ts`:
  - Delete `BlurHashCanvas` and `import { decode } from 'blurhash'`.
  - Type guard `hasBlurHash` → `hasThumbhash`:
    `!!img.src && (!!img.accent || !!img.thumbhash)`.
  - Render via `<ImagePlaceholder>` (or inline equivalent when the veil
    structure forbids a wrapper).
  - Data attribute `data-veil-blurhash` → `data-veil-thumbhash` and CSS
    selectors update.
- `apps/web/src/lib/image.ts` — encoder rewritten on top of `rgbaToThumbHash`.

### Tests

`OgThumbnail.test.tsx` and `WideOgMedia.test.tsx` update fixture field names
and assert presence of the `ImagePlaceholder`-rendered `<img>` (e.g. by
`aria-hidden` attribute or `data-testid="image-placeholder"`).

### Deps — `apps/web/package.json`

- Remove `blurhash`, `react-blurhash`.
- Add `thumbhash`.

## Testing

### mx-core unit & integration

- `test/mock/processors/file.mock.ts`, all
  `test/src/modules/enrichment/**/*.spec.ts`, and
  `test/src/modules/ai/real-world-lexical-data.ts` rename fixture fields to
  `thumbhash`.
- `test/src/modules/enrichment/capture-pipeline.service.spec.ts` switches
  `import { decode } from 'blurhash'` to
  `import { thumbHashToRGBA } from 'thumbhash'` and asserts the decoded RGBA
  canvas is non-trivial (any non-zero variance across pixels).

### Migration spec

New file
`test/src/database/app-migrations/20260528-blurhash-to-thumbhash.spec.ts`:

- Seeds an `enrichment_captures` row with `blurhash = 'LKO2?U%2'`.
- Seeds a `posts` row whose `images` jsonb contains
  `[{ src: 'x', blurHash: 'abc', accent: '#fff' }]`.
- Runs the migration.
- Asserts:
  - `enrichment_captures.blurhash` column is gone, `thumbhash` exists and is
    `NULL` for the seeded row.
  - `posts.images[0]` no longer contains a `blurHash` key, but `src` and
    `accent` survive.

### Historical migration spec

`test/src/database/app-migrations/20260512-enrichment-captures.spec.ts`
asserts the historical schema shape and is **not** updated; it must keep
showing the `blurhash` column to validate the older migration.

### lint:migrations

`pnpm -C apps/core run lint:migrations` will flag the destructive
`DROP COLUMN`. Suppress with an inline allow-list comment explaining the
maintenance-window justification.

## Deploy plan

Single coordinated release inside a planned maintenance window
(estimated 5-10 minutes).

1. Land four PRs (mx-core, packages/api-client+webhook, admin-vue3, Yohaku)
   with all checks green.
2. Publish `@mx-space/api-client` and `@mx-space/webhook` to npm.
3. Pre-build docker images for mx-core and any other server-side artifacts.
4. Enable maintenance page on the public surface (Yohaku) and admin
   (admin-vue3).
5. Stop both `mx-core` replicas in Dokploy.
6. Run `pnpm -C apps/core run migrate` against production Postgres.
7. Deploy the new `mx-core` image and start replicas.
8. Deploy admin-vue3.
9. Deploy Yohaku.
10. Disable maintenance page; verify a sample post and link-card render
    correctly (thumbhash placeholder visible on freshly-saved content,
    accent fallback visible on legacy content).

## Risks and mitigations

- **`react-blurhash` left in a transitive dep.** Mitigation: search `pnpm-lock.yaml` after dep removal; explicit override if any indirect dep still pulls it.
- **Legacy posts look bare during the period before they're re-saved.** Mitigation: accent color fallback (already widely populated). Visually degraded but never blank.
- **Migration window underestimated.** The four `UPDATE` statements scan every row of `images jsonb`. On the production-scale dataset this is bounded (tens of thousands of rows max); no online concurrent writes during the window. Acceptable.
- **Auto-generated `webhook/models.generated.ts` forgotten.** Mitigation: PR checklist item to run `bun scripts/extract-models.ts` and commit the result. CI should diff against generated output.

## Out of scope

- Backfill / regeneration of thumbhash for legacy images.
- Async background re-compute job.
- Rollback / reverse migration.
- Accent color algorithm changes.
- Swatch palette changes.
- SSR-injected dataURL placeholders.
- Forward/backward compatibility shims.
