## TL;DR

Fixes admin editor regressions: whiteboards are editable again, long documents get their editing tools back, and selected text is highlighted once.

## Changes

- Long documents (200+ blocks) show the block handle, floating toolbar, link editor and table handles again, and nested docs inserted from the slash menu land at the caret instead of the end of the document ([af36344](https://github.com/mx-space/core/commit/af363445175476137b640cf9d02a470cddc75a33))
- Excalidraw whiteboards and dynamic components regain their Edit entry when the editor unlocks after a collaborative session finishes loading; in long documents, blocks can be dragged, moved up or down and inserted between, inline math, mentions and inline files can be dragged between blocks with one-step undo, and selected text no longer shows a doubled highlight, via `@haklex/*` 0.64.0 ([d445e2b](https://github.com/mx-space/core/commit/d445e2b568ec46a49786cba7ab6aa2245897efaa))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v17.0.0...v17.0.1
