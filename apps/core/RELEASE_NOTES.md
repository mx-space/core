## TL;DR

Mix Space 14.6.1 introduces revision-tree publishing, branch-aware drafts, explicit comparisons, and durable background publish jobs in Admin.

## Highlights

Editing and publishing now use immutable revisions instead of a single mutable draft line. Authors can continue from the current online article, a historical publication, or another draft branch without unrelated work blocking saves or publication. Admin keeps the online revision visible, groups drafts by their actual base, and provides clear compare, continue, publish, delete, and history actions without unbounded tree indentation.

Publish preparation is now a server-backed job bound to a frozen revision. AI resource selections belong to that job, publication waits for the selected tasks to finish, and unrelated online resources are preserved. Draft recovery also distinguishes ordinary branch divergence from a true same-branch concurrent edit.

## Changes

### Bug Fixes

- Corrected Admin mobile viewport height and bottom-sheet bounds ([c55f97b](https://github.com/mx-space/core/commit/c55f97b05)).

### Other

- Rebuilt content editing around immutable documents, revisions, branches, publication events, and revision-bound publish jobs ([16627f3](https://github.com/mx-space/core/commit/16627f3d1)).
- Added branch-aware Admin recovery, diff, publication confirmation, process tracking, and version-history interfaces ([16627f3](https://github.com/mx-space/core/commit/16627f3d1)).
- Updated first-party CLI content commands to use the new branch and revision contracts ([16627f3](https://github.com/mx-space/core/commit/16627f3d1)).

## Upgrade Notes

- Run the standard `pnpm migrate` release step before boot. It applies the single `0035_tree_content_revisions` schema migration and then converts legacy draft data automatically.
- Deploy Core together with the bundled Admin. External clients using the former linear draft/version endpoints must adopt the document, revision, branch, and publish-job APIs.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.6.0...v14.6.1
