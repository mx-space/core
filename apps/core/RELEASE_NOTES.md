## TL;DR

Multi-language AI generation with force regenerate, a per-article AI overview board, plus several content and privacy fixes.

## Highlights

The AI generate modal now accepts up to eight target languages at once (comma-separated chips, with language codes normalized so `zh-CN` and `zh` do not double-generate). A force-regenerate option runs across summary, translation, TTS, and insights, with in-flight locking that keeps forced runs from racing or silently replaying incremental results.

A new per-article AI overview board shows coverage by capability and language: empty cells dispatch generation, filled ones jump to assets, and live/failed tasks stay accurate while polling. Summary and insights share a base-then-translate pipeline so multi-language work reuses a source-language base instead of regenerating from scratch per language.

Notes can clear mood and weather again; category responses no longer leak unpublished post metadata; and RSS aggregate caches invalidate after content changes and post deletion so feeds stay current.

## Changes

### Features
- Generate AI assets for multiple languages in one pass, with force regeneration and shared multi-language pipelines for summary and insights ([#2804])
- Per-article AI overview board: coverage matrix, active tasks, ad-hoc languages, and cost roll-up ([#2804])
- Redesign Space iOS mobile workflows ([bec9d0a](https://github.com/mx-space/core/commit/bec9d0ab8fa220ee756f94a254c8b5ffd5318458))

### Bug Fixes
- Allow clearing mood and weather on notes ([#2800])
- Prevent unpublished post metadata disclosure via category APIs ([#2801])
- Invalidate RSS caches after content changes and post deletion ([#2802])

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.26.0...v13.27.0
