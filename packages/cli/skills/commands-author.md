---
slug: commands-author
title: Author command
description: open a local admin editor for LiteXML / envelopes and write a sidecar diff
order: 41
---

# Author command

`mxs author` serves the same rich editor surface as the Mix Space admin write page for a local LiteXML fragment or `<mxpost>` / `<mxnote>` envelope. It does not contact `mx-core`. Saving writes the file back and overwrites `<file>.diff` with a unified diff of the current body against the body frozen when the process started. While it runs it watches `<file>`: an external overwrite is pushed to the open editor as a new revision and merged block-by-block into whatever the human has typed.

| Command | Behavior |
| --- | --- |
| `mxs author <file>` | Start the editor, print the URL, open a browser. |
| `mxs author --no-open <file>` | Print the URL only. |
| `mxs author --port 4173 <file>` | Listen on that port; fail if it is occupied. |
| `mxs author --variant note <file>` | Force note variant for a raw fragment. Envelopes ignore this and use the root tag. |
| `mxs author --base <orig> <file>` | Open `<file>` with every block that differs from `<orig>` rendered as an inline diff note (original above, proposed below, Accept / Reject per block). The sidecar diff is taken against `<orig>`. |

`<file>` is required. Stdin (`-`) is not accepted.

## Save contract

- Only the `<content>` body is edited. Envelope meta (title, slug, tags, …) is left byte-stable.
- Each save overwrites `<file>` and `<file>.diff`.
- The diff is always current body vs the body at process start, not vs the previous save.
- An unchanged save still writes a headers-only diff.
- With `--base`, unresolved diff notes save as the proposed side. Reject restores the original block.
- Overwriting `<file>` while the process runs is the agent's way to deliver a new revision (see below). Do not touch `<file>.diff`.

## Live revisions

Each external overwrite of `<file>` becomes a revision. The editor merges it three-way at block level against the last synced state and the human's current, possibly unsaved, content:

| Remote change | Human touched the same block? | Editor shows |
| --- | --- | --- |
| replaced | no | diff note: original = old, proposed = yours |
| replaced | yes | diff note: original = the human's current text, proposed = yours (conflict) |
| deleted | no | diff note delete |
| deleted | yes | diff note: original = the human's text, proposed = nothing (conflict) |
| inserted | — | diff note insert after the preceding block |

Blocks the human edited and you left alone stay as the human wrote them. The header shows `rev N` and the conflict count. Stdout prints one line per event:

```text
revision 2 applied, 1 conflicts
saved article.xml
```

`revision N pending (no editor connected)` means the browser tab is closed; the revision is served on the next page load.

## Agent loop

1. Write the envelope to a file.
2. Start `mxs author <file>` (background is fine) and tell the human the URL.
   When you edited an existing article, keep the pre-edit copy (e.g. `cp <file> <file>.orig` before editing, or the `post get` output) and start `mxs author --base <file>.orig <file>` so the human sees your changes as diff notes instead of rereading the whole piece.
3. **Stop.** Do not poll, do not auto-continue.
4. If the human asks for changes, edit `<file>` in place and overwrite it in one write. Watch the process stdout for `revision N applied`; then stop again.
5. When the human says they are done (stdout shows `saved <file>`), read `<file>.diff`. Use that to understand edits. Do not rescan the full article unless the diff is missing or unreadable.
6. Continue with slop / publish using the updated file.

## Failure modes

| Symptom | Likely cause |
| --- | --- |
| `cannot resolve mxs author editor` | Source: run `pnpm -C apps/admin run build:author`. Published: reinstall `@mx-space/cli`. |
| `port N is in use` | Pick another `--port` or omit it. |
| `file not found` | Pass a real path; stdin is not supported. |
| `expected root <mxpost>` | Envelope is malformed. |
