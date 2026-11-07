## TL;DR

The writing agent can now edit Excalidraw drawings and dynamic components in an article, read images, and insert images it generates.

## Highlights

Embedded content is now part of the agent's workspace. Excalidraw drawings, dynamic components and images from your own storage appear as files under `/embeds`, so the agent edits a drawing or a component the same way it edits the article. Each edit is saved as a new, immutable version tied to the current draft, so the published article keeps working until you publish again. Excalidraw text is remeasured after an edit, so labels stay centred.

Dynamic components now go through the normal proposal review instead of a separate preview card, and are added to the component catalog when you accept them. A component's name, description and props schema live in a `.meta.json` file next to it. If someone else changes a drawing while the agent is working, that block keeps their version and the agent is told, while the rest of its edits still apply.

The agent can look at images in the article with a multimodal model, and images it generates are saved into the workspace so it can insert them directly. Uploads made in a draft are protected from orphan-file cleanup while the draft still has unsaved edits.

## Changes

### Features
- The writing agent edits Excalidraw drawings, dynamic components and images through `/embeds`, and can view and generate images ([497c149](https://github.com/mx-space/core/commit/497c1490412027d5e4fd9a8f8c3e732568c46dba))
- Articles get a language field preset that suggests common languages and accepts any valid language tag ([8be5b8c](https://github.com/mx-space/core/commit/8be5b8c030b71576a41b9fe864fb9986621ccdd1))

### Bug Fixes
- Requests without an `Origin` header (image loads, server-side fetches) no longer fail with a 500 when no allowed-origin list is configured ([1899da8](https://github.com/mx-space/core/commit/1899da8db9ff3eaf6a9547ee8de6e8d3351c9dfa))

## Upgrade Notes

- This release adds migration `0049` (two nullable columns and an index on `file_references`). Run the release-phase migration (`mx-migrate`) before starting the new server; it is additive and safe for rolling deploys.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v17.0.1...v17.0.2
