## TL;DR

Embed Afilmory photo galleries directly inside posts from the admin editor, with a redesigned picker and live filters.

## Highlights

The rich editor now ships a first-class Afilmory block. Authors paste a gallery base URL and either pick individual photos or describe a filter — tags, cameras, lenses, date range, and free-text search — that the renderer re-evaluates at view time. Single picks render as a polaroid card; multiple or filter sources render as a grid, masonry, or carousel inside the post.

The Insert-Afilmory dialog was rebuilt around a photo-first browser. Selection and filtering share one surface with no upfront mode toggle, a sticky search bar, a filter popover for facets and date range, and an inline active-filter chip row. When both a selection and a filter are present, the dialog now surfaces two CTAs so the submit intent is explicit rather than silently preferring the selection.

This release also stabilises the server build by reverting the kysely override pinned at 0.28.17 (the better-auth adapter still imports symbols the 0.29 line removed). Several runtime dependencies move forward by a major: marked 18, shiki 4, lexical 0.45, haklex 0.20, ejs 6, and happy-dom 20 in tests.

## Changes

### Features

- Embed an Afilmory gallery in any post: pick photos individually, or describe a filter the renderer evaluates live (tags, cameras, lenses, date range, search). Layout choices: grid, masonry, carousel. ([28781df](https://github.com/mx-space/core/commit/28781df00e258728afb88873f0f4d2cbe1784ca3))

### Bug Fixes

- Server build no longer fails on `@better-auth/kysely-adapter` after the kysely upgrade — the override is reverted to 0.28.17 until the adapter catches up. Admin tests are repaired alongside (i18n stub, getAnimations polyfill, markdown-render mock, badge data-testid forwarding). ([b4aab3f](https://github.com/mx-space/core/commit/b4aab3f29c104958a02222ea691bdac2eaf74ad5))

### Other

- Redesigned Insert-Afilmory dialog: photo-first grid browser, filter popover, dual CTAs when both selection and filter are set. ([c4de8f2](https://github.com/mx-space/core/commit/c4de8f265378ca7078d3ec555d373105db1b427e))
- Admin dashboard top section unified to a line style with deeper grid lines. ([d7e1cc2](https://github.com/mx-space/core/commit/d7e1cc2b216d15615bd338b924b62076a0664ea3))
- Major dependency bumps: marked 18, shiki 4, lexical 0.45, haklex 0.20, ejs 6, happy-dom 20. ([4bf5255](https://github.com/mx-space/core/commit/4bf5255bfb0ef823d0b373e35e6bdc17c71cfbfa))
- Production bundle consolidated into the shared `vite.config.ts`; the standalone `build.config.ts` is gone. ([7729b0e](https://github.com/mx-space/core/commit/7729b0e1d61573726b5130f0e0bff25be3038bac))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.4.0...v13.5.0
