# AfilmoryNode: Embed dimension snapshots for layout stability

**Date:** 2026-06-08
**Status:** Approved
**Scope:** Editor extension shared between `apps/admin` (mx-core) and `apps/web` (Yohaku)

## Problem

`AfilmoryNode` stores only references to afilmory assets (a list of ids, or a
filter query). At render time both the admin editor and the Yohaku frontend
fetch the afilmory manifest to resolve each id's `width`, `height`, and
`thumbHash`. Before the manifest resolves, every photo slot collapses to a
default `3/2` aspect ratio. Once the manifest arrives, slots resize to the
real aspect and the surrounding layout jumps (CLS). The thumbHash placeholder
is also unavailable until the manifest fetch completes.

The afilmory editor block has not shipped yet — there is no `v1` lexical
data in production — so the schema can be redesigned freely without
backward compatibility.

## Goal

Embed enough per-photo metadata directly into the lexical node so the
first render frame already knows the correct aspect ratio and can show a
thumbHash blur placeholder, with **zero layout shift** once the manifest
fetch completes.

Manifest fetching itself is *not* eliminated — the renderer still needs
exif, title, description, originalUrl/thumbnailUrl for the richer Polaroid
and Gallery views. The fetch becomes non-blocking for layout.

## Non-goals

- `source.kind === 'filter'` is excluded. Filter sources are dynamic
  aggregates; snapshotting their resolved ids would defeat the purpose of
  the filter. Filter blocks keep their current skeleton/spinner behavior.
- Stale-data reconciliation. If a photo's dimensions change after a node
  is inserted, the snapshot becomes stale. The user must re-open the
  insert dialog to refresh. No automatic refetch-and-rewrite is planned.
- haklex `$toMarkdown` conversion is unaffected.

## Design

### Schema change — both packages

Edit `afilmory-augment.ts` in **both** apps:

- `apps/admin/src/vendor/rich-editor/extensions/afilmory/afilmory-augment.ts`
- `apps/web/src/components/ui/rich-content/afilmory/afilmory-augment.ts`

```ts
export type AfilmoryListItem = {
  id: string
  w: number
  h: number
  hash?: string
}

export type AfilmorySource =
  | { kind: 'list'; items: AfilmoryListItem[] }
  | { kind: 'filter'; filter: AfilmoryFilter }
```

The previous `ids: string[]` shape is removed entirely. `w` and `h` are
required (a snapshot without dimensions is meaningless). `hash` is
optional because some afilmory photos legitimately have no thumbHash.

`SerializedAfilmoryNode.version` stays at `1` — the feature is unshipped,
so there is no v1 data to differentiate from. `importJSON` recognizes only
the new shape; older drafts that contain the previous `ids` shape will
fail to parse (acceptable per scope).

`AfilmorySlotProps` propagates the same `source` type so renderers see
`items` directly. No new top-level prop is introduced.

### Insert / edit flow (admin only)

`InsertAfilmoryDialog` already fetches the afilmory manifest to drive the
picker. When the user confirms, the dialog's `onSubmit` builds the
payload by mapping each selected id to its photo entry in the manifest
and producing `items: [{ id, w: photo.width, h: photo.height, hash: photo.thumbHash }]`.

`AfilmoryBlockConnected.handleEdit` follows the same path on subsequent
edits — `openAfilmoryDialog` returns a fresh payload built from the
manifest, so `items` is always re-derived from the current manifest at
edit time.

If a selected id is missing from the manifest (shouldn't happen with a
well-formed picker, but handle defensively), the dialog must surface an
error rather than emit a sentinel — every emitted item must have valid
`w` and `h`.

### Admin renderer

`AfilmoryBlock` and `SingleBlock` in
`apps/admin/src/vendor/rich-editor/extensions/afilmory/AfilmoryBlock.tsx`
already compute `aspectRatio` from the fetched manifest photo. They now
read `aspectRatio = w / h` from `source.items[i]` directly so the layout
is correct on the first paint, even before the manifest query resolves.
The manifest fetch continues to run (it provides `thumbnailUrl`, `title`,
`description`, exif, etc.) and fills in the actual `<img>` once available.

No lazy backfill is needed — the data is always populated at insert time.

### Yohaku renderer

In `apps/web/src/components/ui/rich-content/afilmory/AfilmoryRenderer.tsx`:

- `AfilmoryPolaroidView` reads `w/h` from `source.items[0]` to set the
  shell's `aspectRatio` before any fetch. If `items[0].hash` is present,
  the loading state renders
  `<ImagePlaceholder thumbhash={items[0].hash} />` inside the polaroid
  frame instead of the current `animate-pulse` gray slab.
  `ImagePlaceholder` is the existing helper at
  `apps/web/src/components/ui/image/ImagePlaceholder.tsx` (already
  depends on `thumbhash@0.1.1`).
- `AfilmoryGalleryView` (list mode only) renders each tile with its
  per-item `aspectRatio` and `hash` placeholder during loading, replacing
  the `SkeletonGrid` for the list case. Filter mode keeps the existing
  `SkeletonGrid` since `items` is absent.
- The manifest fetch still runs for everything else (exif, captions,
  view-all hrefs); the live `<img>` swaps in over the placeholder.

`useCollectionPhotos` / `useAfilmoryPhotosByIds` continue to drive the
fetched-photo render path — only the loading/placeholder layer changes.

### What does NOT change

- `baseUrl`, `layout`, `limit`, `title`, `caption`, `alt`, `accent` — all
  preserved.
- Filter source path (admin & Yohaku).
- Manifest hooks (`useAfilmoryPhotoDirect`, `useAfilmoryPhotosByIds`,
  `useAfilmoryPhotosSearch`).
- `$toMarkdown` / SSR pipeline.
- afilmory-bridge dialog wiring.

## Files touched

**mx-core (admin):**
- `apps/admin/src/vendor/rich-editor/extensions/afilmory/afilmory-augment.ts` — type change
- `apps/admin/src/vendor/rich-editor/extensions/afilmory/AfilmoryNode.ts` — `SerializedAfilmoryNode`, `importJSON`, `exportJSON`, `decorate` slot props
- `apps/admin/src/vendor/rich-editor/extensions/afilmory/afilmory-bridge.ts` — `AfilmoryPayload` carries `items`
- `apps/admin/src/vendor/rich-editor/extensions/afilmory/InsertAfilmoryDialog.tsx` — `onSubmit` builds `items` from manifest photo map
- `apps/admin/src/vendor/rich-editor/extensions/afilmory/AfilmoryBlock.tsx` — read `aspectRatio` from items, drop dependency on fetched photo for layout
- `apps/admin/src/vendor/rich-editor/extensions/afilmory/picker-helpers.tsx` — adjust if it emits selection payload (verify during implementation)

**Yohaku (apps/web):**
- `apps/web/src/components/ui/rich-content/afilmory/afilmory-augment.ts` — mirror type change
- `apps/web/src/components/ui/rich-content/afilmory/afilmory-node.ts` — `SerializedAfilmoryNode`, `importJSON`, `exportJSON`
- `apps/web/src/components/ui/rich-content/afilmory/AfilmoryRenderer.tsx` — Polaroid + Gallery views consume `items`
- `apps/web/src/app/[locale]/(dev)/lexical/afilmory/_fixtures.ts` — update dev fixtures to new shape

## Testing

**Admin:**
- `InsertAfilmoryDialog` onSubmit unit test — emits `items` with correct
  ordering, both with and without `hash`.
- `AfilmoryBlock` snapshot — `aspectRatio` set from `items[i]` on first
  render before manifest mock resolves.

**Yohaku:**
- `AfilmoryPolaroidView` — first-frame aspectRatio equals `w/h` from
  `items[0]`; `<ImagePlaceholder>` renders when `hash` present, gray
  fallback when absent.
- `AfilmoryGalleryView` (list mode) — every tile pre-allocates correct
  aspectRatio.
- Filter mode — unchanged behavior, `SkeletonGrid` still shown.
- Mock `useAfilmoryPhotoDirect` with a controllable promise; assert the
  outer `aspectRatio` does not change between pre-resolve and
  post-resolve frames (i.e. no layout shift).

## Dependencies

- No new npm dependencies. Yohaku already has `thumbhash@0.1.1` and
  `ImagePlaceholder`.

## Open implementation questions (resolve during writing-plans)

- Does `AfilmoryPayload` (in `afilmory-bridge.ts`) need to grow `items`
  too, or does the bridge just forward `source` opaquely? Verify when
  editing.
- Whether `picker-helpers.tsx` builds the `items` list or the dialog
  does — needs a brief read during implementation.
- Confirm there are no other afilmory consumers in the mx-core monorepo
  besides admin (e.g. server-side lexical processing for AI translation
  or summary jobs).
