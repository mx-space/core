## TL;DR

The homepage activity feed and post-list endpoints no longer ship full article bodies, trimming hundreds of KB from each SSR response.

## Changes

- Homepage activity aggregate and the post list no longer embed full note/post content trees, cutting hundreds of KB of unused payload from list responses that only render titles and short previews. ([4e3a11e](https://github.com/mx-space/core/commit/4e3a11ee585409cfab50e04a7408a9dab6e7d341))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v12.9.4...v12.9.5
