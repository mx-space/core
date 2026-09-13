## TL;DR

The admin dashboard is rebuilt around unpublished work and a weekly writing rhythm, with denser cards and a phone-friendly layout.

## Highlights

"Continue writing" is now "Unpublished changes". Each document appears once no matter how many draft branches it has, drafts identical to the published version are hidden, and every row shows its state — unpublished, published with edits, or scheduled — plus a link to the version tree when several branches exist.

Writing rhythm moves from a per-day heatmap to 52 weekly columns, stacked by posts and notes, with the yearly total, this week's count, and the current streak folded into the header. Today's traffic is a line chart, live/peak counts sit under the greeting, pending comments show inside the stats band, and the whole page tightens its spacing; on phones the cards collapse into a single hairline ledger.

## Changes

### Features
- Dashboard: unpublished changes grouped per document with status badges and branch links ([ca8a7f2](https://github.com/mx-space/core/commit/ca8a7f29c63635334bc5638480328481a08d023a))
- Dashboard: weekly stacked posts/notes rhythm chart; `GET /aggregate/publish-heatmap` now also returns `posts` and `notes` per day ([ca8a7f2](https://github.com/mx-space/core/commit/ca8a7f29c63635334bc5638480328481a08d023a))
- Dashboard: denser layout, traffic line chart, phone ledger layout ([ca8a7f2](https://github.com/mx-space/core/commit/ca8a7f29c63635334bc5638480328481a08d023a))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.10.5...v14.11.0
