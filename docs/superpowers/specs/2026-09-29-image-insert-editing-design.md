# Image pre-insert review & editing

Date: 2026-09-29
UI mockups: https://claude.ai/artifact/Fxiq2HfhQyrGqieMFmBCWF

## Goal

Every image entering the Lexical editor — paste, drop, slash/toolbar dialog, replace, gallery — passes one review sheet before upload. From the sheet the author can insert directly, open a full-screen editor (crop, resize, annotate, mosaic/blur), drop images, or strip GPS.

## Decisions

- Entry: a light sheet first; the full editor only on demand.
- Multi-image gestures: one sheet listing every image.
- Redaction: mosaic, with blur as an option (strong minimum radius).
- Resize: long-edge presets inside the editor, shrink only.
- Ownership: UI lives in haklex `@haklex/rich-plugin-image-editor`; admin injects a GPS adapter (exifr + exiftool wasm stay in admin).
- The editor no longer uploads. Primary button is **Done** (back to the sheet); "Upload without editing" is removed.
- UI copy stays English, like the rest of haklex.

## haklex changes

### `@haklex/rich-editor` — batch preprocess hook (breaking)

```ts
type ImagePreprocessSource = 'drop' | 'paste' | 'dialog' | 'replace' | 'gallery'
type ImagePreprocessFn = (
  files: File[],
  meta: { source: ImagePreprocessSource },
) => Promise<File[] | null>
```

- `null` cancels the gesture. A shorter array means rows were removed. Returning the input unchanged replaces the old `'skip'`.
- `resolvePreprocessTargets` drops the single-file guard. On throw it still falls back to the original files and logs.
- `ImagePreprocessResult` and `'skip'` are removed. The only consumer is `rich-plugin-image-editor`, changed in the same release.
- Order is preserved: upload/insert iterate the returned array in order.

### Call sites routed through the hook

| Path | File | Source |
|---|---|---|
| Paste / drop | `rich-editor/src/plugins/ImageUploadPlugin.tsx` `handleFiles` | `paste` / `drop` |
| Dialog upload tab | same file, `handleDialogFile` | `dialog` |
| Replace image | `rich-renderer-image/src/useImageActions.ts` `handleReplaceFile` | `replace` (single file) |
| Gallery upload | `rich-ext-gallery/src/GalleryEditRenderer.tsx` | `gallery` |

URL insert stays outside (nothing to upload).

### `@haklex/rich-plugin-image-editor`

**`ImageInsertSheet`** (new): dialog via `presentDialog`, ~480 px single / ~560 px multi.

- One row per file: thumbnail (object URL), name, `W × H · size · type` (natural size decoded with `createImageBitmap`), **Edit…** / **Re-edit**, remove (icon button, `aria-label`).
- Edited rows show an `Edited` badge and a summary (cropped · n marks · n mosaic · long edge).
- `image/gif` and `image/svg+xml`: Edit disabled with a one-line reason (canvas export flattens them).
- GPS panel appears when `privacy.detectGps` finds coordinates in any original. Single image: coordinates plus a map link. Multi: "n of m". One checkbox, **checked by default**, applies to all.
- Keys: Enter = Insert, Esc = Cancel. Removing the last row equals Cancel.

**`ImageEditModal`** (changed):

- `onSkip` is removed. Footer: long-edge size menu (left), Discard edits, Done.
- New tool `mosaic`: drag a rectangle; the option bar toggles Pixelate / Blur plus a strength slider (pixelate block 8–48 px, default 16; blur radius floor 12 px). Applied destructively to the bitmap the same way a crop rebase is. Each application pushes the prior bitmap URL onto an undo stack. Marker state is unchanged because geometry does not move.
- Size menu: Original / 3840 / 2560 / 1920 / 1280 / custom. Computed from the current (cropped) size. Presets ≥ the current long edge are disabled. Applied last in `exportResult` via a single `drawImage` scale (`imageSmoothingQuality = 'high'`).
- `exportResult` gains `maxLongEdge?: number` and exports whenever a crop, markers, mosaic, or resize is present.

**`ImageEditModalPlugin`** (changed):

```ts
interface ImageEditPrivacy {
  detectGps: (file: File) => Promise<{ latitude: number; longitude: number } | null>
  stripGps: (file: File) => Promise<File>
}
<ImageEditModalPlugin privacy={privacy} />
```

It registers the batch preprocessor: open the sheet → Edit stacks the editor dialog above it → Done replaces that row's file and summary. On Insert:

1. For each row: edited → the exported file (canvas output carries no EXIF). Unedited with GPS and the box checked → `privacy.stripGps(original)`.
2. Resolve with the files in row order.

### Release

Minor bump across haklex (breaking preprocess signature). Use the release-orchestrator flow, then bump admin's pinned `@haklex/*` versions.

## admin changes

1. Add `@haklex/rich-plugin-image-editor` at the new version; import `@haklex/rich-plugin-image-editor/style.css` where other haklex styles are imported.
2. `lib/image-upload-privacy.tsx`: export `imageGpsPrivacy = { detectGps: readGpsLocation, stripGps: stripGpsMetadata }`. `prepareImageFileForUpload` stays for the CodeMirror editor.
3. `vendor/rich-editor/components/ReactEditorPane.tsx`: mount `<ImageEditModalPlugin privacy={imageGpsPrivacy} />` as a child of `<RichEditor>`.
4. `features/write/components/WriteRouteViewsContent.tsx` `imageUpload`: drop `prepareImageFileForUpload`; upload the file as given.

## Error handling

| Failure | Behaviour |
|---|---|
| Image cannot decode in the sheet | Row shows a generic tile, Edit disabled, still insertable |
| `detectGps` throws | Treated as no GPS (current behaviour) |
| `stripGps` fails for a row | Toast; the sheet stays open with that row flagged; Insert is blocked until the author unticks the box or removes the row. Never uploads GPS silently. |
| Editor export fails | Toast; stay in the editor with edits intact |
| Preprocessor throws unexpectedly | Existing fallback: original files upload (logged) |

## Testing

- haklex unit (vitest): `resolvePreprocessTargets` covering null, a subset, reordering, and throw; pixelate/blur region math on a small canvas; long-edge scale math including the disabled-preset rule.
- haklex component: the sheet resolves the right file list for insert / cancel / remove / edit-then-insert, and the GPS strip is called only for unedited rows with the box checked.
- admin: manual check in the write page covering paste of one photo with GPS, drop of 3 files, slash dialog, replace, and gallery. Check the uploaded file's EXIF has no GPS (`exiftool -gps:all`).

## Out of scope

- Nested-doc dialog editors and other `RichEditor` instances unless they already share `ReactEditorPane`.
- Compression and format conversion.
- Freehand mosaic brush.
- Server-side EXIF stripping.
