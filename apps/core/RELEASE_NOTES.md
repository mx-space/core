## TL;DR

Saving a draft or post that contains a rich-quote block no longer fails with "Unknown editor node type: rich-quote".

## Changes

- Drafts and posts containing rich-quote (attributed quote) blocks save correctly again. The server-side Lexical node registry (`@haklex/rich-headless` 0.23.0) now recognizes `rich-quote`, so markdown projection no longer throws during save. ([8a90e7d](https://github.com/mx-space/core/commit/8a90e7dc3))
- AI translation now groups text inside rich-quote blocks into a single translation flow, matching plain quotes, which improves translation quality across inline formatting boundaries. ([9b79e28](https://github.com/mx-space/core/commit/9b79e284a))
- The admin editor strips pending AI diff-review decorators (`agent-diff` nodes) before persisting drafts or publishing, so saving mid-review no longer crashes or stores transient review UI in your content. ([9c9ddd0](https://github.com/mx-space/core/commit/9c9ddd098))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.10.3...v13.10.4
