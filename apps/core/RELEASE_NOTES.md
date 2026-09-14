## TL;DR

Readers can now fetch the whole Sponsor Archive in one call, with each premium post tagged by what they are allowed to read.

## Highlights

`GET /membership/archive` returns every published premium post (newest first) along with the caller's entitlement for each one: `membership`, `purchase`, `free-window`, `locked`, `owner`, or `public`. Posts still inside their free window also carry `freeUntil`. Anonymous callers get the list with everything marked `locked`, so a client can render the catalogue before login and switch to the reader's real state after.

`@mx-space/api-client` gains `membership.archive()` and the `ArchiveResult` / `ArchivePostItem` types.

## Changes

### Features

- Sponsor Archive listing endpoint with per-post reader entitlement ([f2fe855](https://github.com/mx-space/core/commit/f2fe855f9018ef837d76b773fe0bc799821390dc))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.12.3...v14.12.4
