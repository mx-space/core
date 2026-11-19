## TL;DR

Updating a published article after editing only its metadata no longer regenerates AI resources, and posts with polls no longer lose them in the editor.

## Highlights

The publish dialog has a new "Skip this time" switch for AI resources. It turns on by itself when the title and body match the online version, so changing a category, tags, slug, cover or pin goes straight through without regenerating summaries, insights, translations or narration. Lexical articles are compared by their normalized document, not their Markdown, so clicking around the editor does not count as a change.

Skipping leaves your remembered AI choices untouched. The next time you change the body, the dialog still pre-selects what you picked last time instead of "Skip" for everything. You can also turn the switch on manually to publish a body edit without any AI work.

The admin editor now supports poll blocks. Opening an article that contained a poll used to drop the block from the editor and from the autosaved draft. Polls now load, render and save like any other block.

## Changes

### Features

- Publish dialog can skip AI resources for one update; it defaults to skipping when only metadata changed, and a skipped update keeps the remembered AI choices ([f7fd6e5](https://github.com/mx-space/core/commit/f7fd6e5196b17a04b5b3c4de380a020e8a7d2683))

### Bug Fixes

- The admin editor keeps poll blocks instead of dropping them when an article is opened and autosaved ([c327706](https://github.com/mx-space/core/commit/c32770660709318349222e32197c204d99d6a046))

## Upgrade Notes

If you opened an article with a poll in an earlier admin, check its draft history and restore a version that still contains the poll before publishing it.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v18.1.0...v18.2.0
