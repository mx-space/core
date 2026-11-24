## TL;DR

The admin editor now loads and shows chart blocks, and a draft with a block the editor does not know no longer loses content.

## Highlights

Drafts can carry the native chart block that haklex added for bar, line, area, pie and scatter charts. The write page registers it in both the editor and the read-only renderer, so a draft written through `mxs` or LiteXML with a `<chart>` block opens with its chart drawn instead of failing to load.

Opening a draft whose content includes a block type the editor does not register used to drop that block, and every block the editor could not build, from the shared draft on the next keystroke. The collaboration layer now keeps those blocks in place and the editor skips them, so the stored draft stays complete.

## Changes

### Features

- The admin rich editor and renderer load chart blocks. ([3c285db](https://github.com/mx-space/core/commit/3c285dbf1))

### Bug Fixes

- A draft containing a block the editor cannot build keeps that block and everything after it when someone edits it in the write page; haklex 0.67.3. ([94c212d](https://github.com/mx-space/core/commit/94c212d7d))

### Other

- The bundled editor and `mxs` use haklex 0.67.2 and 0.67.3, whose bundled LiteXML authoring guide documents chart and steps blocks. ([8d8e78a](https://github.com/mx-space/core/commit/8d8e78a3d))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v18.2.4...v18.2.5
