# Admin Snippet Left Tree — Interaction & A11y Overhaul

**Status**: Spec — pending implementation plan
**Scope**: `apps/admin/src/features/snippets/` only. Backend `apps/core/src/modules/snippet/` is **not** modified.
**Owner**: Innei
**Date**: 2026-06-18

## Background

The snippet VFS refactor is complete: snippets now live in a proper folder
hierarchy backed by `path`-prefixed records, with `POST /snippet/move`
supporting recursive folder moves. The admin left tree (`SnippetList.tsx`
+ `SnippetsRouteViewContent.tsx`) was upgraded incrementally during the
VFS work but still treats the tree as a flat keyboard listbox with
hover-only actions. This spec brings the tree to parity with a
local-filesystem explorer (VSCode-class interaction) and to AA keyboard
accessibility.

## Goals

1. **Interaction completeness (A1)** — right-click menus, inline rename,
   single-node drag-drop move, and cross-level file multi-select.
2. **Keyboard & a11y (C)** — full tree role semantics, roving tabindex,
   minimal-but-sufficient key bindings (K3).
3. **No backend changes.** All operations route through existing endpoints:
   `POST /snippet/move`, `DELETE /snippet/by-path`, `DELETE /snippet/:id`.
   Batch operations fan out as parallel client requests.

## Non-Goals

- Visual restyling (row density, type-badge cleanup, hover-button
  discoverability). Tracked separately as the "B" track.
- Copy / duplicate operations. No `POST /copy` endpoint exists and the
  user has explicitly deferred this.
- Reorder via drag (tree is name-sorted; user-defined order is out of
  scope).
- Drag-drop multi-select. Multi-select move routes through the Move-to
  picker only.
- Cut / copy / paste keyboard shortcuts. Move is menu- or drag-driven.

## Backend API Inventory

Existing snippet endpoints (in `snippet.controller.ts`):

| Endpoint | Use |
|---|---|
| `GET /snippet?recursive=true` | Initial list load (unchanged) |
| `POST /snippet/move` `{from, to, recursive}` | Rename file, rename folder, move file, move folder |
| `DELETE /snippet/by-path?path&recursive` | Delete folder (recursive) |
| `DELETE /snippet/:id` | Delete file (preserves built-in reset semantics) |
| `PUT /snippet/by-path` | Unchanged — used by editor save path |

No new endpoints are introduced.

## State Model

Replace ad-hoc state in `SnippetsRouteViewContent.tsx` with named
sub-states:

```ts
type TreeSelection = {
  focusedPath: string | null   // roving tabindex anchor, file or folder
  checked: Set<string>         // file paths only (M2)
  anchorPath: string | null    // shift-click range anchor
}

type RenameState = {
  path: string                 // file or folder path being renamed
  draftName: string            // basename or segment, no slashes
} | null

type MovePickerState = {
  paths: string[]              // 1+ source paths, all files OR a single folder
  query: string                // current input
} | null

type DragState = {
  sourcePath: string
  kind: 'file' | 'folder'
} | null
```

Single-select detail navigation continues to use the URL
(`/snippets/:id`). `focusedPath` is local tree-keyboard state and is
**not** mirrored to the URL — opening a file (Enter / click) writes the
URL; focus alone does not.

## VFS Adapter Hook

New `useSnippetVfs()` in `apps/admin/src/features/snippets/hooks/use-snippet-vfs.ts`
exposes mutations and shared cache invalidation:

```ts
{
  rename: (args: {from: string; to: string; recursive: boolean}) => Promise<void>
  move:   (args: {from: string; to: string; recursive: boolean}) => Promise<void>
  // rename and move are the same wire call; kept distinct for telemetry
  // and to allow rename-specific optimistic logic.
  batchMove:   (moves: Array<{from: string; to: string}>) => Promise<SettleResult>
  batchDelete: (paths: string[])                          => Promise<SettleResult>
}
```

`SettleResult` is `{ok: number; failed: Array<{path: string; error: Error}>}`.
All mutations invalidate `adminQueryKeys.snippets.vfs('', true)` on
settle (success or partial failure).

## Right-Click Menu

Triggered via `oncontextmenu`, the ContextMenu key, or long-press on
touch. Implementation reuses `showContextMenu` from
`~/ui/overlay/context-menu` with row-specific items.

### File menu (F2 — full)

| Key | Label (i18n key) | Behavior |
|---|---|---|
| open | `snippets.menu.open` | `navigate('/snippets/' + id)` |
| openExternal | `snippets.menu.openExternal` | `window.open(API_URL + '/s/' + path)` |
| copyRawUrl | `snippets.menu.copyRawUrl` | clipboard ← `${API_URL}/s/${path}` |
| copyPath | `snippets.menu.copyPath` | clipboard ← `path` |
| --- | (divider) | |
| rename | `snippets.menu.rename` | enter rename state |
| moveTo | `snippets.menu.moveTo` | open MovePicker with `paths=[path]` |
| revealInParent | `snippets.menu.revealInParent` | `setSelectedPrefix(getParentPrefix(path))` and scroll into view |
| --- | (divider) | |
| delete | `snippets.menu.delete` (or `snippets.editor.action.reset` for built-in Function) | existing `requestDelete` flow |

### Folder menu (D2 — full)

| Key | Label | Behavior |
|---|---|---|
| newFile | `snippets.menu.newFile` | existing `onCreateFileInFolder` |
| newFolder | `snippets.menu.newFolder` | existing `startCreateFolder` |
| --- | | |
| rename | `snippets.menu.rename` | enter rename state; server move is recursive |
| moveTo | `snippets.menu.moveTo` | open MovePicker with `paths=[folderPath]` |
| copyPath | `snippets.menu.copyPath` | clipboard ← `folderPath` |
| --- | | |
| expandAll | `snippets.menu.expandAll` | walk subtree, set all descendant prefixes expanded |
| collapseAll | `snippets.menu.collapseAll` | walk subtree, set all descendant prefixes collapsed |
| --- | | |
| delete | `snippets.menu.deleteFolder` | confirm "Delete N files in `<folder>`?"; `DELETE /by-path?recursive=true` |

### Multi-select menu (M2)

When `checked.size > 0` and the right-click target is a checked file, the
file menu collapses to:

| Key | Label |
|---|---|
| moveTo | `snippets.menu.moveToN` ("Move N items…") |
| delete | `snippets.menu.deleteN` ("Delete N items") |

Right-clicking an unchecked row clears `checked` first and shows the
single-row file menu.

## Inline Rename

**Triggers**: menu Rename, F2 on focused row, double-click on the name
span.

**Render**: the name span is replaced with a `TextInput`. autoFocus,
selection covers basename only:
- file `foo.skill.mdx` → selection is `foo` (everything before the first dot in basename)
- file `bar.json` → selection is `bar`
- folder segment is fully selected
- Extension is **editable** — the selection range is a default convenience, not a hard restriction. Users can extend the selection or arrow into the extension to rename the full basename including its suffix.

**Commit**: Enter or blur commits; Esc cancels.

**Validation (client-side, blocks commit)**:
- empty draft → cancel
- draft contains `/` → toast `snippets.toast.renameInvalid`, stay in
  rename state
- draft equals original segment → silent cancel

**Wire call**:
- file: `move({from: oldPath, to: parentPrefix + draft, recursive: false})`
- folder: `move({from: oldPrefix, to: parentPrefix + draft + '/', recursive: true})`

**Conflict (X1)**: on mutation error, toast
`snippets.toast.renameConflict` (or the server's error message via
`getErrorMessage`); rename state is preserved so the user can correct
and retry. Esc still cancels.

**Optimistic update**: client patches every cached snippet whose `path`
starts with `oldPrefix`, rewriting the prefix. On error, the optimistic
patch rolls back via the standard react-query rollback pattern.

## Drag-and-Drop (G2)

Single-node move using the HTML5 drag API; no third-party dependency
(dnd-kit is not in the admin tree).

**Source**: file and folder rows both set `draggable={true}` and on
`dragstart` set `dataTransfer.setData('application/x-snippet-path', path)`
plus `dataTransfer.effectAllowed = 'move'`. Drag state is mirrored to
`DragState` for hit-test guard.

**Target**: folder rows and the root scroll area accept drops.
`onDragOver` calls `preventDefault()` and applies a `bg-accent-soft`
ring **only** when the drop is legal:

- source ≠ target folder
- target prefix is not a descendant of `sourcePath` (no folder into
  itself)
- target prefix ≠ current parent of source (no no-op move)

If illegal, no preventDefault → browser default disallow cursor.

**Drop**: call `move({from: sourcePath, to: targetPrefix + basename, recursive: kind === 'folder'})`.

**Multi-select interaction**: G2 ships single-drag only. If the user
drags a row not in `checked`, `checked` is cleared on `dragstart`. If
the user drags a row that is in `checked` with more than one item
checked, the drag is silently downgraded to a single-source drag of the
grabbed row (we do not silently move siblings).

**Touch**: HTML5 drag does not fire on touch. Touch users use the
right-click (long-press) menu → Move to… picker. This is acceptable for
admin v1.

## Move-to Picker (P2)

Popover-style picker (Base UI `Popover`), anchored to the trigger row
or to the right-click menu origin. Width 320px, max-height 320px.

**Layout**:

```
┌────────────────────────────────────────┐
│ [TextInput: target path, e.g. ai/]    │   ← input, autofocus
├────────────────────────────────────────┤
│ / (root)                               │   ← root row, always present
│ ai/                                    │   ← existing folders, fuzzy
│ ai/skills/                             │     matched against input
│ blog/                                  │
│ ...                                    │
├────────────────────────────────────────┤
│ ＋ Create and move to: ai/new/         │   ← only if input is non-empty
│                                          and does not match an existing
│                                          folder
└────────────────────────────────────────┘
```

**Folder list source**: traverse the current `treeNodes`, emit every
folder's `path`. Plus a synthetic `'/'` row representing root.

**Matching**: case-insensitive substring on segment names; exact match
sorts first.

**Submission**: Enter on input selects the highlighted row (default:
first match, else the "create and move" row). Click on a row submits.

**Commit (single)**: `move({from: sourcePath, to: targetPrefix + basename, recursive: kind === 'folder'})`.

**Commit (multi, M2 files only)**:
```ts
const moves = paths.map(p => ({
  from: p,
  to: targetPrefix + basenameOf(p),
}))
await batchMove(moves)
```
Toast: all-ok → `snippets.toast.movedN`; partial →
`snippets.toast.movedPartial` with `{ok, failed}`.

**Conflict / collision**: server returns 409 per file; collected into
`SettleResult.failed`. No client-side dedup.

## Multi-Select (M2)

**Scope**: files only, may span folders.

**Triggers**:
- `Cmd/Ctrl+click` on a file row → toggle membership in `checked`,
  update `anchorPath`.
- `Shift+click` on a file row → set `checked` to the range
  `[anchorPath ... clicked]` in the **currently visible** flat order
  (skipping collapsed children). If `anchorPath` is null or is a folder
  or is not currently visible, behave as a plain click.
- Plain click on a file row → clear `checked`, set `focusedPath` and
  `anchorPath` to the row.
- Plain click on a folder row → clear `checked`, set `focusedPath` to
  the folder (existing folder-select semantics preserved).
- Esc → clear `checked` (see Keyboard below).

**Visual**: checked file rows render with `bg-accent-soft` and a
left-edge accent rule (`shadow-[inset_2px_0_0_var(--color-accent)]`).
Visual rules live in the B track; the M2 hooks (data attributes
`data-checked`) ship here so a follow-up restyle is a CSS-only change.

**Drag interaction with multi-select**: see G2 above. Drag does **not**
move multiple files; right-click → Move to… is the multi-move path.

**Batch delete**: confirm dialog "Delete N files?"; on confirm
`batchDelete(Array.from(checked))`.

## Keyboard & A11y

### Tree roles

The tree replaces the listbox role on file rows with full WAI-ARIA tree
semantics:

```html
<div role="tree" aria-multiselectable="true" aria-label="Snippets">
  <div role="treeitem"
       aria-level={level + 1}
       aria-expanded={folder ? expanded : undefined}
       aria-selected={focusedPath === path}
       aria-checked={file && checked.has(path) || undefined}
       tabIndex={focusedPath === path ? 0 : -1}>
    ...
  </div>
</div>
```

Folder rows expose `aria-expanded`. File rows expose `aria-checked` only
when multi-select is active (`checked.size > 0`).

### Roving tabindex

`focusedPath` is the single tab stop. Entering the tree via Tab focuses
the row matching `focusedPath`, or the first visible node if
`focusedPath` is null. Arrow-key navigation updates `focusedPath` and
moves DOM focus via `element.focus()`.

### Key bindings (K3 — minimal)

| Key | Behavior |
|---|---|
| ↑ / ↓ | Move `focusedPath` to previous/next visible node (folders and files interleaved, collapsed children skipped). |
| → | folder collapsed: expand. folder expanded: focus first child. file: no-op. |
| ← | folder expanded: collapse. folder collapsed or file: focus parent folder. At root: no-op. |
| Enter | file: `navigate('/snippets/' + id)`. folder: toggle expand. |
| F2 | Enter rename state on `focusedPath`. |
| Delete / Backspace | If `checked.size > 0` and `focusedPath ∈ checked`: batch delete. Else: delete `focusedPath` (folder uses recursive delete with confirm). |
| Cmd/Ctrl + click | File: toggle `checked`. |
| Shift + click | File: range-select from `anchorPath`. |
| Esc | Rename open → cancel. MovePicker open → close. Otherwise, if `checked.size > 0` → clear `checked`. Otherwise no-op. |
| `/` (inside list FocusScope) | Focus the search input. |

Explicitly **out of K3**: Space, Cmd+A, Cmd+C/X/V. These can be added
later without breaking the model.

### Rename keyboard

While in rename state the only handlers active are:
- Enter → commit
- Esc → cancel
- typing → update draft

Tree arrow-keys do not navigate while a row is being renamed.

### Search interaction

- `/` inside the `FocusScope` focuses the TextInput (existing
  `useListKeyboard` behavior is replaced).
- Esc in the search input with a non-empty query: clear query, keep
  focus in input.
- Esc in the search input with empty query: blur input, focus
  `focusedPath` row in the tree.

### Screen reader

- Rename input: `aria-label={t('snippets.aria.renaming', {name: oldName})}`.
- Mutation-in-flight on a row: `aria-busy="true"` on the row's
  `treeitem` element.
- Toasts (sonner) provide a live region by default for success/error
  notifications.
- Batch operations: a single summary toast, not per-item.

## Component Map

Existing files modified:

- `apps/admin/src/features/snippets/components/SnippetList.tsx` — gains
  drag handlers, rename render, treeitem ARIA, roving tabindex; row
  components split into `SnippetFolderRow.tsx` and `SnippetFileRow.tsx`
  if `SnippetList.tsx` exceeds the 500-line cap.
- `apps/admin/src/features/snippets/components/SnippetsRouteViewContent.tsx` —
  hosts new selection / rename / move-picker / drag state; replaces
  `useListKeyboard` with `useTreeKeyboard`.

New files:

- `apps/admin/src/features/snippets/hooks/use-snippet-vfs.ts` — adapter.
- `apps/admin/src/features/snippets/hooks/use-tree-keyboard.ts` — roving
  tabindex + K3.
- `apps/admin/src/features/snippets/components/SnippetMovePicker.tsx` —
  popover picker.
- `apps/admin/src/features/snippets/components/SnippetContextMenuItems.ts` —
  builds `ContextMenuItem[]` for file/folder/multi cases.

Constants / i18n:

- `apps/admin/src/features/snippets/constants.ts` — no change.
- `apps/admin/src/i18n/resources/en-US.ts` and `zh-CN.ts` — add menu
  labels, toast strings, ARIA labels listed above.

## Error Handling

| Failure | Surface |
|---|---|
| Rename / move conflict (409) | Toast with server message; rename: stay in rename state. Move picker: stay open. |
| Batch partial failure | Toast `movedPartial` / `deletedPartial` with `{ok, failed}` counts. Cache is invalidated regardless so the UI reflects truth. |
| Folder delete on non-empty tree | Existing recursive delete path; the confirm dialog states the file count. |
| Drag onto illegal target | Silent (cursor shows disallow); no toast. |
| Network drop mid-mutation | react-query default retry off for mutations; toast on error, no auto-retry. |

## Testing Strategy

Co-located vitest specs in
`apps/admin/src/features/snippets/__tests__/`:

1. `tree-keyboard.spec.tsx` — ↑↓→← Enter F2 Delete Esc traversal across
   folder/file mix, expanded/collapsed transitions, focus boundaries
   (first/last node).
2. `rename.spec.tsx` — file basename rename, folder segment rename
   (recursive prefix rewrite of cache), conflict toast + retained state,
   Esc cancel, blur commit.
3. `multi-select.spec.tsx` — Cmd+click toggle, Shift+click range across
   collapsed folders (skip rule), Esc clears, batch-delete keyboard
   path, multi-source drag downgrade.
4. `drag-drop.spec.tsx` — legal drop (file→folder, folder→folder),
   illegal drop (folder into descendant), no-op (same parent).
5. `move-picker.spec.tsx` — fuzzy filter, "create and move" row
   appearance rule, single + multi commit, partial-failure toast.

E2E left to existing snippet e2e harness; no new playwright journeys
required for v1.

## Migration Notes

- `useListKeyboard` is currently shared with other admin views via
  `~/ui/list-actions`. The replacement `useTreeKeyboard` is
  snippet-local. The existing `useListKeyboard` hook is untouched.
- `selectedPrefix` state (the "next-create destination" breadcrumb in
  the second header row) is preserved as-is; this spec does not
  redesign that affordance (B track).
- The `stagedPrefixes` mechanism (in-memory empty folders) is preserved
  unchanged; an empty folder created via "New folder" still stages
  until its first file save.

## Rollout

Single PR. No feature flag — the tree is admin-only and changes are
behavioral, not data-shape.

## Open Questions

None at spec-approval time. Visual treatment of multi-select rows,
rename input, and drag highlight will be specified in the B track
follow-up.
