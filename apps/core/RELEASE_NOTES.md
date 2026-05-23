## TL;DR

Aggregate endpoint now accepts a pipe-separated theme fallback chain, letting frontends gracefully degrade from a custom theme to a shared default.

## Highlights

The `/aggregate` endpoint now accepts `?theme=a|b|c` and walks the candidate list in order, returning the first available theme snippet (with its locale overlay merged in). This unblocks downstream frontends like Yohaku that want to fall back from a primary theme such as `yohaku` to a shared default like `shiro` without coupling clients to server-side defaults. Single-theme requests behave unchanged.

Snippet name validation widens from `[\w-]{1,30}` to `[\w.-]{1,30}`, so existing multi-locale names like `shiro.ja` now pass without renaming. The 1–30 length cap stays in place and the error message reflects the new rule. No data migration is required.

## Changes

### Features
- Theme fallback chain on `/aggregate` via pipe separator (e.g. `?theme=yohaku|shiro`). ([e2118f5](https://github.com/mx-space/core/commit/e2118f51c0d23465b8388d400d91aeb4d74a4a75))
- Snippet names accept dots and hyphens, allowing locale-suffixed names like `shiro.ja`. ([1fb180f](https://github.com/mx-space/core/commit/1fb180fd6d2d9574e59f4b00166dac26671a7a8b))

### Bug Fixes
- Dev script now SIGKILLs the nodemon child to prevent a stale core process surviving restart and stacking up duplicates. ([e3cd8da](https://github.com/mx-space/core/commit/e3cd8daa835f1f3f23a2762e41d528150d3898f6))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.0.0...v13.0.1
