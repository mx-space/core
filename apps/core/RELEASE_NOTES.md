## TL;DR

The dashboard home is reorganised around writing, and schema migrations no longer skip a migration whose earlier branch version was applied.

## Highlights

The dashboard home now opens with a short summary of what needs attention (comments awaiting review, link requests, the next scheduled note) and a block to pick up the latest draft, with its excerpt and character count. Unpublished changes, on this day, top articles, writing rhythm and site stats follow as plain sections instead of cards.

A side rail holds this week's calendar, pending tasks, today's traffic and recent comments and likes. On wide screens the main column and the rail scroll independently; on phones everything stacks in one column with pending tasks moved near the top.

The schema migrator could record a migration as applied without running its SQL when a development database had applied an earlier branch version of that migration. Such stale ledger rows no longer count towards the backfill waterline, so the final version of the migration runs.

## Changes

### Features

- Dashboard home redesigned with a writing-first main column and a side rail for this week, tasks, traffic and recent activity ([93cb882](https://github.com/mx-space/core/commit/93cb882b3))

### Bug Fixes

- Schema migrations are no longer skipped when a database holds a ledger row from a superseded branch version of the same migration ([9d34f8c](https://github.com/mx-space/core/commit/9d34f8c7f))

## Upgrade Notes

Development databases that applied a branch version of `0040_comment_moderation` may be missing the `comments.moderation_status`, `moderation_receipt_hash` and `moderation_attempts` columns, which makes comment queries fail. This release does not re-apply migrations that are already recorded, so add the columns on those databases by hand with `ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS ...`, using the definitions in `0040_comment_moderation.sql`.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.14.1...v14.14.2
