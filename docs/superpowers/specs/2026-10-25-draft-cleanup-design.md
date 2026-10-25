# Draft management and space reclamation

Date: 2026-10-25
Branch: `master` (after the Loro collab work merged in #2870)
Mockups: https://claude.ai/artifact/JmFh9jLm6XFA2tsBS5f7qQ (four artboards)

## Why

Since Lexical drafts moved onto Loro, `content_crdt_docs` grows with every
keystroke of history, and `content_revisions` has always kept every save. Once a
post is published nobody looks at that history again, yet nothing ever frees
it:

- "Delete draft" is a soft delete (`status = 'archived'`), revisions are never
  removed, and for a CRDT draft whose document is published it only restores the
  published content (the CRDT doc grows further).
- Deleting an unpublished CRDT draft leaves `content_crdt_docs` /
  `content_crdt_updates` behind (keyed by document), unreachable until the whole
  post is deleted.
- Local measurement: `content_revisions` 9.1 MB (1063 rows), `content_crdt_docs`
  650 kB for 9 docs (largest snapshot 236 kB), 30 of 43 active drafts belong to
  already-published documents.

Separately, `GET /drafts` is slow: per draft it runs ~8 queries (document, base,
head, published revision, both again inside `compare`, two recursive ancestry
CTEs up to depth ~105) and returns the full `content` + `text` of three
revisions. 50 drafts ≈ 400 queries and a 4.9 MB response.

## Goals

1. Deleting a draft is an immediate, irreversible hard delete that frees its
   space, including CRDT data.
2. A manual "清理空间" action with a preview of what goes and what stays.
3. An optional automatic cleanup, off by default, driven by an age threshold.
4. Per-draft "压缩历史": keep the draft, drop its old history.
5. The draft list shows storage, relation to the published version, and is fast.

## Non-goals

- Recycle bin / undo of deletes. The owner chose immediate hard delete.
- Reviving multi-branch drafts for Lexical. CRDT keeps one working copy per
  document (`ensureWorkingCopy` retires the others); unchanged.
- Changing what publishing stores.
- Trimming CRDT history while a document is being actively edited.

## Anti-goals (a failure even if it "works")

- Losing a draft's current content that has not been published, by any
  automatic path.
- Losing any published version or publication event.
- Breaking a share link, the history/timeline panel, restore, the editor's
  CRDT session, or an open co-author tab into a crash or a silent content
  duplication.
- An FK violation or half-done delete leaving a document unopenable.

## Vocabulary

- **Protected revisions** of a document — never deleted by cleanup or history
  compaction:
  - `content_documents.published_revision_id`
  - every `content_publication_events.revision_id` and `previous_revision_id`
  - `content_document_shares.revision_id` (pinned share)
  - `drafts.base_revision_id` and `drafts.head_revision_id` of every remaining
    draft row of the document
- **In sync draft**: `head_revision_id = document.published_revision_id`
  AND no content edit since: for a CRDT document, `content_crdt_docs.edited_at`
  (new column, §6) is null or ≤ the published revision's `created_at`. CRDT
  typing never moves the head (checkpoints happen on publish), so the head
  check alone would misclassify drafts holding unpublished edits. Before an
  in-sync draft is deleted, cleanup re-verifies it by loading the doc and
  comparing its oplog frontiers with the head revision's `frontiers`; a
  mismatch demotes it to `ahead` and skips it. The owner confirmed in-sync
  drafts may be deleted automatically.
- **Ahead draft**: published document, head differs. **Fresh draft**:
  document never published.
- **Idle**: no edit (draft `updated_at`, CRDT doc `updated_at`, newest
  `content_crdt_updates.created_at`) for N days.

## Behaviour

### 1. Hard delete of one draft (`DELETE /drafts/:id`)

One transaction holding the document's CRDT edit lock
(`withDocumentLock`), so no checkpoint, WS update or HTTP push lands mid-way:

1. Delete the `drafts` row (archived rows of the same document stay, §1a).
2. If no other draft row remains for the document, delete its
   `content_crdt_docs` and `content_crdt_updates`.
3. Share link: `follow` share pointing at this draft → becomes `pinned` to the
   published revision; if the document was never published, delete the share.
4. Delete revisions of the document that are no longer protected (computed
   after step 1, so the draft's own base/head become eligible), re-parenting
   survivors (see §5).
5. If the document was never published (`ref_id` null and no published
   revision) and nothing remains, delete the `content_documents` row too.
6. Remove `FileReferenceType.Draft` references for the draft id.
7. After commit: `collab-room` drops every member of the document's room —
   readers and owner tabs — with a reason (`deleted`). Today the relay only
   revokes one reader with no reason (`collab-room.service.ts` `revoke`,
   `collab-room.ws.ts` relay payload, owner connections skipped); extend the
   relay payload to `{ documentId, readerId?, reason }` where an absent
   `readerId` means everyone. Invites and collaborator rows are kept for
   published documents; for a never-published document deleted in step 5 they
   cascade away with it (accepted).

Atomicity: `withDocumentLock` today only holds an advisory lock while `run`
uses its own connections (`draft-crdt.repository.ts`). The delete must run in
one real transaction: pass the transaction handle through the draft and CRDT
repository calls it needs. File-reference removal (step 6) runs after commit;
it is idempotent.

### 1a. Archived rows

Existing `archived` rows come from two sources that cannot be told apart: a
past soft delete, and `retire()` archiving extra branches when a document
first opened in CRDT mode (those may hold unpublished content). Owner
decision:

- Archived rows count as draft rows for the protected set (their base/head
  stay protected) and for "no other draft row remains".
- Automatic cleanup never deletes them.
- The cleanup dialog lists them as a fifth category E "已归档草稿" with titles
  and sizes; the owner ticks individual rows to hard-delete (§1 per row).
- Hard-deleting the active draft does not delete archived rows of the same
  document; they stay until removed through E.

Next time the owner opens the published post in the writer, a new draft is
created from the published revision (existing `ensureWorkingCopy` path).

This replaces both current branches of `DraftService.delete` (soft archive and
CRDT `discard`). `discard`'s "reset to published" behaviour is gone.

Batch delete in the admin keeps calling the single endpoint per id, or a new
`POST /drafts/batch-delete { ids }` — builder's choice; the latter is
preferred to avoid N round trips.

### 2. Manual cleanup ("清理空间")

`GET /drafts/cleanup/preview?olderThanDays=N` returns, per category, the count
and byte estimate, plus the list of draft ids in category A:

| Key | Category | Action |
|---|---|---|
| A | In sync drafts idle ≥ N days | hard delete as §1 |
| B | Unprotected revisions older than N days | delete + re-parent |
| C | CRDT docs idle ≥ N days | compact (§4) |
| D | Orphans: CRDT rows whose document has no active draft row | delete |
| E | Archived draft rows (manual only, per-row selection) | hard delete as §1 |

`POST /drafts/cleanup { olderThanDays, categories: ['A','B','C','D'], archivedDraftIds?: string[] }` runs
them in that order, one document at a time, each document in its own
transaction under its CRDT lock, and returns what was freed.

Skips: a document with a queued or running publish task (its payload holds
`branchId`/`revisionId`, `publish.service.ts`) is skipped for every category.
There is no cross-pod room registry (room membership is an in-memory map per
pod), so automatic cleanup relies on the idle threshold (≥ 7 days) instead of
a live-room check; a tab left open that long is handled by the epoch (§6).

Byte estimate = `octet_length` of `content` + `text` + jsonb columns for
revisions; `snapshot` + `snapshot_version` + update `bytes` for CRDT; for C,
current snapshot size minus an estimate of the rebuilt size (head revision
content size is good enough). It is an estimate, labelled "约".

`N` minimum 1 for manual, default 30.

### 3. Automatic cleanup

- New config section (in `configs.schema.ts`, owner settings) e.g.
  `draftCleanup: { enabled: false, olderThanDays: 30, categories: {A,B,C,D: true} }`.
  `olderThanDays` minimum 7.
- New cron task type `cron:clean-drafts`, daily at 04:00
  (`EVERY_DAY_AT_4AM`), registered like the other entries in
  `cron-task.types.ts` / `cron-task.scheduler.ts` / `cron-business.service.ts`;
  no-op when disabled. Uses the same service as §2; result recorded in the
  existing cron task log.
- Same skip rules as §2.

### 4. Compact history (one draft, or category C)

`POST /drafts/:id/compact`. Under the document lock:

1. Fold pending `content_crdt_updates` into the doc (existing compaction), then
   export the current content.
2. Build a fresh `LoroDoc` from that exported content and overwrite
   `content_crdt_docs.snapshot`/`snapshot_version` with it — a new replace
   routine; `importDoc`/`createDoc` only insert (`onConflictDoNothing`) and
   build from the head revision. Delete all `content_crdt_updates`, keep
   `fields`, bump the document's epoch (§6). Clear `frontiers` on the
   document's other revisions (they point into the discarded history), set the
   head revision's `frontiers` to the new doc's frontiers and
   `synced_revision_id` to the head — otherwise `openDocument` sees a head
   without frontiers and runs `reconcile` over the rebuilt doc.
3. Delete unprotected revisions of the document (any age for an explicit
   compact; older than N for category C) and re-parent.
4. After commit: room broadcasts `collab.reset { documentId, epoch }`; every
   member (owner tabs, co-authors) drops its session and re-opens from a fresh
   pull. A non-CRDT (markdown) draft gets only step 3.

Consequence (accepted): the timeline loses per-step entries and "undo this
step" for everything before the compaction; surviving checkpoints still
restore from their revision JSON.

Manual compact on a document with live room members is allowed (the owner is
asking for it) — members get the reset.

### 5. Revision deletion and re-parenting

`content_revisions.parent_revision_id` is `ON DELETE RESTRICT`, so before
deleting a set S of a document's revisions, each surviving revision whose
parent is in S gets `parent_revision_id` = its nearest ancestor not in S
(or null). Done in SQL (recursive CTE over the document's revisions) in the
same transaction, then `DELETE ... WHERE id IN S`. No schema change to the FK.

`content_crdt_docs.synced_revision_id` is protected while the CRDT doc
exists (add it to the protected set) — a null value makes `openDocument`
reconcile a head without frontiers.

### 6. Stale CRDT clients (epoch)

Migration (additive, single release):

- `content_documents.crdt_epoch integer not null default 0` — on the document,
  not the CRDT row, so it survives a hard delete that drops the CRDT row; a
  stale co-author tab pushing by document id after the owner reopens would
  otherwise be accepted into the new lineage and duplicate content. Bumped on
  compaction and on every deletion of the CRDT row.
- `content_crdt_docs.edited_at timestamptz` (nullable) — set on every content
  change (`importUpdate`, legacy write, restore, undo), not on compaction or
  checkpoint. Used for "in sync" and "idle".

A rebuilt doc must never accept updates produced against the old lineage
(they would duplicate content or sit pending):

- `GET /drafts/:id/crdt` and the co-author `GET /collab/documents/:id/crdt`
  return the epoch (response header or meta).
- Pushes (HTTP and WS room frames) carry the epoch they were made against; a
  mismatch is refused with a new code `DRAFT_CRDT_EPOCH_CHANGED`.
  `importUpdate` does not take the document lock today, so the check must be
  atomic with the append (e.g. take the lock in `importUpdate`, or a
  conditional insert that joins on the current epoch) — not a read-then-write.
  The automatic compaction's separate `crdt-compact:` lock must also exclude
  the new compaction/delete paths.
- The admin CRDT session (`crdt-sync.ts`, `crdt-draft-session.ts`) treats that
  code and `collab.reset` the same way: re-open the session from a fresh pull,
  toast "草稿已压缩，已重新加载". Unsynced local edits in that tab are lost —
  accepted, since compaction flushes all server-side updates first and
  automatic compaction only touches docs idle ≥ 7 days.

### 7. Draft list (`GET /drafts`) — performance and new fields

Replace per-row `hydrate` in `list` with set-based queries; `GET /drafts/:id`
keeps the full hydrated view.

- One query for the page: drafts ⨝ documents ⨝ head revision selecting
  metadata only (title, contentFormat, createdAt, ids) — never `content`/`text`.
- One aggregate query for the page's documents: revision count and bytes,
  CRDT bytes (snapshot + updates).
- `relation`: `in_sync` (head = published), `ahead` (published, head differs),
  `fresh` (never published). Replaces the ancestry-walk `relationToPublished`
  in the list only; the detail view keeps the existing comparison.
- New filter `relation=in_sync|ahead|fresh`, new sort `sort=updated|size`.
- Summary for the header bar: `GET /drafts/storage` → totals for revisions,
  CRDT docs, pending updates, and the estimated reclaimable bytes at the
  default N (reuse the preview service).
- Check `EXPLAIN` on the new queries; add an index only if a seq scan shows up
  on a hot path (expected: none beyond existing `drafts_updated_at_idx`,
  `content_revisions_document_idx`).

Target: list of 50 in ≤ 5 queries and a response under ~50 kB.

### 8. Admin UI (per mockups)

Feature folder `apps/admin/src/features/drafts/`:

- Header: storage bar (revisions / CRDT / pending, total, reclaimable), "清理空间"
  button, "自动清理：已开启/已关闭" link to the setting.
- Filter chips by relation with counts; sort select (size / updated). Existing
  type filter stays.
- Row: type badge, title, size, relation badge, version count, "含协同数据",
  relative time.
- Selection bar: count, estimated bytes, "压缩历史", "删除".
- Detail: storage cards (revisions / CRDT / protected), version list marking
  keep vs delete, "压缩历史" button, "删除草稿".
- Cleanup dialog: N-days select, categories A–D with counts/sizes, category E
  as an expandable list of archived drafts with per-row checkboxes, the
  always-kept box, destructive confirm "立即清理".
- Delete dialog: "将删除 / 保留" lists, warning when co-authors are online,
  button "删除并释放 X".
- Settings: draft auto-cleanup section with toggle, days, per-category checks,
  last run summary, "预览下次清理" opening the cleanup dialog.
- All strings through i18n (zh + en), following existing keys under `drafts.*`.

## Constraints

- Migration via the `mx-migration-author` rules; only additive change is the
  `epoch` column. `drafts.status` and the `archived` value stay (contract
  later); new code no longer writes `archived` except `retire()`.
- All deletes inside transactions; per-document lock; no partial state.
- API envelope rules from `AGENTS.md`; DTOs in Zod; views for list rows.
- Files ≤ 500 lines, components ≤ 300; no comments except non-obvious intent.
- Tests: repository/service tests on testcontainers for every rule in
  "Protected revisions", re-parenting, orphan detection, epoch refusal, the
  delete transaction (including share and file refs), skip-on-live-room, and
  list query count; admin tests for the session reset path.

## Decided by the owner

- Hard delete, immediate, irreversible.
- Archived rows: never auto-deleted; listed for per-row manual deletion.
- Work lands directly on `master`.
- Automatic cleanup is opt-in, age-based; in-sync drafts may be deleted
  automatically; drafts with unpublished content are never deleted
  automatically, only their history trimmed.
- Mockups approved as drawn.

## My calls (owner may override)

- Auto cleanup at 04:00 daily, minimum 7 days; manual default 30.
- Category D (orphan CRDT rows) has no age limit.
- "In sync" also requires no CRDT edit since publish, re-verified by frontiers
  before deletion.
- Epoch lives on `content_documents`; `edited_at` added to CRDT docs.
- Documents with a pending publish task are skipped.
- No cross-pod live-room check; idle threshold + epoch cover open tabs.
- Compaction resets open tabs instead of trying to merge; unsynced edits in a
  stale tab may be lost.
- Invites and collaborator rows survive draft deletion of published
  documents; they cascade with a deleted never-published document.
- Unpublished documents with no remaining draft are deleted entirely.

## Left to the builder

- Batch delete endpoint shape; exact preview response shape.
- How epoch travels (header vs field) as long as both HTTP and WS paths
  enforce it.
- Whether `synced_revision_id` is protected or reconcile handles null.
- Query shapes and any index, backed by `EXPLAIN`.

## Implementation rulings

- Auto cleanup runs at 04:30, not 04:00, to stay clear of the 04:00 search
  index rebuild.
- No client-side epoch: a stale client is caught by the server. Pushes fail
  `vetUpdate` (missing deps); pulls whose version vector lacks the current
  lineage's root change get `DRAFT_CRDT_STALE` (409) and the admin reloads the
  session. The epoch on `content_documents` only closes the race between a
  push and a cleanup transaction (share lock in `appendUpdate`, row lock in
  `withDocument`).
- Field edits (`PATCH /drafts/:id/fields`) stamp `edited_at`; the in-sync
  re-check compares content, title and fields.
- A push answered with `DRAFT_NOT_FOUND` is terminal: the editor locks and
  stops retrying.
- The settings section is the generated form (toggle, days, four switches);
  the last-run summary lives in the cron task log, and the Maintenance page
  gains a "草稿空间" card that opens the cleanup dialog.
- Relation chip counts follow the type filter but not the search.
- A cleanup that cannot proceed safely (content changed underneath) answers
  `DRAFT_CLEANUP_CONFLICT` (409) instead of 500.

