## TL;DR

Published articles can now shed unwanted drafts in bulk, while previewing drafts no longer recreates collaboration data after deletion.

## Highlights

Open **Organize drafts** from the drafts page to find published articles you no longer plan to edit. Filter by time since the last edit and content type, select matching articles across pages, and review the space to reclaim. Drafts with unpublished changes can also be discarded after explicit confirmation, alongside archived drafts and reclaimable history.

Cleanup preserves online content, comments, publication records, and versions used by shared links. Articles being edited, awaiting publication, or changed since the preview are skipped. The results show actual reclaimed space and explain skipped articles. The workflow supports mobile and dark mode, and interrupted requests are reported without assuming an uncertain deletion succeeded or failed.

## Changes

### Features

- Organize drafts by published article, with age and content-type filters, cross-page selection, explicit confirmation, and per-article results ([ab7b755](https://github.com/mx-space/core/commit/ab7b755d337cd018139d9e02ce90dba4ab780755)).
- Edit email templates in a single pane with a compact template switcher, a resizable editor/preview split, and a mobile view switch ([122e056](https://github.com/mx-space/core/commit/122e0562123f2f3e7622032bcfc7909648a81a61)).

### Bug Fixes

- Viewing a draft preview or refreshing version context no longer creates collaboration snapshots or restores deleted drafts ([ab7b755](https://github.com/mx-space/core/commit/ab7b755d337cd018139d9e02ce90dba4ab780755)).
- Cleanup waits for in-flight field edits, checks the entire publish queue, and excludes unpublished and scheduled content ([ab7b755](https://github.com/mx-space/core/commit/ab7b755d337cd018139d9e02ce90dba4ab780755)).

---

**Full Changelog**: https://github.com/mx-space/core/compare/v15.5.0...v15.6.0
