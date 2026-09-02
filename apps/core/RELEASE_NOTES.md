## TL;DR

Readers can now report and block abusive commenters, while public comment feeds automatically hide blocked accounts and enable spam filtering.

## Highlights

Signed-in readers can report a comment and block its author in one action. The report continues through the existing moderation notification path, while the new block relationship is stored per reader so comments from that account no longer appear in public threads.

This release also enables the existing spam-filter pipeline for current installations during the database migration. The change keeps moderation in the shared comment API, so supported clients receive the same filtered thread behavior without duplicating policy locally.

## Changes

### Features

- Add the combined comment report-and-block flow with persistent per-reader feed filtering ([24d53f0](https://github.com/mx-space/core/commit/24d53f0778da9ed018d6f7496bd3274c4d9ccee8))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.8.0...v14.9.0
