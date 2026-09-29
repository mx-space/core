---
slug: commands-author
title: Author command
description: co-edit a local LiteXML fragment or envelope with a human in the admin editor, synced through a Loro CRDT with persisted history
order: 41
---

# Author command

`mxs author` serves the same rich editor surface as the Mix Space admin write page for a local LiteXML fragment or `<mxpost>` / `<mxnote>` envelope. It does not contact `mx-core`. The process holds the document as a Loro CRDT: the browser and the file are two peers of the same document. Browser edits autosave to `<file>` about 300 ms after typing stops; an agent's overwrite of `<file>` is merged three-way and streamed into the open editor with a visible agent cursor. `<file>.diff` always holds a unified diff of the current body against the body at process start.

| Command | Behavior |
| --- | --- |
| `mxs author <file>` | Start the editor, print the URL, open a browser. |
| `mxs author --no-open <file>` | Print the URL only. |
| `mxs author --port 4173 <file>` | Listen on that port; fail if it is occupied. |
| `mxs author --variant note <file>` | Force note variant for a raw fragment. Envelopes ignore this and use the root tag. |
| `mxs author --base <orig> <file>` | Open `<file>` with every block that differs from `<orig>` rendered as an inline diff note (original above, proposed below, Accept / Reject per block). The sidecar diff is taken against `<orig>`. |

`<file>` is required. Stdin (`-`) is not accepted.

## Files

| File | Written | Purpose |
| --- | --- | --- |
| `<file>` | ~300 ms after any change, and on ⌘S | The current body spliced into the envelope. Envelope meta stays byte-stable. |
| `<file>.diff` | With every write of `<file>` | Current body vs body at process start. Do not touch. |
| `<file>.loro` | Every 5 s and on exit | Full CRDT snapshot with history. Restarting `mxs author` on the same file resumes it. |
| `<file>.selection.json` | ~200 ms after the human's selection changes | `{ updatedAt, collapsed, text, blocks: [{ id, text }] }`. `blocks[].id` matches the block's `id` attribute in `<file>`; `blocks[].text` is the selected part of that block. A collapsed caret gives `collapsed: true`, empty `text`, and the caret's block. Leaving the editor keeps the last selection. Read-only. |

## Agent edits

Edit `<file>` in place with a single read-modify-write (Claude Code `Edit`, Codex `apply_patch`). Never keep a copy and `Write` it back later: the server merges your write against the version it last wrote, and a stale copy looks like you deleted whatever the human typed since.

- Text you did not change is never reverted, even if the human changed it after you read the file.
- The editor shows your change typed in chunk by chunk with an **Agent** caret; non-text blocks (diagrams, images) appear in one step. The file is not rewritten until the stream ends. The caret stays where your last edit ended (also after a reload) until your next edit.
- Stdout prints `agent edit merged: +a ~m -d blocks` when the stream ends.
- A broken envelope or unbalanced tags (e.g. `<h2>…</h3>`, which the lenient reader would otherwise re-nest silently) print `agent edit rejected: <reason>` and pause file writes (the header shows it). Fix `<file>` in place; writes resume on the next valid version. Unknown tags are still dropped silently, so check the merged output when you use a new tag.

## History

The header's **历史** panel lists changes as human edits, agent edits, sessions and restores. Selecting one previews that version read-only; **恢复到这里** applies it as a new change, so later history stays restorable.

## Agent loop

1. Write the envelope to a file.
2. Start `mxs author <file>` (background is fine) and tell the human the URL.
   When you edited an existing article, keep the pre-edit copy (e.g. `cp <file> <file>.orig` before editing, or the `post get` output) and start `mxs author --base <file>.orig <file>` so the human sees your changes as diff notes instead of rereading the whole piece.
3. **Stop.** Do not poll, do not auto-continue.
4. On each request: re-read `<file>`, change only the blocks asked for with one in-place edit, check stdout for `agent edit merged` or `agent edit rejected`, then stop again.
   When the request points at the selection ("选中的这段", "this part", "rewrite what I selected"), read `<file>.selection.json` first and locate the blocks by `blocks[].id` (the `id` attribute in `<file>`); edit only the selected text inside them. Check `updatedAt` is recent; if the file is missing or stale, ask the human to reselect.
5. When the human says they are done, read `<file>.diff` to learn their edits. Do not rescan the full article unless the diff is missing or unreadable.
6. Continue with slop / publish using the updated file.

## Failure modes

| Symptom | Likely cause |
| --- | --- |
| `cannot resolve mxs author editor` | Source: run `pnpm -C apps/admin run build:author`. Published: reinstall `@mx-space/cli`. |
| Source checkout serves an old editor | A stale `packages/cli/dist/vendor/author` wins over `apps/admin/dist-author`; rebuild with `pnpm -C packages/cli package` or remove the vendored copy. |
| `port N is in use` | Pick another `--port` or omit it. |
| `file not found` | Pass a real path; stdin is not supported. |
| `expected root <mxpost>` | Envelope is malformed. |
| Browser tab reloads by itself | The server restarted with a different document (e.g. `<file>.loro` was deleted); the tab resyncs from the file. |
