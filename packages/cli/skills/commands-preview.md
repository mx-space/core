---
slug: commands-preview
title: Preview command
description: render LiteXML / envelope to HTML and open it in a browser
order: 39
---

# Preview command

`mxs preview` renders a LiteXML fragment or `<mxpost>` / `<mxnote>` envelope to HTML and (by default) opens it in the system browser. It is a thin wrapper around the `@haklex/rich-litexml-cli` `litexml --format html` pipeline, so the output matches what the editor would render once published.

| Command                                  | Behavior                                                                    |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `mxs preview <file>`                     | Render the file and open the preview in a browser.                          |
| `mxs preview <file> --open`              | Same as above, but explicit. Useful in scripts.                             |
| `mxs preview -`                          | Read LiteXML or envelope from stdin and open the preview.                   |
| `mxs preview --print <file>`             | Emit HTML to stdout instead of opening a browser.                           |
| `mxs preview --save <out.html> <file>`   | Write HTML to `<out.html>` instead of opening a browser.                    |

Flags must precede the positional `<file>` argument. `mxs preview <file> --print` is rejected by `@effect/cli` ("unknown argument") — write `mxs preview --print <file>` or `cat file | mxs preview --print -`.

## Flags

| Flag                                       | Meaning                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `--theme <light\|dark>`                    | HTML theme. Default `light`.                                                                     |
| `--variant <article\|note\|comment>`       | HTML variant. Auto-detected from the envelope root (`<mxpost>` → `article`, `<mxnote>` → `note`). |
| `--save <path>`                            | Write HTML to a file instead of opening the browser. Mutually exclusive with `--print` / `--open`. |
| `--print`                                  | Emit HTML to stdout. Mutually exclusive with `--save` / `--open`.                                |
| `--open`                                   | Explicitly open the rendered HTML in a browser (default behavior; mutually exclusive with `--print` / `--save`). |

## Behavior notes

- Input format is auto-detected. If the input starts with `<mxpost>` or `<mxnote>`, the envelope is parsed and only the `<content>` body is rendered (envelope `<meta>` such as title, category, tags is **not** reflected in the HTML preview — this command is for visualising the article body, not the listing card).
- For raw LiteXML fragments (no envelope wrapper), the entire input is treated as the article body.
- Variant detection only fires when an envelope is supplied. Override with `--variant` when previewing a raw fragment that should render as a note or comment.
- The command does not contact the `mx-core` server and does not require an active profile.

## Examples

```bash
# Open envelope file in browser
mxs preview ./post.xml

# Pipe from another tool
some-generator | mxs preview -

# Dark theme, save to file
mxs preview ./note.xml --theme dark --save ./preview.html

# Emit HTML to stdout (e.g. for CI)
mxs preview ./post.xml --print > preview.html
```

## Failure modes

| Symptom                                                  | Likely cause                                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `cannot resolve @haklex/rich-litexml-cli binary`         | Installed dep is broken; reinstall `@mx-space/cli` or run `pnpm install`.                      |
| `Cannot resolve @haklex/rich-compose asset "style.css"`  | Outdated `@haklex/rich-compose` (< 0.15.2). Upgrade or reinstall.                              |
| `expected root <mxpost>` / `expected root <mxnote>`      | Input begins with the wrong envelope root, or the envelope is malformed. Check the root tag.   |
| Browser does not open                                    | `--open` shells out to the system `open`/`xdg-open`/`start`. Use `--save` or `--print` instead. |
