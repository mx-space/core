---
slug: commands-file
title: File commands
description: file upload/list/delete/rename — static assets and the public URLs that reference them
order: 44
---

# File commands

`mxs file` manages the deployment's static-asset buckets. Its main job is
turning a local path into a **public URL** you can reference from content: the
CLI uploads the bytes, the server stores them, and the response carries the URL
to paste into an `<img>`, `<video>`, `<attachment>`, or `avatar` field.

| Command                            | Purpose                                         | Principal flags                |
| ---------------------------------- | ----------------------------------------------- | ------------------------------ |
| `mxs file upload <path>`           | Upload one local file; returns `{ url, name }`. | `--type`, `--name`, `--silent` |
| `mxs file list`                    | List stored objects of one type.                | `--type`                       |
| `mxs file delete <name>`           | Delete one stored object.                       | `--type`, `--force`            |
| `mxs file rename <name> <newName>` | Rename one stored object.                       | `--type`                       |

## Buckets

`--type` selects the server-side bucket and defaults to `file`:

| `--type` | Used for                                         |
| -------- | ------------------------------------------------ |
| `file`   | Generic attachments (PDFs, archives, documents). |
| `image`  | Content images referenced by `src`.              |
| `icon`   | Site and app icons.                              |
| `avatar` | Profile avatars.                                 |

The value mirrors the server's `FileTypeEnum`, so an unknown bucket fails
server-side rather than client-side.

## Upload mechanics

- The server derives the MIME type from the **filename extension**. There is no
  `--content-type` flag; name the file correctly before uploading.
- `--name` overrides the stored filename; the default is the local basename.
- `--silent` emits `{ ok: true }` instead of the full response (useful inside
  scripts that discard the body).
- The response is the source of truth for the URL:

```bash
mxs file upload ./cover.png --type image --json
# { "url": "https://…/mx-space/2026/0420/abc123.png", "name": "abc123.png" }
```

## Pitfalls

- **`<path>` resolves from the process working directory**, not from your repo
  root. In an agent workflow pass an absolute path; a bare relative name fails
  with `cannot read file: <path>`.
- **The default bucket is `file`.** An image uploaded without `--type image`
  lands in the generic bucket and may not be served where an image is expected.
- **Uploading does not rewrite your content.** Take the returned `url` and put
  it in the envelope yourself; nothing patches `<img src>` for you.
- **A local path is not a URL.** `src="file:///…"` or a relative path will not
  render for a reader. Upload first, then reference the returned URL.
- **`delete` refuses to run without `--force` in a non-TTY context**, so
  scripted deletion always needs the flag.

## Dry-run support

`--dry-run` short-circuits the request for `upload`, `delete`, and `rename`, and
prints the method and path it would have used instead of contacting the server.
