## TL;DR

The drafts page now compares versions in a single inline view, with a version picker and an optional side-by-side dialog.

## Highlights

Draft history no longer spreads across five columns. The detail pane shows one reading column: pick a version from the compare bar, step through older and newer versions with the arrow buttons, and read changes marked in place, with long runs of unchanged blocks folded away. A full-text toggle restores the whole document, and the side-by-side view moves into a large dialog for close comparisons.

The version picker lists the full history with each version's character delta, dims versions that compaction would remove, and lets you restore any of them directly. Storage figures and the compaction action now sit in the draft header instead of a separate panel.

## Changes

### Features
- Draft detail shows an inline diff with a version picker, prev/next navigation, a changes-only or full-text toggle, and a side-by-side comparison dialog ([c1066b0](https://github.com/mx-space/core/commit/c1066b0953927b9d64b7ba9878dfad345711463a))

### Bug Fixes
- The cleanup dialog's age selector and the drafts sort selector use the dashboard's own select instead of the browser default, and the dialog's notice and footer now align with the rest of the content ([756d2dc](https://github.com/mx-space/core/commit/756d2dcf3153aec2318ce0f6a0f1e2da1b10231a))

### Other
- Rich editor packages (`@haklex/*`) upgraded to 0.57.0, which adds the inline diff layout and brings the refreshed editor styling from 0.56.0 ([1b357e7](https://github.com/mx-space/core/commit/1b357e75fcfa2bdc2b60839f8925bdcdf0d4324d))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v15.4.0...v15.5.0
