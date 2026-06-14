## TL;DR

Restores the `search` filter on the admin's grouped AI translations view and rolls up four `@haklex/*` bumps that eliminate the duplicated Lexical runtime breaking the admin's rich editor.

## Highlights

The admin's AI translations dashboard now honors its search box on the grouped view — previously the `search` query parameter was silently dropped, returning every group regardless of input. The grouped insights and summaries endpoints now also resolve shared titles for pages, matching the behavior already in place for posts and notes.

The bundled `apps/admin` picks up `@haklex/*` 0.26.6, the culmination of four upstream releases that migrate every `@haklex/*` extension's `@lexical/react` to a peer dependency. This collapses the duplicated Lexical runtime that was throwing "Minified Lexical error #8" whenever a rich-ext-chat (or code-snippet, poll) node was inserted into the editor. The 0.26.3 line additionally adds drag-and-drop file upload inside the rich-ext-gallery editor dialog.

## Changes

### Bug Fixes
- **core:** honor `search` query parameter on the grouped AI translations endpoint, and broaden grouped insights/summaries title lookup to cover pages ([d0d9f8c](https://github.com/mx-space/core/commit/d0d9f8cb8785ffbe351ca7c3dc9688509cbef2aa))

### Other
- **admin:** bump `@haklex/*` to 0.26.6 — resolves "Minified Lexical error #8" thrown by ChatEditRenderer when inserting rich-ext-chat / code-snippet / poll nodes; adds drag-and-drop file upload in the rich-ext-gallery editor dialog ([84d9726](https://github.com/mx-space/core/commit/84d972652), [85769bf](https://github.com/mx-space/core/commit/85769bf3c), [4121789](https://github.com/mx-space/core/commit/4121789a3), [043bb43](https://github.com/mx-space/core/commit/043bb43f4))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.10.6...v13.10.7
