# Admin Tree-Shaped Revision, Draft, and Publish Refactor

Date: 2026-08-31

Status: implementation contract

This document replaces the previous linear-draft design. The old design is not a compatibility
target.

## 1. Objective

Admin must allow an editor to start from any published or draft revision, continue saving on that
lineage, and publish the selected result even when newer or independently-created drafts exist.

The system must preserve every unrelated draft branch. “Latest” is only a display sort; it never
grants publication authority.

## 2. Product contract

1. Opening an article by article identity shows the current published article.
2. Opening a draft explicitly shows that draft branch.
3. Editing the published article creates a new branch from the published Revision, regardless of
   how many other drafts exist.
4. Editing an existing draft appends a child Revision to that branch.
5. Publishing selects one immutable Revision. It does not publish “the latest draft”.
6. Publishing never deletes, merges, rewrites, or deactivates unrelated branches.
7. A draft branch and the current online Revision may diverge without becoming a write conflict.
8. “Draft updated elsewhere” is reserved for the same DraftBranch Head advancing concurrently.
9. If the online pointer advances after editing starts, Admin presents a divergent-publication
   review. The user may inspect the three-way difference and explicitly publish the selected
   Revision.
10. Publication visibility, draft lineage, Publish Job state, and AI resource intent remain
    independent.

## 3. Vocabulary

| Term               | Meaning                                                                             |
| ------------------ | ----------------------------------------------------------------------------------- |
| Document           | Stable writing identity that exists before or after a public article row is linked. |
| Revision           | Immutable, complete content snapshot with zero or one parent Revision.              |
| DraftBranch        | Editable pointer with a fixed base Revision and a movable Head Revision.            |
| Published Revision | The Revision currently projected into the public article row.                       |
| Publication Event  | Immutable record that one Revision replaced another online Revision.                |
| Branch Head        | The latest saved Revision on one DraftBranch.                                       |
| Common ancestor    | Nearest Revision shared by the online and draft ancestry chains.                    |
| Linear             | One compared Revision is an ancestor of the other.                                  |
| Diverged           | Neither compared Revision is an ancestor of the other.                              |

The normal Admin UI uses “线上版本”, “草稿”, “最近保存”, and “版本分支”. Internal IDs and numeric
revision counters are not user-facing.

## 4. Domain invariants

1. A Revision is immutable after insertion.
2. A Revision belongs to exactly one Document.
3. A Revision has at most one parent. This release implements a tree, not multi-parent merge
   commits.
4. A DraftBranch belongs to one Document and references a base and Head Revision from that same
   Document.
5. Saving performs compare-and-swap on `expectedHeadRevisionId`, inserts one child Revision, and
   moves the branch Head atomically.
6. A Document has at most one current `publishedRevisionId`.
7. Publishing performs compare-and-swap on `expectedPublishedRevisionId` only to detect that the
   online pointer changed during review. A deliberate divergent publish may retry with the newly
   acknowledged online pointer.
8. Publication copies the selected immutable Revision into the public post, note, or page row and
   then records the new pointer and Publication Event.
9. A Revision referenced by a branch, publication pointer, or Publication Event is never deleted.
10. Archiving a branch removes it from ordinary recovery surfaces but preserves its Revision
    lineage.
11. Other branches do not participate in save or publish concurrency.
12. Full snapshots are stored for every Revision. Parent links exist for ancestry, Diff, and future
    merge decisions, not for reconstructing content from patch chains.

## 5. Persistence model

### 5.1 `content_documents`

```ts
interface ContentDocumentRow {
  id: string
  refType: 'post' | 'note' | 'page'
  refId: string | null
  publishedRevisionId: string | null
  createdAt: Date
  updatedAt: Date
}
```

`(refType, refId)` is unique when `refId` is non-null. New content receives a Document before its
public article row exists.

### 5.2 `content_revisions`

```ts
interface ContentRevisionRow {
  id: string
  documentId: string
  parentRevisionId: string | null
  title: string
  text: string
  content: string | null
  contentFormat: 'markdown' | 'lexical'
  images: Image[] | null
  meta: Record<string, unknown> | null
  typeSpecificData: Record<string, unknown> | null
  createdAt: Date
}
```

Every row is a complete canonical snapshot. No legacy diff payload, `refVersion`, `baseVersion`,
or mutable version counter remains.

### 5.3 `drafts`

`drafts` now represents branches, not content rows.

```ts
interface DraftBranchRow {
  id: string
  documentId: string
  baseRevisionId: string
  headRevisionId: string
  status: 'active' | 'archived'
  createdAt: Date
  updatedAt: Date
}
```

Multiple active DraftBranches may belong to one Document. There is no unique draft-by-reference
constraint.

### 5.4 `content_publication_events`

```ts
interface ContentPublicationEventRow {
  id: string
  documentId: string
  revisionId: string
  previousRevisionId: string | null
  createdAt: Date
}
```

Every successful first publish, online update, or explicit republish records the selected
Revision.

## 6. Canonical snapshot

One canonical projection is used for Revision insertion and semantic equality, Admin dirty state,
two-way and three-way Diff inputs, Publish Job payloads, and AI resource freshness.

The projection excludes publication visibility, branch status, AI selections, task state,
timestamps, and transient editor decorations.

## 7. Commands

### 7.1 Open version context

`GET /drafts/context/:refType/:refId`

The server returns or creates the Document and a published Revision matching the current article
projection, then returns its published Revision and active branch summaries. Core, not Admin, owns
ancestry and relation calculation.

### 7.2 Create a branch

`POST /drafts`

```ts
interface CreateDraftBranchCommand {
  refType: DraftRefType
  refId?: string
  baseRevisionId?: string
  data: DraftWriteData
}
```

Editing an existing article requires the displayed `baseRevisionId`. New content creates a
Document and root Revision. Existing branches never block branch creation.

### 7.3 Save a branch

`PUT /drafts/:branchId`

```ts
interface SaveDraftBranchCommand {
  expectedHeadRevisionId: string
  data: DraftWriteData
}
```

The server returns the existing Head on a canonical no-op. Otherwise it inserts a child Revision
and atomically moves the branch Head. If the same branch changed, it returns
`DRAFT_HEAD_CONFLICT`; another branch or another base is never a save conflict.

### 7.4 Start from any Revision

The current published Revision, a historic published Revision, or a draft Revision can be the base
of a new branch. The first real save creates its child.

### 7.5 Archive a branch

`DELETE /drafts/:branchId` archives the branch. Revision rows remain intact.

### 7.6 Publish a Revision

`POST /publish-jobs`

```ts
interface CreatePublishJobCommand {
  aiResources: PublishAiResource[]
  branchId: string
  revisionId: string
  expectedPublishedRevisionId: string | null
  confirmDiverged: boolean
}
```

The server verifies that `revisionId` is the selected branch Head and freezes that Revision. If the
online pointer changed, it returns `PUBLISHED_REVISION_CHANGED` until Admin resubmits the newly
observed pointer with `confirmDiverged: true`. Unrelated branches never block publication.

After success, the selected branch derives as clean while its Head equals the published Revision.
Other branches remain active.

## 8. Ancestry and Diff

Core compares any two Revisions as `same`, `ancestor`, `descendant`, or `diverged` and returns their
nearest common ancestor.

Linear review uses online → draft Diff. Diverged review separates common ancestor → online and
common ancestor → draft, identifies overlapping fields/body regions, and previews the selected
snapshot that would become online.

This implementation does not add multi-parent merge commits or automatically merge divergent rich
text. It permits explicit publication after review.

## 9. Admin derived modes

| Online relation                   | Branch state | Admin mode                                         |
| --------------------------------- | ------------ | -------------------------------------------------- |
| No branches                       | Clean        | Ordinary article editor                            |
| One branch, online is ancestor    | Linear       | Fixed status-row branch entry and two-way Diff     |
| Multiple active branches          | Any          | Status-row branch count and branch panel           |
| Selected Head and online diverged | Diverged     | Three-way review and explicit publish confirmation |

## 10. Admin entry and editing UX

Opening `?id=<articleId>` displays the current article. Existing branches are offered without
replacing its editor buffer. The first real edit creates a new branch from the displayed published
Revision.

Opening `?id=<articleId>&draftId=<branchId>` displays that branch Head and makes it the save target.

The always-present editor status row reports publication and save state. When branches exist, it
adds a compact `3 个分支` action without changing row height. The fixed-size version button in
the header shows the same count as an overlaid badge, so the first save never inserts new content
into the editor flow or causes layout shift.

Both entries open `版本与草稿`. Source switching and Diff remain explicit actions inside the panel.
Internal IDs are never shown. A full-width banner is reserved for an actual same-branch save conflict,
not ordinary draft existence or a successful save.

## 11. Version branch panel

Desktop uses a docked, resizable right-side `版本与草稿` panel beside the editor. Mobile uses the
same task-oriented view in a full-height sheet. The current online Revision is pinned at the top.
Active DraftBranch Heads are grouped by their actual base Revision: current online, an earlier
publication, another draft, or unpublished content. Cards remain the same width at every ancestry
depth; the parent relationship is expressed by the group label instead of recursive indentation.

Linear autosave Revisions remain collapsed inside their branch and load only when expanded.
Publication history is a separate collapsed section. Selecting a draft previews its comparison
without changing the editor; `Continue editing` is the only action that switches the editor source.
The default comparison is the selected branch Head against the current online pointer. Internal
Revision and branch IDs are never rendered.

Each branch offers continue editing, compare with online, publish this Head, inspect branch
history, and archive. With many branches, the panel collapses history and sorts or paginates by
last save time. “Recently saved” is not authority.

After publication, the online badge moves to the published Revision. The branch remains visible;
further edits append children after the published node. Deleting a draft removes its active branch
entry while retained publication history remains visible.

## 12. Publish confirmation

When online is unchanged, use ordinary confirmation with non-blocking context:

> 将发布当前编辑版本。其他 3 份草稿会继续保留。

When online advanced or diverged, show:

> 当前草稿基于较早的线上版本。线上内容此后已有 5 项修改。继续发布将以当前草稿更新线上文章，其他草稿不会删除。

Actions are `查看三方差异`, `返回编辑`, and `以当前草稿更新线上`. This is “版本已分叉”, not
“草稿在其他位置更新”.

## 13. User-facing language

- `已发布` — article visibility only;
- `草稿已保存` — current branch Head persisted;
- `正在基于线上版本编辑` — branch source;
- `线上版本此后已有更新` — publication ancestry changed;
- `同一草稿已在其他位置更新` — same branch Head CAS failed;
- `线上文章已更新` — selected Revision committed online.

Do not expose raw version numbers or use generic conflict wording for ordinary divergence.

## 14. Publish Dock and AI resources

Publish Dock stays server-backed and identifies the frozen branch and Revision. AI selections
belong to one Publish Job and are empty on entry. Publishing a branch never mutates another branch
or pre-deletes unselected online resources.

## 15. External writers and CLI

Admin, CLI, Agent, and external writers all load VersionContext, choose a base or branch, save via
Head CAS, and publish a selected Revision via online-pointer CAS. No direct article mutation or
numeric draft-version endpoint remains.

## 16. Removed architecture

The implementation deletes, rather than aliases:

- unique `(refType, refId)` draft ownership;
- mutable content columns, `version`, `history`, and `publishedVersion` from `drafts`;
- `draft_histories` and compressed patch reconstruction;
- singular `GET /drafts/by-ref/:refType/:refId`;
- numeric `expectedVersion` save and publish DTOs;
- assumptions that one article has one recoverable draft;
- ordinary divergence flowing through `DRAFT_VERSION_CONFLICT`;
- tests and completion claims tied to the linear contract.

A one-time migration may read legacy tables to preserve data and drops them after conversion. It is
not runtime compatibility code.

## 17. Migration

The release ships one schema migration, `0035_tree_content_revisions`. The existing combined
`pnpm migrate` entrypoint applies that schema migration and then runs the app-data conversion.

1. Rename legacy draft tables.
2. Create Documents, immutable Revisions, branch-shaped `drafts`, and Publication Events.
3. Convert each legacy draft and its history into a Revision chain and one DraftBranch.
4. Map a trustworthy published version to `publishedRevisionId`; otherwise snapshot the current
   article as the published Revision.
5. Convert unreferenced drafts into standalone Documents and branches.
6. Verify every legacy Head and linked publication was represented.
7. Drop legacy tables.

The app-data migration is idempotent and runs under the existing advisory lock.

## 18. Required behavioral checks

### Branches

1. With 100 existing branches, editing online creates branch 101 from the published Revision.
2. Saving branch A changes only A; saving different branches never conflicts.
3. Two clients saving the same Head produce one child and one `DRAFT_HEAD_CONFLICT`.
4. Starting from any historic published or draft Revision creates the correct child lineage.

### Diff

5. Linear review uses online → draft Diff.
6. Diverged review returns the nearest common ancestor and separates online-only, draft-only, and
   overlapping changes for Markdown and rich content.

### Publication

7. Any selected Head can publish while newer branches exist.
8. Publishing preserves every unrelated branch.
9. Online-pointer movement requires explicit acknowledgement; unrelated branch movement does not.
10. Editing during a Publish Job preserves the newer Head while the frozen Revision publishes.
11. First publish links the Document and records the published Revision.

### Admin

12. Article entry identifies the online version and independent drafts.
13. Direct online editing creates a new branch without loading another draft.
14. The version panel groups branches by their real base Revision without recursive indentation,
    collapses autosaves and publication history, remains usable with many branches, and exposes no
    internal IDs.
15. Divergent publish shows specialized copy and three-way review.
16. Archiving removes ordinary recovery but preserves history and publication references.
17. Reopening after publish still exposes every unrelated branch.

## 19. Delivery gates

Implementation is complete only when the schema has one tree model, Core/Admin/CLI have no linear
callers, focused behavior tests cover branch isolation and both CAS boundaries, production builds
pass, and authenticated desktop/mobile acceptance proves branch creation, preservation, divergent
review, and selected-branch publication.

## 20. Completion checklist

| Outcome                                 | Implemented | Verified |
| --------------------------------------- | :---------: | :------: |
| Tree persistence and migration          |     Yes     |   Yes    |
| Multiple DraftBranches                  |     Yes     |   Yes    |
| Immutable full-snapshot Revisions       |     Yes     |   Yes    |
| Branch Head CAS                         |     Yes     |   Yes    |
| Published pointer and events            |     Yes     |   Yes    |
| Ancestry and common-ancestor comparison |     Yes     |   Yes    |
| Admin online-entry branch creation      |     Yes     |    No    |
| Fixed source status and branch panel    |     Yes     |   Yes    |
| Linear and divergent Diff               |     Yes     |   Yes    |
| Divergent publication acknowledgement   |     Yes     |   Yes    |
| Publish Dock Revision identity          |     Yes     |   Yes    |
| CLI branch and Revision commands        |     Yes     |   Yes    |
| Legacy linear code removed              |     Yes     |   Yes    |
| Desktop and mobile acceptance           |     No      |    No    |

No row may change to `Yes` without current code and behavioral evidence.

### Current evidence — 2026-08-31

- Core, Admin, CLI, and DB schema type checks pass; Core migration lint passes. A PostgreSQL migration
  test converts a published legacy version plus its later draft, verifies the publication pointer and
  branch ancestry, preserves JSON image data, and verifies that both legacy tables are dropped. The
  real local app migration converted 24 legacy branches and 964 revisions before Core started normally.
- Core, Admin, CLI, and Mongo-to-Postgres CLI production builds pass. The obsolete Mongo draft importer
  was deleted instead of writing the removed linear schema.
- CLI full suite passes: 56 files, 729 tests.
- Focused tree/publish and Admin diff/publish behavior suites pass. The Core full suite has one
  unrelated, independently reproducible calendar e2e failure; the Admin full suite has one unrelated,
  independently reproducible mobile `ContentLayout` failure.
- Version projection tests prove publication markers, real fork points, branch Heads, and collapsed
  autosave paths. Admin behavior tests prove source grouping for current online, historical
  publication, and draft bases; lazy autosave expansion; collapsed publication history; hidden
  internal IDs; click-to-compare; and explicit-only source switching.
- Ordinary draft saves update the fixed-height editor status row and an overlaid header badge; they
  no longer insert a branch banner into the editor flow.
- Current Core and Admin type checks, focused suites (10 Core tests and 7 Admin tests), and production
  builds pass after the version-tree implementation.
- Runtime searches find no numeric draft-version endpoint, singular by-ref draft API, mutable draft
  history, or legacy conflict code outside the one-time conversion path.
- The full desktop/mobile branch-creation, preservation, divergent review, and selected-branch publish
  flow remains unverified. Acceptance registration is blocked because the local `lh` client is not
  authenticated.
