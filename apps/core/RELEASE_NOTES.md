## TL;DR

Translation output now reads more naturally in casual registers, and the friend-link checker probes JS-rendered landing pages via the shared browser pool.

## Highlights

The translation pipeline has been retuned around a single goal: write the target text the way a native author of that language would, not as a literal mirror of the source. The change improves sentence-level cadence and register matching — zh→en Chinglish is noticeably reduced, and zh→ja stays consistently in casual register instead of drifting between 敬体 and 常体. Output token cost is unchanged; system prompt is roughly 1.2k tokens larger per request, negligible on most provider pricing.

The link-health probe and enrichment open-graph capture now share a single Chromium-backed browser pool. JS-rendered landing pages and basic anti-bot challenges that previously looked dead to the friend-link checker now return correct status codes.

Note on versioning: v13.1.1 was tagged but its CI install failed on a stale `semver` override / lockfile mismatch — no artifacts (Docker, Release zip) were ever published for that tag. v13.1.2 ships the same product changes plus the lockfile alignment fix.

## Changes

### Other
- Translation prompts rewritten with a language-agnostic philosophy emphasising native-idiom output over surface-syntax mirroring. Adds register, idiom, and concept-level calque checks; tightens the scope of "preserve structure exactly" to Markdown/HTML/JSX layers only. ([9c0cc84](https://github.com/mx-space/core/commit/9c0cc8481cab5df6ecdd097654f072d9aa71d514))
- Friend-link checker and open-graph enrichment now share a single agent-browser processor (`processors/agent-browser/`). JS-rendered and anti-bot-gated pages are no longer reported as dead. ([#2738](https://github.com/mx-space/core/pull/2738))
- Align `semver` override with the resolved lockfile and exempt `@babel/*` from `minimumReleaseAge`, so fresh upstream patch releases no longer block CI install.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.1.0...v13.1.2
