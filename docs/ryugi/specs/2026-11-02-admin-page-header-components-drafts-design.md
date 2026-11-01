# Admin page header, dynamic component usage and cleanup, drafts page refresh

**Date:** 2026-11-02
**Scope:** `apps/admin` (layout, dynamic components page, drafts page) and `apps/core` (one usage endpoint, one draft cleanup category)

## Why

1. **Unused components pile up, and nobody can tell which are safe to delete.**
   - Production has catalog entries plus `versions/*.js` files left over from tests, unadopted agent previews and superseded revisions.
   - The admin shows no usage, so the owner deletes nothing.
   - The existing orphan-file scan counts the catalog snippet itself as a reference (`FileReferenceUsageRepository.findReferencedUrls` scans `snippets.raw`). So a registered component, and every old URL kept in `previousUrls`, can never be reported unused.
2. **Every management page is a 320px list column beside an empty detail pane.** On the drafts page the list column carries:
   - a storage summary
   - two rows of filter chips
   - a batch mode toggle
   - a selection bar
   - the rows themselves

   Page-level actions have nowhere else to go.

## Goals

- One reusable page shape: today's master-detail plus a **full-width page header** that holds title, count, filters, page actions and a one-line summary.
- The dynamic components page shows, for every component and every version, which content uses it.
- A one-click cleanup dialog lists what is safe to delete, by category, with safe items pre-checked.
- The drafts page uses the same header and the same cleanup dialog pattern. When nothing is selected, the right pane shows storage and cleanup suggestions. The draft detail leads with what changed against the published version.

## Non-goals

- No migration of the other ~18 `MasterDetailShell` pages in this change. They keep working unchanged and can adopt the header later.
- No change to how components are stored. The catalog stays the `dynamic-widgets-catalog` data snippet, read and written by the admin.
- No new "keep last N snapshots" retention rule for drafts (see Calls, C1).

## Anti-goals (a failure even if it works)

- Cleanup deletes something a **published** post, note or page renders.
- The cleanup dialog pre-checks a category whose deletion breaks a draft the owner is still writing, **except** the "suspected test drafts" category, which the owner explicitly asked to be pre-checked (q6-b).
- The usage view is wrong in the optimistic direction, showing "unused" for something that is used.

## Decisions (from the artboard)

Artboard: `artboard/admin-page-layout`. Path: `.ryugi/artifacts/artboard/admin-page-layout/`. Link: https://ryugi.innei.dev/a/1g5jLVB6l5SbtgRZ0nZMe

| Group | Pick | What it means |
|---|---|---|
| q1 page skeleton | **q1-d** | Keep master-detail. Add a full-width page header above both columns: title and count on the left; filters, search and page actions on the right; a muted one-line summary (counts, storage) below it. The list column holds only rows. |
| q2 component cleanup | **q2-b** | A header button "清理 · 可释放 X" opens a review dialog with categories, safe items pre-checked. Rows carry a usage badge, and the header has usage filters. |
| q3 component usage | **q3-a** | The detail overview shows a preview, then a "版本与引用" timeline: one row per version listing the content that uses it. A version with no users gets a "删除此版本" button. A version used only by content that still points at an old version says "重新发布后这个版本就能删". |
| q4 drafts empty pane | **q4-a** | With no draft selected, the right pane shows storage totals, a breakdown bar and cleanup suggestion cards (each opens the cleanup dialog focused on that category, or toggles auto cleanup). |
| q5 draft detail | **q5-b** | The detail leads with a change summary against the published version (+N added, M changed, −K removed, word delta) and a few changed excerpts, then a one-line snapshot summary with "清理" and "查看全部". |
| q6 drafts dialog default | **q6-b** | "Suspected test drafts" is listed **and pre-checked**. |

Boards q2-b, q3-a, q4-a, q5-b and q6-b are the visual reference. They use the admin dark tokens from `apps/admin/src/styles/tokens.css`. Preview icons are references; use the app's existing icons.

## Part 1: page header for `MasterDetailShell`

- Add an optional `header?: ReactNode` slot to `MasterDetailShell` (`apps/admin/src/ui/layout/master-detail-shell.tsx`). When it is set, render it full width above the list and detail columns. On mobile it sits above the push stack and stays visible on the list screen only.
- Add a `PageHeaderBar` component in `apps/admin/src/ui/layout/` with these props:
  - `title`
  - `count?`
  - `filters?: ReactNode` (segmented controls)
  - `actions?: ReactNode`
  - `summary?: ReactNode` (the muted line)

  Reuse `PageHeader` pieces where they fit.
- Pages that pass no `header` render exactly as today.
- Update `apps/admin/AGENTS.md` Layout Conventions. They wrongly say drafts, comments and topics use `content-layout`; those pages use `MasterDetailShell`. Document the header slot.

## Part 2: dynamic component usage and cleanup

### Core: usage endpoint

`POST /files/references/usage` (auth), body `{ urls: string[] }` (max 500). For each URL it returns:

```ts
{
  url: string
  fileReferenceId: string | null
  bytes: number | null
  published: Array<{ type: 'post' | 'note' | 'page' | 'translation' | 'share'; id: string; title: string; slug?: string }>
  drafts: Array<{ draftId: string; documentId: string; title: string; live: boolean }>
  other: Array<{ type: 'snippet' | 'topic' | 'recently'; id: string; title: string }>
  historyOnly: boolean
}
```

- `published` covers anything that renders on the public site:
  - the current `content` of posts, notes and pages
  - their `ai_translations`
  - pinned shares (`content_document_shares` with mode `pinned`)
- `drafts` covers:
  - the head revision of every active draft
  - the **live collaborative content** of drafts whose CRDT has edits newer than the head. Decode it the way `createCheckpoint` does (`readDocContent` + `materialize` in `draft-crdt.service.ts`) and mark those hits `live: true`. A component inserted since the last save must count as used.
- `other` covers snippets (except the `dynamic-widgets-catalog` snippet itself), topics and recentlies.
- `historyOnly` is true when the URL appears nowhere above but does appear in older `content_revisions`.
- Use the same URL pattern matching as `buildFileUrlReferencePattern`.

### Core: deleting component files

- After an entry or URL is removed from the catalog snippet, its file is an ordinary orphan candidate. Delete it through the existing `DELETE /files/orphans/batch` by `fileReferenceId`. That path re-checks references server side (`filterIsolatedFiles`) and is the safety boundary. Do not add a bypass.
- **Consequence:** a URL referenced only by old revisions (`historyOnly`) is still blocked by the server check. See open question Q2.
- `filterIsolatedFiles` does not read CRDT tables. The re-check at confirm (delete flow, step 1) covers live edits; the race window is the seconds between that call and the delete.

### Admin: categories

Compute these from the catalog plus the usage response:

| Category | Rule | Pre-checked |
|---|---|---|
| 在用 | any `published` | never listed for cleanup |
| 仅草稿引用 | no `published`, some `drafts` | no, warning style |
| 被片段/专栏/说说引用 | no `published`, no `drafts`, some `other` | not listed for cleanup |
| 仅历史版本引用 | `historyOnly` | not listed for cleanup (see Q2) |
| 未使用的组件 | entry whose current URL and all `previousUrls` have no `published`, `drafts` or `other`, and are not `historyOnly` | yes |
| 没人引用的旧版本 | a `previousUrls` member, or an entry superseded by another entry's `parentUrl`, with no `published`, `drafts` or `other`, and not `historyOnly` | yes |
| 未登记的组件文件 | orphan file rows (`GET /files/orphans/list`) whose key starts with `versions/` and ends with `.js`, and that are not in the catalog | yes |

### Admin: delete flow

1. On confirm, call the usage endpoint again for the selected URLs, and drop any that are no longer unused.
2. Remove the rest from the catalog through `mutateCatalog`. This is the step that stops a component rendering, because Yohaku renders only catalog URLs.
   - A removed version leaves `previousUrls`.
   - A removed entry is dropped.
   - If another entry's `parentUrl` points at a removed URL, keep that `parentUrl`; the picker already tolerates dangling parents.
3. Call the orphan batch delete with the collected `fileReferenceId`s.
4. For every URL the server skipped, restore its catalog entry or `previousUrls` member exactly as it was; a skip means something still uses it. Then report what was deleted and what was restored.

### Admin: page

- Header: count, filters (全部 / 在用 / 仅草稿 / 未使用), search, "清理 · 可释放 X" and 注册.
- Summary line: number of components, version files, total size and reclaimable size.
- Rows: name, usage badge (`在用 · N 篇` / `仅草稿引用` / `未使用`), version count and size.
- Detail overview, q3-a: preview, description, then the version timeline. Each row lists `published` items as links to the editor or the public page, plus `drafts`.
- The existing Source tab and props editing stay. The timeline is part of the overview, not a new tab.

## Part 3: drafts page

- Move `DraftListHeader`, `DraftStorageBar` and `DraftListFilters` into the page header:
  - **Filters:** type segmented control, and relation segmented control 全部 / 有改动 / 新稿 / 与发布版一致 with counts from `storage.relations`.
  - **Actions:** search, "清理 · 可释放 X" and 新增.
  - **Summary line:** totals, then the breakdown, then auto-cleanup state.
- Rows: title and updated time on line one; relation tag, version count and size on line two.
  - The checkbox appears on hover, or when any row is selected.
  - Selecting rows shows a selection bar at the bottom of the list column (batch delete through `POST /drafts/batch-delete`).
  - Remove the 批量整理 entry from the header. `/drafts/organize` stays reachable from the cleanup dialog.
- Empty pane, q4-a: storage totals, breakdown bar and suggestion cards built from `GET /drafts/cleanup/preview`:
  - old snapshots (category B)
  - in-sync drafts (A)
  - suspected test drafts (new E)
  - auto cleanup off, which links to `/setting/storage`

  A card's button opens the cleanup dialog scrolled to that category.
- Draft detail, q5-b:
  - The change summary is **new diff logic**. The existing pieces only expose `DraftDiffStats { delta, isSame }`.
    - Lexical drafts: pair blocks by `blockId` between the published revision and the draft head. "Changed" means the text differs; "added" means only the draft has the block; "removed" means only the published revision has it.
    - Markdown drafts: split on blank lines and pair paragraphs with an LCS.
  - Show the counts and the first 3 to 4 changed blocks. "查看完整对比" opens the existing `DraftCompareBar` / `MarkdownDraftDiffPanel`.
  - A fresh draft, which has no published version, shows its first blocks instead.
  - Snapshots collapse to one line with 清理 (compact this draft) and 查看全部 (today's version list).
- Cleanup dialog: restyle `CleanupDialog` to the q6 layout.
  - Categories A-D keep their current meaning and the day cutoff selector (7/30/90/180).
  - Add category **E: suspected test drafts**, pre-checked per q6-b.

### Core: category E

- Add `testDrafts` to the cleanup preview and `E` to the `POST /drafts/cleanup` categories, in `draft-cleanup.service.ts` and `draft-cleanup.schema.ts`.
- **Rule:**
  - the title is the one the drafts list shows for that row (the live title when the draft has unsaved collaborative edits)
  - the relation is `fresh` (never published)
  - idle past the same day cutoff as the other categories
  - the title is empty, `无标题`, or matches `/(^|[-_\s])(e2e|test|tmp|demo)([-_\s\d]|$)/i`
- **Deletion:** same as category A's `removeDraft`.
- **Exclusions:** documents that are publishing, and drafts open in a live collab session (reuse the organize skip checks).
- Do **not** add E to the scheduled auto cleanup.

## Answered by the owner

- **Q1. Yohaku renders only `components[].url`, not `previousUrls`** (`Yohaku/yohaku-oss/packages/rich-content/src/lexical/dynamic-catalog.ts`). Published content that still points at an older version of a revised component may fail to render on the public site, while the admin editor (which also allows `previousUrls` and `parentUrl`) shows it. **Answer: fix it.** Yohaku's allowlist accepts the same URLs as the admin editor's `isAllowedDynamicUrl`. Done as a separate change in the Yohaku repo.
- **Q2. Old component versions referenced only by revision history.** **Answer: (a).** Show them as "仅历史版本引用" and do not offer them for cleanup. They become deletable once draft cleanup prunes that history. No bypass of the server reference check.

## Calls I made (check these)

- **C1.** The mockups said "每篇只保留最近 5 个快照". Core has no count-based retention, only an age cutoff plus protected revisions. The dialog and the suggestion cards use the existing age cutoff and its selector, and the copy reads "N 天前的旧快照" instead.
- **C2.** The usage endpoint lives in the file module next to `findReferencedUrls`. It does not count snippets, topics or recentlies as "use".
- **C3.** Deletion always goes through the existing orphan batch delete, so the server keeps the final say.
- **C4.** The test-draft title pattern above is a starting point. It is also shown in the dialog as "按名字和闲置时间判断".
- **C5.** Only the drafts and dynamic components pages adopt the new header now.
- **C6.** 批量整理 moves from the header into the cleanup dialog footer as a link.
- **C7.** "Used" includes translations, pinned shares and live unsaved collaborative edits. Snippets, topics and recentlies also block deletion, listed separately.
- **C8.** Usage is re-checked at confirm time. Catalog entries are restored when the server skips their file.
- **C9.** The block-count diff is new logic, matched by `blockId` for Lexical and by paragraphs for Markdown.

## Left to the builder

- Exact component structure and file split (keep files under 500 lines, components under 300).
- i18n keys for new copy, in zh-CN and en-US.
- Loading and error states, and mobile behavior of the header (stack filters under the title).
- Tests:
  - the usage endpoint (a published hit, a draft-head hit, a history-only hit, a snippet-only URL that counts as no use)
  - the category E rule
  - the admin category computation as a pure function
