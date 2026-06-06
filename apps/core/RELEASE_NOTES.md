## TL;DR

Admin rich editor now accepts a dropped `.gpx` file and inserts a ready-to-render map node, with stop-detection parameters tunable from the insert dialog.

## Highlights

The map extension previously required clicking through a slash-menu picker to add a track; now the editor catches drag-and-drop and paste of `.gpx` files directly, parses the GPS points client-side, compresses them via the existing stop-detection pipeline, uploads the resulting JSON track, and inserts the map node — all behind a single toast. The `InsertMapDialog` was also rewritten so the upload only happens when you click Insert, not the moment you pick a file, and exposes the two stop-detection knobs (cluster radius in metres and minimum dwell in minutes) that used to be hard-coded constants.

The editor surface in `Write` grows to fill the visible viewport, so the drop target is large enough to land a file on without precision-aiming the toolbar strip.

## Changes

### Features

- Drag a `.gpx` file onto the rich editor to insert a map node — same compression and stop-detection pipeline as the existing dialog. ([9174971](https://github.com/mx-space/core/commit/9174971ef917020a394c01dfbbaf15716047f105))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.5.1...v13.5.2
