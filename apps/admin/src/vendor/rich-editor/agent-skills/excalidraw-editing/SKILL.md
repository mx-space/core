---
name: excalidraw-editing
description: How to read and change a whiteboard drawing stored at /embeds/<id>.excalidraw — translating labels, fixing text, recoloring, adding shapes, rich text cards, svg illustrations and shadows, or starting a new drawing. Load before editing any .excalidraw file.
---

# Editing Excalidraw drawings

Each `<excalidraw>` block in `/doc.xml` names its file, for example `<excalidraw id="xc28xMrt">/embeds/xc28xMrt.excalidraw</excalidraw>`. The file is the scene as formatted JSON: `{ "type", "version", "elements": [...], "appState": {...}, "files": {...} }`. Saving the file uploads a new version and proposes it like any other edit; the published article keeps the old drawing until it is republished.

## Find what to change

- `grep -n '"text"' /embeds/<id>.excalidraw` lists every label with its line.
- A label inside a shape is a `text` element whose `containerId` names the shape. Change the text element, not the shape.
- `files` holds embedded bitmaps as base64. Never edit it.

## Change text

- Change both `"text"` and `"originalText"` of the element, to the same string. Use `\n` inside the JSON string for a line break.
- Keep every `id`, `containerId`, `groupIds` and binding as it is.
- Do not compute `width`, `height`, `x` or `y` for the new text: the workspace re-measures changed text when it saves.
- Translating a whole drawing: one `sed -i` per label, with the exact old string, then `grep -n '"text"'` again to confirm none was missed.

## Change style or add shapes

- Colors are `strokeColor` and `backgroundColor` as hex strings; keep the palette the drawing already uses.
- To add a shape, copy an existing element of the same type, give it a new unique `id`, and move it with `x` and `y`. Put it before the closing `]` of `elements`.
- Remove an element by deleting its object; also delete text elements whose `containerId` pointed to it.

## Clean boards, cards and illustrations

The whiteboard draws three things excalidraw.com does not. Use them for boards that should look designed rather than sketched: sticky notes, labelled timelines, a title with a small illustration.

- Clean style: write `"roughness": 0` and `"fillStyle": "solid"` on each element, and `"fontFamily": 2` on `text` for a sans-serif font (`5` is handwritten, `3` monospace).
- Shadow: `"shadow": true` on a `rectangle`, `ellipse`, `diamond`, `image`, `svg` or `richtext` adds one soft drop shadow. Other types ignore it.
- `svg`: `{"type":"svg","id":"…","x":…,"y":…,"width":48,"height":100,"svg":"<svg viewBox=\"0 0 48 100\">…</svg>"}`. The source is fitted into `width` × `height` keeping its aspect ratio, so give the root a `viewBox`. Inline every shape and colour; scripts and external files do not load. Dark mode leaves it uninverted. To change the drawing, rewrite `svg`.
- `richtext`: a card holding a small Lexical document in `content`:

  ```json
  {
    "type": "richtext",
    "id": "card-brew",
    "x": 60,
    "y": 280,
    "width": 150,
    "height": 96,
    "backgroundColor": "#f3c4d8",
    "shadow": true,
    "content": {
      "root": {
        "type": "root",
        "children": [
          {
            "type": "heading",
            "tag": "h3",
            "children": [{ "type": "text", "text": "Brew" }]
          },
          {
            "type": "paragraph",
            "children": [
              { "type": "text", "text": "Mila", "style": "color: #6b6b6b" }
            ]
          }
        ]
      }
    }
  }
  ```

  - Blocks: `paragraph`, `heading` (`tag` `h1`–`h6`), `quote`, `list` (`listType` `"bullet"` or `"number"`) of `listitem`s. Inline: `text`, `linebreak`, `link` (`url`, http/https/mailto).
  - `text.format` is a bit mask: `1` bold, `2` italic, `4` strikethrough, `8` underline, `16` code, `128` highlight. `text.style` takes `color` and `background-color`.
  - `width` is fixed and the text wraps inside it. `height` is a minimum: a card whose content needs more room grows when the board is shown, so give cards in one row the same `height` and do not compute it from the text.
  - Defaults when left out: yellow `#ffec99`, no border, clean, rounded corners.
  - To change a card's text, change the `text` nodes inside `content`; `grep -n '"text"'` finds them too.

## New or copied drawings

- Copy: `cp /embeds/<id>.excalidraw /embeds/<new-name>.excalidraw`, edit the copy, then reference it from a new block without an id: `<excalidraw>/embeds/<new-name>.excalidraw</excalidraw>`.
- From scratch: write `{"type":"excalidraw","version":2,"elements":[],"appState":{"viewBackgroundColor":"#ffffff"},"files":{}}` with a heredoc, add elements, then reference it the same way.

## Check before you finish

- `cat` the file once more: it must be valid JSON (no trailing commas, quotes escaped).
- If a save fails, the error names the file; fix the file and save again. The workspace retries the upload.
