## TL;DR

Patch release with admin map dialog upload fix and content list toolbar polish.

## Changes

- Map insert dialog now defers the GPX upload until you click **Insert**, parses the file locally for preview, drops the lossless toggle (full track is always preserved), removes the noisy filename auto-fill for the title, and aligns the upload button height with the URL input. ([8274418](https://github.com/mx-space/core/commit/82744184006ea7efd857305dfd80eeb90b604a4e))
- Content list toolbar selection control moves to the leftmost slot so the select-all checkbox lines up with each row's checkbox, and timestamps in PostRow / NoteRow now stack with action icons in a single right-aligned vertical rail for clearer scanning. ([c705547](https://github.com/mx-space/core/commit/c705547192e73b7e78379678a01c749299236f4e))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.5.0...v13.5.1
