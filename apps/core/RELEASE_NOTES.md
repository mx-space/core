## TL;DR

The dashboard home loads in well under a second again after its aggregated response shrank from about 1.5 MB to a few kilobytes.

## Changes

- `GET /aggregate/dashboard` returns only what the home renders for each recent draft (title, excerpt, character count and status) instead of three full revisions per draft ([da2fde9](https://github.com/mx-space/core/commit/da2fde916))
- Today's traffic is no longer part of the aggregated response; the dashboard loads it separately behind a fixed-size placeholder, so the rest of the page does not wait for it ([c9f8efc](https://github.com/mx-space/core/commit/c9f8efc8d))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.14.3...v14.14.4
