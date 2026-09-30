## TL;DR

Publishing now lets you decide, per AI resource, whether the article waits for it, and several file-management screens in the dashboard behave correctly again.

## Highlights

Each AI resource attached to a publish job can now run before or after the article goes live. Resources marked to run before publishing are ready when readers first see the post; resources marked to run after never block publishing. The publish dialog offers skip, before, or after for each resource and remembers your last choice, and `mxs draft publish` accepts the same choice, for example `--ai summary:sync,insights`.

Automatic translation has been removed. The server no longer creates translation entries or regenerates stale translations on its own; both remain available as manual actions in the dashboard.

The orphan files page now updates its detail pane as soon as a reference reconcile is applied, shows progress while references are being checked or applied, and its header buttons share one style. File previews no longer stay black when the image was already loaded in the list.

## Changes

### Features
- Choose per AI resource whether publishing waits for it or generates it afterwards ([fe1ffe4](https://github.com/mx-space/core/commit/fe1ffe4047b71af0cf5e590f36c4e8322eb1cc34))

### Bug Fixes
- Math formulas render again in the dashboard editor with the updated rich editor packages ([2721a5c](https://github.com/mx-space/core/commit/2721a5c681ba589ee1c3510558a8eb60e04108a6))
- File detail previews show the image instead of a black box when it was already cached ([5fdbca4](https://github.com/mx-space/core/commit/5fdbca4de))
- The orphan files detail pane refreshes after a reconcile, and checking or applying references shows progress ([bcfa729](https://github.com/mx-space/core/commit/bcfa72944))

### Other
- Rich editor packages updated to `@haklex/*` 0.44.1 ([236e21f](https://github.com/mx-space/core/commit/236e21f11babed71f0c8901439f49a723d4b1ae7))

## Upgrade Notes

- The `enableAutoGenerateTranslation` setting has been removed. If you relied on it, trigger translations manually from the dashboard after publishing.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.15.0...v14.15.1
