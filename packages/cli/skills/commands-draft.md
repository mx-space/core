---
slug: commands-draft
title: Draft commands
description: draft list/get/create/update/publish/delete syntax — standalone server-side drafts
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
| `mxs draft create`       | Create a standalone post draft.                             | same authoring flags as `post create` (`--file`, `--title`, `--content`, `--format`, `--meta`, ...); `--silent` emits `{ok, id}` |
| `mxs draft update <id>`  | Update a draft; bumps version, records history.             | same authoring flags; `--silent`                                            |
| `mxs draft publish <id>` | Publish: creates the live post/note/page (or applies to the linked one). | `--silent`, `--open`                                            |
| `mxs draft delete <id>`  | Delete a draft.                                             | `--force`; prefer `--dry-run` first                                          |

## Recommended authoring flow for a new post

```bash
mxs draft create --file article.xml --silent   # → { ok: true, id: <draftId> }
mxs draft update <draftId> --file article.xml  # iterate after review feedback
mxs draft publish <draftId>                    # go live in one step
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

Dry-run support: `create`, `update`, `publish`, `delete`.
