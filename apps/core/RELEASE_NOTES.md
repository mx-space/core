## TL;DR

The admin rich editor can now upload video files directly — drag-drop, paste, or pick a file — with progress and S3 streaming support.

## Highlights

Videos no longer have to live on an external host before they can appear in a post. Dropping or pasting a video file into the editor uploads it and inserts a playable video block, and the `/video` dialog gains an Upload button next to the URL field. Large files show a live percentage while uploading.

Storage follows your existing upload configuration. With S3 storage enabled, videos stream to the bucket via multipart upload — no size limit and no full-file buffering in server memory. On local-disk storage, a new `videoMaxSize` option (default 100MB, under File upload settings) caps uploads; oversized or truncated transfers are rejected with a 413 and the partial file is cleaned up.

## Changes

### Features

- Upload videos from the admin editor via drag-drop, paste, or the `/video` dialog, with upload progress. Server side adds a `video` file type, S3 multipart streaming, and a configurable local-storage size limit. ([4d0194c](https://github.com/mx-space/core/commit/4d0194c5fb4042ea0f0e2ade348041cc7aec0dfb))

### Bug Fixes

- Accepting an AI agent suggestion in the editor no longer double-applies the change when the inline diff overlay is active. ([400544b](https://github.com/mx-space/core/commit/400544b8508221d8a8e23ed4e738b8f220131429))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.8.0...v13.9.0
