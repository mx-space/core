# Dynamic component authoring and catalog insert (todo)

**Owner:** TBD
**Drafted:** 2026-10-23
**Status:** Implemented in the admin (2026-10-23)
**Reference:** Byline design `byline/docs/superpowers/specs/2026-10-23-dynamic-component-authoring-design.md`

---

## Context

Byline is adding a catalog-driven authoring flow for dynamic components. mx-core has the same gap: the catalog lives in the `dynamic-widgets-catalog` data snippet (`apps/admin/src/vendor/rich-editor/utils/dynamic-catalog.ts`). Only the write agent reads it, and the editor's `/dynamic` node always asks for a module URL, an initial height and a props JSON blob.

## Todo

- [x] Admin panel for the catalog: list, search, detail with live preview, register, edit metadata, delete.
- [x] Source tab: view and edit a component's JS in Monaco with a live preview (debounced `blob:` module mount). Saving uploads a new immutable file and points the entry at it, keeping the old URL as `parentUrl`. Existing posts stay on the old version.
- [x] Editor: `/dynamic` opens a picker of registered components (search, keyboard). A footer link falls back to the existing URL + JSON form for unregistered modules.
- [x] Parameter panel generated from the entry's `propsSchema` (string, enum, number, boolean; JSON toggle for the rest). It opens after picking, and from the node's settings button on existing nodes, and applies changes live.
- [x] Picker hides superseded versions (rows whose `url` is another row's `parentUrl`). Older-version nodes still render and resolve their schema through the `parentUrl` chain.
- [x] Agent publish flow carries the parent's `propsSchema` and `description` forward when registering a revision.
- [x] Check that orphan-file cleanup treats files referenced by the catalog snippet as in use. Byline found its scan ignored catalog-only files and would delete them.

## Outcome

- Orphan cleanup needed no change: `findReferencedUrls` already scans `snippets.raw`, so files listed in the catalog snippet are never deleted.
- `src/api/dynamic-components.ts` reads and writes the snippet behind the same functions Byline's admin calls over HTTP, so the panel, picker and props panel are shared code.
- Entries gain a persisted `id` (legacy entries use their URL) and `previousUrls`. Names stay non-unique because agent revisions reuse them.

## Notes

- Byline owns its own schema and stores the catalog in a table. mx-core keeps the snippet storage; only the admin and editor behaviour carry over.
- The schema → form-field mapping is pure logic. If both repos implement it, consider moving it into a shared package rather than copying it.
- haklex `DynamicEditNode.decorate` can't be overridden through `rendererConfig`. Byline subclasses the node and swaps it in with Lexical node replacement; mx-core can do the same without changing haklex.
