## TL;DR

Every image added to the rich editor now opens a review sheet for cropping, redaction, resizing and GPS removal, and uploads never overwrite existing files.

## Highlights

Pasting, dropping, inserting from the toolbar or slash menu, replacing an image, or adding one to a gallery now opens a review sheet before anything is uploaded. From the sheet you can insert as-is, remove images from the batch, or open a full-screen editor. The editor can crop, annotate, pixelate or blur sensitive areas, and shrink the long edge to a preset size. Multiple images share one sheet and are inserted in the order shown.

Location data is handled in the sheet as well. When a photo records where it was taken, the sheet shows the coordinates, and "Remove location" is ticked by default. Images you edit are re-encoded without any metadata. If GPS stripping fails, the image is held back instead of being uploaded with its location.

Stored uploads are now immutable. A custom naming template such as `{name}{ext}`, or clipboard pastes that are always called `image.png`, could previously reuse an object key and silently replace a published image on R2. Each upload now checks whether its key is taken and adds a short suffix when it is.

## Changes

### Features
- Review, edit (crop, annotate, mosaic or blur, resize) and strip GPS from images before they are inserted into the editor ([#2828](https://github.com/mx-space/core/pull/2828))
- The sheet says "Replace image" when it was opened to replace an existing image ([#2828](https://github.com/mx-space/core/pull/2828))

### Bug Fixes
- Uploads no longer overwrite an existing S3 or local file when two uploads resolve to the same name; local uploads with a taken name now succeed instead of failing ([#2828](https://github.com/mx-space/core/pull/2828))
- Server shutdown no longer hangs on the database pool; closing it now times out after 5 seconds ([#2827](https://github.com/mx-space/core/pull/2827))
- Comment image uploads are rejected up front when they are disabled, before any quota checks run ([#2827](https://github.com/mx-space/core/pull/2827))

### Other
- The unused `PUT /files/:type/:name` endpoint, which overwrote files in place, has been removed ([#2828](https://github.com/mx-space/core/pull/2828))
- Rich editor packages updated to `@haklex/*` 0.43.2 ([#2828](https://github.com/mx-space/core/pull/2828))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.14.5...v14.15.0
