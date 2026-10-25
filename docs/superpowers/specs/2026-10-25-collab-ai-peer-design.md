# AI peer in the collab doc

Date: 2026-10-25
Status: approved 2026-10-25 (client-side variant, as the author asked: the
bash environment stays in the browser)
Phase 3 of 4 in the collaborative editing track
(`2026-10-25-loro-content-storage-design.md`, "Track"). Builds on phase 2
(`2026-10-25-collab-realtime-room-design.md`).

## Intent

The write agent's loop runs in core, but its document tool (`bash` over a
virtual `/doc.xml`) executes in the browser. Today the tab turns each write
into review operations; on the Loro path phase 1 auto-accepts them, so the
editor briefly holds `agent-diff` decorator nodes, then materializes them as a
normal edit by the tab's own Loro peer. The agent's edits are therefore
indistinguishable from the human's peer, they apply on top of the editor as it
is now (not as the agent saw it), and nobody else can tell the agent is
working.

This phase makes the agent a member of the document while keeping its tool in
the browser: each write becomes a Loro commit by an agent peer, merged against
the version the agent read, relayed to the room like any edit, and the agent
shows its own caret.

## Goals

- On the Loro path, an agent write never goes through review operations or
  `agent-diff` nodes. It is applied to the Loro doc directly.
- Each write is a commit `agent:<summary>` by a PeerID that belongs to the
  agent run, three-way merged against the version the agent read, so human
  typing made meanwhile survives.
- Everyone in the room sees the write as it lands (phase 2 relay) and an "AI"
  caret where the agent last wrote.
- One agent turn stays one undoable timeline row.

## Non-goals

- Moving the bash environment or any tool execution to the server.
- Agent runs that outlive the tab (unchanged: disconnect aborts the run).
- Character-by-character streaming of writes.
- Markdown documents (the agent is already disabled for them).

## Decisions

1. **Shared Loro helpers.** The headless-editor helpers in
   `apps/core/src/modules/draft/draft-crdt.doc.ts` (node set with passthrough
   decorators, `readDocContent`, `editDocAt`, `revertChange`, `vetUpdate`) move
   to a new `@mx-space/editor/loro` entry so core and admin run the same merge
   code. `loro-crdt` and `@haklex/rich-collab-loro` become peer dependencies of
   that entry only. `editDocAt` gains an optional `peer`.
2. **Workspace hook.** The browser workspace (`createDocumentBashWorkspace`)
   gains an optional `applyDocument(target)`. When set, a write that changes
   `/doc.xml` calls it with the parsed target state (ids minted as today) and
   returns no operations, so nothing enters the review store. `/review.xml` is
   always empty and the base state is the live document.
3. **Agent view and merge.** At the start of each run the CRDT session opens an
   agent turn and records the doc frontiers the workspace is seeded from. Each
   write is `editDocAt(doc, viewFrontiers, target, message, { peer })` on a
   fork; the update is imported into the doc through the binding (so the
   editor updates), then synced by the normal push. The view moves to the
   fork's frontiers after the write, so the next write diffs against the
   agent's own last write. Human edits made mid-turn are not shown to the agent
   until its next turn (unchanged rule).
4. **PeerID per run.** A random Loro peer per run, not per session: two tabs
   may continue one session in turn, and a per-session peer could reuse op
   counters a tab has not seen yet. The timeline already groups a run's writes
   by peer and message into one row; undo reverts the row (phase 1's known
   limitation for interleaved human edits applies).
5. **Commit message** `agent:<summary>`, summary = first 60 characters of the
   turn's user message (unchanged format).
6. **Agent presence.** The tab running the agent publishes a second presence
   entry keyed `agent:<runId>` with user `{ id: 'agent', name: 'AI' }`, a fixed
   violet and a caret at the end of the block the last write changed. It is
   removed when the run ends. Other members render it like any peer.
7. **Prompt.** On the Loro path the document system prompt drops the
   proposal/review wording: writes apply to the shared document immediately,
   other people may be editing, and each turn can be undone from history.
8. **Unsaved documents.** A new post with no draft has no Loro doc: the agent
   panel runs the first save, then starts the run. If the save fails, the run
   does not start and the panel shows the error.
9. **Removed:** `useCrdtAgentTurns` (auto-accept and commit relabelling) and
   routing agent operations into review batches on the Loro path.

## Testing

- `@mx-space/editor/loro`: the existing core doc specs move with the code;
  new: `editDocAt` with `peer` commits under that peer.
- Admin: workspace with `applyDocument` returns no operations and passes the
  minted target; CRDT session agent turn merges a write with a concurrent
  edit made after the view, commits under the run peer with the agent
  message, and advances the view; agent presence entry appears and is
  removed; first-save-then-run.

## Verification (end to end)

Two browsers on one document. A asks the agent to rewrite a paragraph while B
keeps typing in another paragraph. Both see the "AI" caret and the rewrite
appear; B's typing survives; the timeline shows one agent row; undoing it
restores the paragraph in both browsers.
