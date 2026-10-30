---
slug: commands-draft
title: Draft commands
description: draft list/get/cat/patch/create/update/publish/delete syntax — standalone server-side drafts and live collaborative editing
order: 43
---

# Draft commands

Drafts are standalone server-side entities, separate from a post's publish
state. A new draft is not visible anywhere on the site until `draft publish`
turns it into a real post/note/page. Drafts keep version history on every
content change.

| Command                  | Purpose                                                     | Flags                                                                      |
| ------------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| `mxs draft list`         | List drafts.                                                | `--type post\|note\|page`, `--new` (unlinked only), `--linked`, `--page`, `--size` |
| `mxs draft get <id>`     | Read a draft by Snowflake id.                               | global flags                                                                |
| `mxs draft cat <id>`     | Print the live draft as a LiteXML envelope with block ids.  | `--outline`, `--selection`                                                   |
| `mxs draft patch <id>`   | Apply SEARCH/REPLACE blocks from stdin to the live draft.   | `--message <summary>`                                                        |
| `mxs draft create`       | Create a standalone post draft.                             | same authoring flags as `post create` (`--file`, `--title`, `--content`, `--format`, `--meta`, ...); `--silent` emits `{ok, id}` |
| `mxs draft update <id>`  | Update a draft; bumps version, records history.             | same authoring flags; `--silent`                                            |
| `mxs draft publish <id>` | Publish: creates the live post/note/page (or applies to the linked one). | `--ai`, `--silent`, `--open`                                    |
| `mxs draft delete <id>`  | Delete a draft.                                             | `--force`; prefer `--dry-run` first                                          |

## Editing a draft someone has open

`cat` and `patch` join the draft's collaboration room, the same one the admin
write page uses. A `patch` lands in every open editor at once, under a cursor
named after the agent running it (Claude Code, Codex, …), and becomes one
undoable row in the draft's history. Nothing is written to disk.

```bash
mxs draft cat <id>                 # <mxpost><meta>…</meta><content>…</content></mxpost>
mxs draft cat <id> | grep -n 缓存  # pipe it anywhere
mxs draft cat <id> --outline       # headings with block ids, for long drafts
mxs draft cat <id> --selection     # the blocks a person last selected in the editor
mxs draft patch <id> <<'EOF'
<<<<<<< SEARCH
<p id="hPzZ7MhV">exact text copied from cat</p>
=======
<p id="hPzZ7MhV">replacement</p>
>>>>>>> REPLACE
EOF
```

Rules for `patch`:

- Copy SEARCH from `cat` output, tags and `id` attributes included. Matching
  is literal (no regex, nothing to escape); leading indentation may differ.
- Each SEARCH must match the **current** draft exactly once. Several blocks may
  go in one call; they apply in order, and if any block fails nothing changes.
- A SEARCH that no longer matches means someone edited that text. The error
  shows the block's current content: run `cat` again and redo the edit on top
  of it. Never retry the same SEARCH.
- Only what SEARCH covers changes, so edits the person makes elsewhere at the
  same time are kept. There is no whole-file overwrite; to insert a block, use
  its neighbour as SEARCH and repeat it in REPLACE.
- `<meta>` (title, slug, category by slug, tags, summary, `ai-gen`, …) is
  edited the same way and travels in the same update.
- A replacement the editor cannot represent (unknown tag) is refused instead of
  silently dropped.
- Exit codes: `0` applied (or no-op), `1` SEARCH did not match, `5` malformed
  input, `3` not signed in, `4` network or production write gate, `6` server
  rejected the edit.

To edit a published post this way, stage it first so it has a working copy:
`mxs post stage <slugOrId> --title "<current title>"` prints the draft; use its
`id` with `cat` / `patch`, then `mxs post apply <slugOrId>` when the person
approves.

## Recommended authoring flow for a new post

```bash
mxs draft create --file article.xml --silent   # → { ok: true, id: <draftId> }
mxs draft update <draftId> --file article.xml  # iterate after review feedback
mxs draft publish <draftId>                    # go live in one step
mxs draft publish <draftId> --ai summary:sync,insights,translation
```

Notes:

- `draft create` always targets `refType: post`. Note/page drafts are
  authored in the admin dashboard; `draft publish` handles all three types.
- `--state` is ignored for drafts: a draft has no publish state.
  `draft publish` always makes the result live.
- For staging changes to an **already published** post, prefer
  `mxs post stage <slugOrId>` + `mxs post apply <slugOrId>` — same server
  entity, resolved by post slug instead of draft id.
- `publish` sends `draftId` to the server, which links the draft to the
  created resource and marks the draft version as published; the draft and
  its history are retained.

- `--ai` picks the AI resources generated for this publish, each `sync` or
  `async`: `summary:sync` waits for the summary before the article goes live;
  `insights` / `insights:async` goes live first and generates it in the
  background. Resources: `summary`, `insights`, `translation`, `tts`. Without
  `--ai` nothing is generated. Nothing is generated automatically on content
  changes; regenerate later with `mxs ai`.

Dry-run support: `create`, `update`, `publish`, `delete`. `patch` has no dry run; `cat` shows the state it would apply to.
