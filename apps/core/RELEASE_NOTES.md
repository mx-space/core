## TL;DR

The admin write agent now edits posts through a sandboxed virtual shell over the document, with a more reliable review overlay.

## Highlights

The AI write agent in the admin editor no longer calls per-node insert/replace/delete tools. It gets a virtual bash workspace where the post is mounted as `/doc.xml` and edits it with `cat`, `grep`, `sed` and heredocs. The result is diffed back by block id into the existing review overlay, so every change still lands as a pending suggestion you accept or reject. Follow-up turns see the document as it currently is, with pending suggestions left out.

Review behaviour is tightened around multi-turn sessions. Accepting one batch no longer resurrects entries you had already rejected in another. A second turn that edits a block still pending from an earlier turn now supersedes the older suggestion instead of silently hiding both. A block the agent moves keeps its id after you accept, and custom blocks (Afilmory, Map, Stock) keep their ids across reloads.

Large agent sessions persist again: the session endpoints accept bodies up to 32 MB, and the admin surfaces a persistence failure with a toast instead of swallowing it.

## Changes

### Features
- Admin write agent drives edits through a just-bash virtual workspace over `/doc.xml`, with LiteXML block-id diffing into the review overlay ([#2824](https://github.com/mx-space/core/pull/2824))
- Whitespace-only or identical rewrites report a no-op instead of an empty review batch ([#2824](https://github.com/mx-space/core/pull/2824))
- `python3` inside the agent shell is stubbed with a hint to use `sed` / `grep` / heredocs ([#2824](https://github.com/mx-space/core/pull/2824))

### Bug Fixes
- Accepting a batch no longer resurrects entries already rejected in a sibling batch ([#2824](https://github.com/mx-space/core/pull/2824))
- A later turn on a still-pending block supersedes the earlier suggestion instead of marking both as conflicted and hiding them ([#2824](https://github.com/mx-space/core/pull/2824))
- Moved blocks keep their block id after accept; Afilmory / Map / Stock nodes keep their ids across reloads ([#2824](https://github.com/mx-space/core/pull/2824))
- Agent session save requests over 1 MB no longer fail with 413; failures are now shown in the admin ([#2824](https://github.com/mx-space/core/pull/2824))

### Other
- `@haklex/*` bumped to 0.42.1 ([#2824](https://github.com/mx-space/core/pull/2824))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.12.4...v14.13.0
