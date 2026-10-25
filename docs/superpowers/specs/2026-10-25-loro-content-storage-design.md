# Loro as the content store for drafts

Date: 2026-10-25
Status: draft, pending approval
Phase 1 of 4 in the collaborative editing track (see "Track").

## Intent

The author wants articles to be co-written live: the author, invited readers
(co-authors) and AI agents all editing one document, each with a visible
cursor, every change attributed, and any single step revertible. That needs a
CRDT underneath the editor. haklex already ships one binding,
`@haklex/rich-collab-loro` (Lexical ↔ LoroTree), and `mxs author` already runs
a human + agent session on it.

Today's draft system cannot carry that. It is a git-like model built to
survive conflicts: `content_revisions` is a snapshot chain, `drafts` are
branches with base/head pointers, saves use an optimistic lock
(`expectedHeadRevisionId` / `DRAFT_HEAD_CONFLICT`), and the admin write page
carries a three-way merge, a conflict dialog and a version tree to cope. In
the author's words, draft branches only exist because of conflicts. A CRDT
makes conflicts disappear, and with them the reason for branches. Two
histories (Loro's oplog and our revision chain) both claiming to be the truth
is the clash this phase removes.

This phase swaps the storage under the editor and nothing else: one user (the
owner), one admin write page, HTTP sync. Realtime transport, the server-side
AI peer, and the co-author page come in later phases and build on this one.

## Track

1. **This document.** Loro doc per content document is the source of truth;
   history becomes a linear timeline of checkpoints; branches and the
   optimistic lock go away.
2. Realtime room over WebSocket (`collab.*` events on the existing
   `@mx-space/ws-client` envelope), presence and cursors.
3. Server-side AI peer that writes straight into the doc.
4. Co-author page (`#/collab/:documentId` inside admin), invite links,
   reader OAuth login, per-document AI quota, byline.

Each phase gets its own design. Phase 2 and 3 protocol work is being aligned
with the Write Agent WebSocket design in a parallel session; nothing here may
assume the transport.

## Decisions made by the author

- Loro's history replaces our own. The existing draft history conflicts with
  it and should not be maintained alongside it.
- Draft branches are not useful and go away. The one thing branches did that
  matters, "go back to an old version, keep editing, and the newer history
  still exists", is covered by Loro's revert-as-new-ops (`revertTo`, or
  restoring a checkpoint as a new commit). History stays linear and nothing
  is lost.
- Reverting works at two grains: the whole document back to a point, and a
  single step (one AI turn, one human edit run) undone on its own while later
  edits survive.
- AI edits land directly in the document like a human's and are reverted after
  the fact if unwanted. (Matters from phase 3; this phase must not block it.)
- Markdown is deprecated. Nothing new is built for Markdown content.
- A CLI save-and-publish publishes only what the CLI changed on top of the
  published version, never the owner's unfinished work in the admin. The CLI
  change is also merged into the working copy, so a later publish from the
  admin keeps it.
- The author asked for a prototype first. It was built and confirmed the
  interaction (see "Prototype findings").

## Goals

- Every Lexical content document (post, note, page) has exactly one Loro doc,
  stored in PostgreSQL, which is the source of truth for its working content.
- The admin write page edits through the Loro binding. Saving never conflicts.
  Two admin tabs (or devices) editing the same document converge without a
  dialog.
- History is one linear timeline per document: checkpoints (saves, publishes,
  restores, undos, imports) plus the Loro change log, attributed by peer.
- Restore a checkpoint, and undo a single step, both as new commits.
- Everything outside the editor keeps working on materialized snapshots:
  publish, share links, Yohaku `/preview/:token`, the dashboard desk, AI cover,
  file references, the CLI.
- No existing revision is lost.

## Non-goals

- Realtime transport, presence, cursors (phase 2). Phase 1 syncs over HTTP.
- Server-side AI peer, co-authors, invites, reader auth (phases 3 and 4).
- Shallow snapshots / history trimming.
- Replaying pre-existing revisions into the Loro oplog. Old revisions stay as
  checkpoints with materialized content only.
- Any change to Markdown documents.
- Changing the public API consumed by Yohaku (`GET /drafts/shared/:token`).

## Anti-goals

- Publishing content that differs from what the owner saw when they pressed
  publish.
- A document whose Loro doc and visible checkpoints disagree with no way back
  (every import or legacy write must leave a checkpoint).
- Losing an edit during the rolling-deploy window, when old pods still accept
  legacy `PUT /drafts/:id` saves.
- A second history system creeping back (e.g. the client keeping its own
  revision chain or merge logic).

## Prototype findings

Throwaway branch `spike/collab-room` (worktree `../mx-core-spike-collab`)
extended the `mxs author` local server into a multi-client room. Verified with
two independent browsers plus an agent editing the file on disk:

- Two people typing in different paragraphs converge; an agent rewrite merged
  while a human kept typing, both kept.
- Single-step undo of the agent turn: on a fork,
  `fork.applyDiff(doc.diff([lastIdOfStep], depsOfStep), { fullState: true })`,
  commit, export the update and import it into the main doc. The agent's
  paragraph came back; human edits made before and after it survived; both
  clients synced; the file persisted. This is the undo used below.
- Not covered: undoing a grouped row when another peer's changes interleave
  inside the group (they would be reverted too).
- The spike's agent writes through `streamAtVersion`, which forks and
  therefore gets a fresh PeerID per turn. Phase 3 must give each agent session
  a fixed PeerID. Not a phase 1 concern, but phase 1 must store commit
  messages and peers so phase 3 can attribute.

## Design

### What lives in the Loro doc

One `LoroDoc` per `content_documents` row:

- `lexical` tree — the body, via `createLoroBinding` (`TREE_NAME`).
- `title` — `LoroText`.

Nothing else. `meta` and `typeSpecificData` (slug, category, tags, note
`password`, paywall settings in post `meta`, …) stay **out** of the CRDT and
live on the working copy (see "Metadata fields"). (Designer's call.) Reason:
Loro history cannot be redacted, and from phase 4 co-authors sync the whole
doc, so every value ever stored in it would reach them; co-authors also do not
edit metadata. Deciding this now avoids rewriting history later.

`text` (Markdown rendering) and `images` are not stored; they are derived when
materializing. `contentFormat` is always `lexical`.

### Metadata fields

- New nullable column `content_crdt_docs.fields jsonb`: the working copy's
  current `{ meta, typeSpecificData }`, normalized with `canonicalSnapshot`
  rules.
- Written by the owner through a JSON endpoint that takes only the keys that
  changed and merges them per top-level key (last writer wins per key), so
  two tabs editing different fields do not clobber each other.
- Every checkpoint copies `fields` into its `meta` / `typeSpecificData`
  columns, so restore, compare, share and publish see them as today.
- Metadata changes appear in the timeline as checkpoints, not as Loro steps,
  and are not undoable step by step. Restoring a checkpoint restores its
  fields too.
- **Edits made outside drafts flow in.** `PATCH /posts/:id` (`categoryId`,
  `pinAt`), `PATCH /notes/:id` (`mood`, `weather`, `topicId`, `bookmark`) and
  the AI slug backfill change the live article directly. When the document
  has a working copy, the same service call also merges those keys into
  `fields`. Otherwise the long-lived working copy would undo them on the next
  publish. (Designer's call.)

Commit messages carry attribution: `human:<readerId>`, `agent:<summary>`,
`restore <checkpointId>`, `undo <peer>@<counter>`, `import <revisionId>`,
`legacy-save <revisionId>`. Phase 1 only produces the owner's `human:` plus
the server-side kinds; the format must not need changing for phases 3 and 4.

### Storage

All additive (single release, expand only):

- `content_crdt_docs`: `document_id` (PK, FK → `content_documents`, cascade),
  `snapshot bytea`, `snapshot_version bytea` (encoded version vector covered
  by the snapshot), `synced_revision_id` (FK → `content_revisions`, the
  checkpoint whose content the doc last matched or produced), `fields jsonb`
  (see "Metadata fields"), `updated_at`.
- `content_crdt_updates`: `id` (snowflake), `document_id` (FK, cascade),
  `bytes bytea`, `created_at`. Append-only. Loro merges are commutative, so
  two replicas appending concurrently need no lock.
- Compaction: when a document's pending updates pass a threshold, a replica
  takes a PostgreSQL advisory lock on the document, imports snapshot + updates,
  writes a new snapshot and deletes exactly the update rows it folded in.
  Loading is snapshot + every remaining update row. Do not filter by
  `id >` some maximum: snowflake ids from two replicas do not commit in id
  order, so a lower id can commit after compaction. Re-importing an update
  Loro already has is a no-op.
- `content_revisions`: add nullable `frontiers jsonb` and `kind text`
  (`save | publish | restore | undo | import | legacy-save`). Existing rows keep
  `frontiers = null`, `kind = null` (read as legacy). `parent_revision_id`
  links each new checkpoint to the previous one, so the chain is linear from
  here on.

### The working copy

Most consumers key on a branch id: publish jobs (`branchId`), file references
(`FileReferenceType.Draft`), share links in follow mode (`draft_id`), the
`?draftId=` URL, AI cover, content migration, the desk, the CLI. To keep this
phase's blast radius small, the `drafts` table stays, with a new invariant:

- **At most one active `drafts` row per document: the working copy.** Its id
  is the stable handle for the Loro doc. Its `head_revision_id` is the latest
  checkpoint. `base_revision_id` is kept as-is and no longer means anything.
- Existing documents with several active branches: on first load through the
  new path, the most recently updated active branch becomes the working copy;
  the others are archived. Their revisions remain and are restorable from the
  timeline. A follow-mode share pointing at an archived branch is converted to
  a pinned share at that branch's head, so its readers keep seeing the same
  content. (Designer's call.)
- A document with no active branch (all archived, or published-only) gets a
  new working copy seeded from the published revision on first load.

**Discarding the draft.** `DELETE /drafts/:id` (write page, drafts list bulk
delete, `mxs draft delete`) on a working copy restores the published
checkpoint as a new commit (`restore`, as below) instead of archiving: the
working copy goes back to what is live, and the discarded work stays in the
timeline. For a document that was never published, it archives the working
copy and the document drops out of draft lists, as today. (Designer's call,
following "revert is a new commit, nothing is lost".)

Renaming or retiring the `drafts` table is a later cleanup, not this phase.

### Checkpoints

A checkpoint is a `content_revisions` row with `frontiers` set and the full
materialized snapshot (title, text, content, images, meta, typeSpecificData).
Everything that reads revisions today keeps reading these rows.

Created by:

- The write page: on ⌘S, and on the existing 10-second idle timer (which today
  does `PUT /drafts/:id`). Skipped when the materialized content equals the
  previous checkpoint (`sameRevisionContent`).
- The server: before a publish job, on restore, on undo, on import, on a
  legacy write.

File references for the working copy are refreshed when a checkpoint is
created, not on every update.

### Materializing on the server

`apps/core` gains `loro-crdt` (Node build) and `@haklex/rich-collab-loro`, and
binds a headless Lexical editor (from `@haklex/rich-headless`) to the doc to
read the body as Lexical JSON, then derives `text` with the existing
`helper.lexical.service` `$toMarkdown` path.

Risk the builder must cover: the headless node set must register every node
type the admin editor can produce (including admin-only ones such as
`CatalogDynamicEditNode` (`dynamic`) and `AgentDiffEditNode`), or binding and
import fail. `mxs author`'s `createAuthorHeadlessEditor` already solves this
for the CLI and is the reference.

### Sync API (phase 1, HTTP)

Owner-only (`@Auth()`), binary bodies, `@HTTPDecorators.RawResponse`:

- `GET /drafts/:id/crdt` → full snapshot.
- `GET /drafts/:id/crdt?since=<base64 version vector>` → updates the caller
  lacks.
- `POST /drafts/:id/crdt` (octet-stream) → import. The server validates on a
  fork before appending: size limit, the update does not add a second root to
  the `lexical` tree (the `mxs author` lineage check), and the result still
  materializes. Rejected updates return an `AppException`.

A rejected update is already in the client's local doc, and every later local
update depends on it, so that tab can never sync again. On rejection the
client reloads the doc from the server and re-applies its own materialized
content as one legacy write (below), then continues on the fresh doc. The
user's text survives; their step history for that session collapses into one
`legacy-save`. (Designer's call.)

No client-side persistence of unsent updates (IndexedDB) in phase 1. Updates
leave the browser in ~100 ms batches, which is more durable than today's
10-second `PUT`. A failed send stays queued in memory and is retried, and the
page warns on unload while anything is unsent, as `mxs author` does.

After a successful append the server emits the existing `draft.update` admin
broadcast (payload unchanged in shape; `headRevisionId` is the latest
checkpoint). Other tabs react by pulling `?since=`. Phase 2 replaces both the
POST/GET pair and this signal with `collab.*` frames.

Endpoint names are the builder's call; the semantics are not.

### Legacy whole-document writes

`POST /drafts` and `PUT /drafts/:id` keep their request shapes, because the CLI
(and old admin builds during cutover) use them. They become "apply this whole
snapshot to the working copy at a known version":

- `PUT /drafts/:id {data, expectedHeadRevisionId}`: take the frontiers of the
  `expectedHeadRevisionId` checkpoint and apply the body there with
  `editAtVersion` (a three-way merge against everything since). `editAtVersion`
  only touches the `lexical` tree, so the title is applied at the same version
  separately. For metadata, merge only the keys whose value differs from that
  checkpoint into `fields`. Commit as `legacy-save`, create a checkpoint,
  return the working copy view. `DRAFT_HEAD_CONFLICT` is no longer thrown.
- A legacy write carrying `contentFormat: markdown` to a document on the Loro
  path is rejected (400). (Designer's call.)
- If the base checkpoint has no frontiers (a legacy revision), apply at the
  doc's current frontiers instead (last writer wins for that write).
- `POST /drafts` with a `refId` or `baseRevisionId` on a document that already
  has a working copy writes into it the same way, with the base checkpoint as
  the version. Without a document it creates the document, the working copy
  and the Loro doc.

**A legacy write produces two checkpoints, and returns the first.** The CLI
saves `published + patch` with `baseRevisionId = published`
(`cli/draft/_shared.ts:124`), then publishes the returned `headRevisionId`
(`publishSavedDraft`, `:198`; used by `note edit --publish` and friends). The
author decided that this must publish only what the CLI changed, never the
owner's unfinished work in the working copy, while the working copy must also
keep the CLI's change. So every legacy write:

1. Creates **the write's own checkpoint**: the base plus this write, nothing
   else. When the base checkpoint has frontiers, it is the fork state right
   after `editAtVersion` at those frontiers. The ops are real, so the
   checkpoint stores those frontiers and is a genuine version of the doc.
   When the base has no frontiers (a legacy revision), the server builds the
   content from the base's materialized content plus the write without Loro,
   and the checkpoint stores no frontiers. Either way it carries the full
   materialized snapshot, so publish can use it.
2. Imports the same ops into the doc, which merges them with everything since,
   and creates a `legacy-save` checkpoint at the new head. That checkpoint
   becomes the working copy's `head_revision_id`.
3. Returns the working copy view with `headRevision` / `headRevisionId` set to
   checkpoint 1, the revision this write produced. This differs from the
   working copy's stored head, and the response documents it as such.

The CLI therefore keeps its request shapes and publishes exactly
`published + patch`. The owner's unpublished work stays unpublished and now
includes the CLI change. The existing `newerDraftChanges` report then tells
the publish caller that the working copy holds more than what went live.

### Lazy import and the cutover window

No batch migration. A document gets its Loro doc the first time the new path
touches it (open in the write page, a legacy write, a publish):

1. Pick the working copy (above).
2. Create the doc from its head revision's content in one commit,
   `import <revisionId>`, and set `synced_revision_id`.

During the rolling deploy, old pods still accept `PUT /drafts/:id` and move the
branch head without touching the Loro doc. So on every load, if the working
copy's `head_revision_id` is a revision with no frontiers and differs from
`synced_revision_id`, the server applies that revision's content as a legacy
write at the synced checkpoint's frontiers, then updates `synced_revision_id`.
This closes the window without coordination.

### History, restore and undo

- `GET /drafts/:id/history` returns the timeline: checkpoints (all kinds,
  including legacy revisions without frontiers) merged with the Loro change
  log (peer, counter, lamport, timestamp, commit message), newest first. Human
  changes group by author and idle gap, agent changes by turn, as in the
  `mxs author` history panel.
- **Restore a checkpoint**: `editAtVersion(doc, doc.frontiers(), …, checkpoint
  content)`, commit `restore <id>`, new checkpoint of kind `restore`. Works for
  legacy checkpoints too, because it uses content, not frontiers.
- **Undo one step**: the fork + `applyDiff` method from the prototype, commit
  `undo …`, new checkpoint of kind `undo`. Offered for timeline entries that
  come from the change log.
- `GET /drafts/compare/:leftId/:rightId` keeps working on checkpoint content.
  `relation` is now `same`, `ancestor` or `descendant` along the linear chain;
  `diverged` can only come from archived legacy branches.

### Publish

`POST /publish-jobs` keeps its shape. The write page creates a `publish`
checkpoint at the current head and passes it as `revisionId`, with
`branchId` = the working copy. Changes in `publish.service.ts`:

- Drop the `headRevisionId === revisionId` check (`:82`). Any checkpoint of the
  document may be published; edits made after it are reported through the
  existing `hasNewerBranchHead` / `newerDraftChanges` path.
- `confirmDiverged` is accepted and ignored for working copies.
- `PUBLISHED_REVISION_CHANGED` stays.

The snapshot frozen into the job is the checkpoint's materialized content, so
what is published is exactly what was checkpointed.

### Share links

No schema change. Pinned shares point at a checkpoint. Follow shares point at
the working copy row and resolve to its `head_revision_id`, the latest
checkpoint, which the idle timer keeps fresh. Yohaku and `api-client` are
untouched.

### Admin write page

For Lexical documents:

- The editor binds to the Loro doc (a `LoroSyncPlugin` like `apps/admin/src/author/`,
  using the HTTP endpoints above). The title binds to the `title` text. The
  metadata form saves changed keys through the fields endpoint.
- The save layer stops sending snapshots. The 10-second timer and ⌘S create
  checkpoints instead.
- Removed: `DRAFT_HEAD_CONFLICT` handling and `reconcileWithRemote`,
  `merge-draft-conflict.ts`, `DraftConflictDialog`, the `remoteUpdateStale`
  banner, `DraftRecoveryReview`, branch selection (`availableDraft`,
  `continueDraft` / `applyDraft`), the `?baseRevisionId` fork-on-save flow.
- `VersionTreePanel` and `version-tree/*` are replaced by a timeline panel with
  restore and undo-this-step, plus the existing share bar.
- `features/drafts/*`: the list shows one row per document; "Restore" restores
  in place instead of opening a fork.
- The dashboard desk keeps reading `relationToPublished` and `headRevision`.

The write-page AI agent's accept/reject review goes away in this phase. Its
pending `agent-diff` nodes are stripped before every save today
(`stripPendingAgentDiffs`, WRVC:5109) because they must never be persisted;
with the editor bound to Loro, every editor update is persisted and synced, so
those nodes cannot exist. Agent operations (`insert` / `replace` / `delete`)
apply straight to the editor, inside one Loro commit whose message is
`agent:<summary>` (set the next commit message before applying), so the turn
shows as one undoable step. This is the author's "AI edits land directly"
decision brought forward to phase 1 for the client-side agent. (Designer's
call.) The agent loop moving to the server (parallel Write Agent WS design)
does not change this: whoever applies the operation commits it as one
`agent:` step.

**Markdown boundary.** (Designer's call throughout; Markdown gets no new work.)

- The signal is the working copy head's `contentFormat`. Lexical → Loro path.
  Markdown → the current flow, unchanged, including several branches and
  `DRAFT_HEAD_CONFLICT`. The legacy endpoints therefore behave by format; the
  one-working-copy rule applies to Lexical documents.
- The staged conversion (published article is Markdown, draft is Lexical) is
  on the Loro path, because the working copy is Lexical. The migration commit
  currently requires the branch head and its hash to be unchanged
  (`content-migration-commit.service.ts:331`). Idle checkpoints move the head,
  so that precondition must check the checkpoint being published instead of
  the live head.
- Markdown code paths are removed when Markdown is removed, not here.

### CLI and other server consumers

- CLI: no request-shape change. Legacy writes return the write's own
  checkpoint, so CLI save-and-publish publishes only the CLI's change (above).
  `post/apply.ts`'s "more than one active branch" failure can no longer trigger
  after import.
- `ai-image` cover, aggregate desk, content migration, delete cascades
  (`deleteByRef`): unchanged, they read the working copy row and checkpoints.
- `file-reference-usage.repository.ts` keeps scanning `content_revisions`.

## Constraints

- Rolling deploy with two replicas: everything in this phase is additive. No
  drop, rename or type change. The `drafts` table and its columns stay.
- Schema migrations follow the `mx-migration-author` skill and pass
  `lint:migrations`.
- API envelope rules from `AGENTS.md`: binary endpoints use `RawResponse`; JSON
  endpoints return bare values or `withMeta`.
- `loro-crdt` must load in the core runtime (Node, wasm) and in the Docker
  image.

## Left to the builder

- Endpoint paths and the exact checkpoint skip rule.
- Compaction thresholds and whether to cache loaded docs in memory per pod
  (if cached, reload updates `id >` last seen before each read).
- Timeline panel visuals.
- How the admin decides "this document uses the Loro path" (presence of a
  `content_crdt_docs` row after import is the obvious signal).
- Tests: repository specs for the new tables; e2e for sync, legacy writes at a
  version, lazy import, the cutover reconciliation, restore, undo, publish of a
  non-head checkpoint; admin component tests replacing the conflict-merge ones.
