## TL;DR

Auto-translation now creates dictionary entries for every target language, and the admin editor's AI agent no longer re-issues edits it already staged.

## Changes

- **AI translation**: auto-generated dictionary entries were deduplicated across languages, so only the first target language received them; dedupe is now scoped per language. ([150d5ad](https://github.com/mx-space/core/commit/150d5ad927f752015afdff78a682ce4f6d40f281))
- **Admin editor agent**: bumped `@haklex/*` to 0.39.7 — `search_document` now reflects staged edits and tool results state that edits await review, so the agent stops repeating the same `replace_node` and stops guessing it picked the wrong document. ([2ddfffb](https://github.com/mx-space/core/commit/2ddfffb28))
- **mxs author**: `--base` renders changed blocks as inline diff notes with Accept/Reject, and watched files merge external revisions three-way at block level. ([22bc538](https://github.com/mx-space/core/commit/22bc53820127e742d2746367afe9ebb2a5b02aff))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.10.4...v14.10.5
