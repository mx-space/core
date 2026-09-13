# mxs author — live sync and block-level merge

**Date:** 2026-09-13
**Status:** Implemented
**Owner:** Innei
**Builds on:** `2026-09-13-mxs-author-design.md`, `--base` diff notes (same day)

## Goal

Let the agent and the human iterate on one article while `mxs author` keeps running. The agent rewrites `<file>` on disk; the open editor picks the revision up live, shows the changed blocks as inline diff notes, keeps the human's unsaved edits, and turns double-edited blocks into an Accept / Reject decision. The agent sees the human's decisions through the existing sidecar diff plus line events on stdout.

## Non-goals

- CRDT / Yjs / character-level concurrent editing. The agent delivers whole revisions, not keystrokes; block-level three-way merge covers it.
- Multiple browser tabs or multiple `mxs author` processes on one file.
- Text-level merge inside a single block. Both sides touching the same block is a conflict for the whole block.
- Envelope meta sync. Only the `<content>` body is merged; meta comes from whichever file text was written last, same as today.
- A new command. The agent's trigger is overwriting `<file>`; that is decision (a) from the chat.

## Terms

| Term | Meaning |
| --- | --- |
| base | Body the editor was last synced to: hydrated document at start, then the saved body after each save, then the merged body after each applied revision. |
| local | Editor's current serialized state (may be dirty). |
| remote | Body read from `<file>` after an external write. |
| block | Top-level child of the Lexical root. Identity is the block id (`$state` block id / LiteXML `id`), falling back to JSON equality when a block has no id. |

## Flow

```text
agent: overwrite article.xml
        │ fs.watch
        ▼
server: read file → ignore if text == lastFileText (own save)
        │ parse body → remote Lexical
        │ SSE /api/events  { type:'revision', lexical: remote, revision: n }
        ▼
SPA:    three-way merge(base, local, remote) → editor state with diff notes
        │ base := merge result projected to proposed side
        │ POST /api/ack { revision: n, conflicts: k }
        ▼
server: stdout  "revision n applied, k conflicts"
        …
human:  Accept / Reject / edit → ⌘S
        ▼
server: write file + .diff  → stdout "saved article.xml (+a -b)"
        base := saved body
```

## Merge rules (SPA)

Diff `base → remote` block-wise (LCS on block JSON, the same alignment as `annotateDiffNotes`). Then, per remote op, look at local:

| remote op | local state of that block | result |
| --- | --- | --- |
| equal | any | keep local |
| replace | unchanged since base | diff note: original = base block, proposed = remote block |
| replace | edited by human | diff note: original = **local** block, proposed = remote block (conflict) |
| replace | deleted by human | diff note: original = null, proposed = remote block (conflict, reads as insert) |
| delete | unchanged | diff note delete: original = base block |
| delete | edited by human | diff note: original = local block, proposed = null (conflict) |
| delete | already deleted locally | nothing |
| insert | — | diff note insert placed after the local position of the preceding remote block; if that block is gone locally, walk backwards to the nearest surviving one, else prepend |

A diff note already present in the editor (from `--base` or an earlier revision) is resolved to its proposed side before the merge, so the agent's new revision is compared against what the human currently sees.

"Edited by human" = local block JSON ≠ base block JSON for the same id. Blocks without ids are matched positionally within the LCS-equal runs and otherwise treated as unchanged.

## Server

- `fs.watch(dirname(file))` filtered on the basename (atomic renames replace the inode). Debounce 100 ms. Skip when the read text equals `doc.lastFileText` (our own save) or the previous remote text.
- New endpoints: `GET /api/events` (SSE, `text/event-stream`, keeps one client), `POST /api/ack`.
- `doc.lastFileText` is updated to the remote text on revision so envelope meta written by the agent survives the next save splice.
- Baseline for the sidecar diff stays "body at process start / last save" as today. The `.diff` therefore shows the human's decisions on top of the agent's revision plus their own edits, which is what the agent needs to read.
- stdout lines (existing `renderer.emitInfo`): `revision <n> applied, <k> conflicts` and `saved <file>`. `--json` is not added; the agent reads stdout of the background process.

## SPA

- `EventSource('/api/events')`. On `revision`: run merge inside `editor.update`, replace root children, keep selection if the anchor block survived, else collapse to start.
- Header shows `revision n` and a conflict count while any diff note is present. The dirty dot still reflects local vs last save.
- Save path unchanged: diff notes resolve to proposed, PUT `/api/document`.
- The `beforeunload` guard stays.

## Files

| File | Change |
| --- | --- |
| `packages/cli/src/cli/author/watch.ts` | new: fs watcher → revision callback |
| `packages/cli/src/cli/author/server.ts` | SSE endpoint, ack endpoint, revision counter |
| `packages/cli/src/cli/author/index.ts` | wire watcher, stdout lines |
| `apps/admin/src/author/merge.ts` | new: three-way block merge (pure, tested) |
| `apps/admin/src/author/RevisionSyncPlugin.tsx` | new: EventSource + editor.update, needs the composer context |
| `apps/admin/src/author/AuthorApp.tsx` | header status, hook wiring |
| `packages/cli/skills/commands-author.md` | drop "do not rewrite `<file>` while running"; document the loop |

Merge logic lives in the SPA (not the server) because only the SPA knows `local`. The CLI-side alignment is shared by copying the ~40-line LCS into `apps/admin/src/author/merge.ts`; the two apps do not share a package today and one is not being introduced for this.

Block identity for alignment is content with `$` state stripped: the editor mints block ids on hydration and the agent's file rarely carries matching ids, so id equality alone never lines up. Ids are used only to find the human's current version of a base block when its content changed. The remote state is normalized through `editor.parseEditorState(...).toJSON()` before diffing so serialization defaults match the hydrated side.

## Testing

- `merge.test.ts`: one case per row of the merge table, plus "insert after a block the human deleted".
- `watch.test.ts`: own save is ignored; external write emits once after debounce.
- `server.test.ts`: SSE delivers a revision; ack prints the stdout line.
- Manual: agent overwrites the file while the human has a dirty block; verify conflict note and that ⌘S produces the expected `.diff`.

## Agent loop (doc update)

1. Write the envelope, `cp` it as `.orig`, start `mxs author --base <file>.orig <file>` in the background.
2. Stop and wait for the human.
3. When the human asks for changes, edit `<file>` in place and overwrite it. Watch stdout for `revision n applied`.
4. Keep waiting. When stdout prints `saved <file>`, read `<file>.diff`.

## Open ceilings

- Blocks without ids merge positionally; a human inserting an id-less block right where the agent replaced one may see a spurious conflict. Acceptable; the editor mints ids on hydration so this only affects blocks created after hydration and before the first save.
- One SSE client. A second tab gets `409`.
