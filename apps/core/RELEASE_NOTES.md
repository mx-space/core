## TL;DR

Find and safely remove unused dynamic components and test drafts, with a redesigned drafts page and a writing agent that follows a component design guide.

## Highlights

The dynamic components page now shows where every component version is used: published posts, notes and pages, translations, pinned shares, drafts (including unsaved collaborative edits), snippets, topics and moments. A cleanup dialog lists unused components, old versions nobody references and stray component files, re-checks usage when you confirm, and restores anything the server still finds in use.

The drafts page gets a full-width header with type and relation filters, the storage summary and a one-click cleanup. With no draft selected it shows storage totals and cleanup suggestions; a selected draft leads with a summary of what changed since the published version. Draft cleanup can also remove suspected test drafts: never published, idle, and untitled or named like e2e/test/tmp/demo.

The writing agent ships a bundled dynamic-component design skill it loads before writing or revising a component, and it must name the component it is revising, so revisions no longer register duplicate entries.

## Changes

### Features

- Report where each file URL is used through `POST /files/references/usage`, including live collaborative edits ([6a08125](https://github.com/mx-space/core/commit/6a0812520c77a4ad3817a8a7418ed62210a63c65))
- Clean up suspected test drafts from the drafts cleanup dialog; scheduled auto cleanup never touches them ([6a08125](https://github.com/mx-space/core/commit/6a0812520c77a4ad3817a8a7418ed62210a63c65))
- See per-version usage and clean up unused dynamic components, old versions and unregistered component files in the dashboard ([d836d7f](https://github.com/mx-space/core/commit/d836d7f7f))
- Use the redesigned drafts page: header filters, storage overview with cleanup suggestions, and a change summary on each draft ([d836d7f](https://github.com/mx-space/core/commit/d836d7f7f))
- Let the writing agent load bundled skills, starting with dynamic component design ([37158ca](https://github.com/mx-space/core/commit/37158cabc))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v16.3.0...v16.4.0
