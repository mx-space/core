# Admin Rich Editor Video Upload — Design

Date: 2026-06-10
Status: Approved

## Problem

The admin lexical editor (haklex) can render and embed videos (`VideoNode` +
`@haklex/rich-renderer-video`), but the only way to add one is the slash-menu
`Video` command followed by manually pasting a URL. There is no way to upload
a local video file. Drag-drop/paste upload is handled exclusively by
`ImageUploadPlugin`, which only accepts `image/*`. The server's
`FileTypeEnum` has no `video` type, and the global fastify multipart limit is
6MB — far below any real video.

## Goals

- Upload a local video file from the editor via drag-drop, paste, or a file
  picker in the video URL dialog.
- Show upload progress (percentage) — videos are large and a spinner alone
  reads as a hang.
- Store videos through the existing `/files/upload` pipeline: S3 when
  external storage is enabled, local disk otherwise.
- No size limit when external (S3) storage is enabled; configurable limit
  (default 100MB) for local-disk storage.

## Non-Goals

- Automatic poster (cover frame) generation. The `poster` field in
  `VideoEditRenderer` stays manual. May revisit later.
- Video transcoding, thumbnails, or streaming-protocol (HLS/DASH) support.
- Changing the global 6MB multipart limit for other routes.

## Design

### 1. haklex (`../haklex`, separate repo)

New editor prop, parallel to `imageUpload`:

```ts
videoUpload?: (
  file: File,
  opts?: { onProgress?: (percent: number) => void },
) => Promise<{ src: string }>
```

- **Drag-drop / paste**: generalize the `DRAG_DROP_PASTE` handling (extend
  `ImageUploadPlugin` or add a sibling `VideoUploadPlugin` sharing the
  listener). When a dropped/pasted file matches `video/*` and `videoUpload`
  is provided, upload it and insert `$createVideoNode({ src })` on success.
  When `videoUpload` is absent, behavior is unchanged (video files ignored).
- **Progress placeholder**: while uploading, render a placeholder block
  showing the percentage driven by `onProgress`. On failure, remove the
  placeholder and surface the error (same channel as image upload failures).
- **Upload button in the URL dialog**: `VideoEditRenderer`'s popover gains an
  "Upload file" button (file picker, `accept="video/*"`) shown only when
  `videoUpload` is configured. The callback reaches the renderer package via
  the editor config/context, the same way other editor-level config is
  plumbed to renderers.
- Slash menu `/video` is unchanged: inserts an empty node; the popover then
  offers URL input or file upload.

### 2. mx-core server (`apps/core`)

- **`FileTypeEnum` gains `video`** (`modules/file/file.type.ts`). Local
  files land in `STATIC_FILE_DIR/video/` via the existing
  `resolveFilePath`.
- **S3 routing** (`file.controller.ts` upload handler): the condition
  `s3Enabled && (type === 'image' || type === 'file')` extends to include
  `'video'`.
- **Size limits**:
  - `FileUploadOptionsSchema` (configs) gains `videoMaxSize` — number, MB,
    default 100. Applied only on the local-disk path via
    `getAndValidMultipartField(req, { maxFileSize })`, which overrides the
    global 6MB fastify limit per-request.
  - S3 path: no size limit for `type === 'video'`.
- **Streaming S3 upload**: the current S3 path buffers the whole file
  (`Buffer.concat`) before `uploadBuffer`. For `video`, switch to a
  streaming upload (S3 multipart upload in `S3Uploader`) so a multi-hundred-MB
  file does not sit in memory. Other types keep the buffer path.
- Server-side MIME check: accept `video/*` by extension/MIME lookup for
  `type=video`, consistent with how other types are validated.

### 3. admin (`apps/admin`)

Wire the new prop where `imageUpload`/`trackUpload` are wired
(`WriteRouteViewsContent.tsx`, and the rich-debug view):

```ts
videoUpload: async (file, opts) => {
  const result = await uploadFileWithProgress(file, {
    type: 'video',
    onProgress: (p) => opts?.onProgress?.(p),
  })
  return { src: result.url }
}
```

`build-rich-editor-props.ts` and `types.ts` in
`apps/admin/src/vendor/rich-editor/` add the `videoUpload` passthrough,
mirroring `trackUpload`.

## Error Handling

- Local upload over `videoMaxSize` → server rejects (413 / AppException) →
  admin surfaces a toast; editor removes the placeholder.
- Network failure / S3 error mid-upload → same placeholder-removal + toast
  path.
- S3 enabled but misconfigured (missing endpoint/keys) → existing
  `FILE_STORAGE_NOT_CONFIGURED` error propagates.

## Testing

- haklex: unit tests for MIME routing in the drag-drop/paste handler
  (image vs video vs ignored), and placeholder lifecycle (success, failure).
- core: e2e for `POST /files/upload?type=video` — local path respects
  `videoMaxSize`, S3 path bypasses the limit (S3 mocked), `video` lands in
  the right directory locally.
- admin: typecheck + extend `build-rich-editor-props.test.ts` for the new
  passthrough.

## Rollout

1. Implement and release `@haklex/*` (minor bump).
2. Bump the pinned `@haklex/*` versions in mx-core.
3. Land core changes (`FileTypeEnum`, config, controller, S3 streaming).
4. Wire admin `videoUpload`.
