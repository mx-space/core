## TL;DR

The admin dashboard is redesigned as a focused writing desk, backed by three new aggregate endpoints, with faster server startup.

## Highlights

The admin dashboard no longer opens on a wall of statistics. It is now a writing desk: a greeting header with quick-create actions, a "continue writing" column that surfaces your drafts and scheduled notes, and a to-do column that shows comments awaiting review and friend-link applications with inline previews. A slim footer keeps versions and live visitor numbers in view, and when everything is handled the desk simply tells you so.

Around the desk, the first screen is filled with lighter, more personal panels: a six-cell stat band (today's visitors, UV, posts, notes, comments, total reads), an "on this day" card that resurfaces what you published on this date in earlier years, a recent-echoes feed of the latest reader comments and likes, and a twelve-month writing-rhythm chart. The statistics grid and charts moved to a dedicated Insights page, and the cache/search-index maintenance actions now live in Settings.

Server startup is leaner: the Babel toolchain used by serverless functions is now loaded lazily off the boot path, and bundle output escapes non-ASCII characters, roughly halving retained module source memory.

## Changes

### Features

- Redesigned admin dashboard as a task-centric writing desk with stat band, on-this-day memories, recent echoes, and a writing-rhythm chart ([db44cc7](https://github.com/mx-space/core/commit/db44cc7b7))
- New Insights page hosting the live visitor cards, statistics grid, and charts previously on the dashboard ([1eb01aa](https://github.com/mx-space/core/commit/1eb01aa12))
- Maintenance actions (clean API cache, clean data cache, rebuild search index) moved into Settings ([b854d3f](https://github.com/mx-space/core/commit/b854d3fe7))
- New authenticated aggregate endpoints powering the desk: `GET /aggregate/desk`, `GET /aggregate/on-this-day`, `GET /aggregate/publish-heatmap` ([462dfc8](https://github.com/mx-space/core/commit/462dfc8d6), [7c605f1](https://github.com/mx-space/core/commit/7c605f1cb))

### Bug Fixes

- Manual membership grant/revoke now returns 404 for an unknown readerId instead of 500 ([ef800e9](https://github.com/mx-space/core/commit/ef800e94900a4bc89d4b273fd1d1fdaee5b0302e))

### Other

- Serverless Babel toolchain loads lazily off the boot path, reducing startup work ([afca3df](https://github.com/mx-space/core/commit/afca3df1c))
- Bundle output escapes non-ASCII source, roughly halving retained module source memory ([7180ae6](https://github.com/mx-space/core/commit/7180ae6f2))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.17.1...v13.18.0
