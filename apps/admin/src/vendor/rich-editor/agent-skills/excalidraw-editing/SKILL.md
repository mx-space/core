---
name: excalidraw-editing
description: How to read and change an Excalidraw drawing stored at /embeds/<id>.excalidraw — translating labels, fixing text, recoloring, adding shapes, or starting a new drawing. Load before editing any .excalidraw file.
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

## New or copied drawings

- Copy: `cp /embeds/<id>.excalidraw /embeds/<new-name>.excalidraw`, edit the copy, then reference it from a new block without an id: `<excalidraw>/embeds/<new-name>.excalidraw</excalidraw>`.
- From scratch: write `{"type":"excalidraw","version":2,"elements":[],"appState":{"viewBackgroundColor":"#ffffff"},"files":{}}` with a heredoc, add elements, then reference it the same way.

## Check before you finish

- `cat` the file once more: it must be valid JSON (no trailing commas, quotes escaped).
- If a save fails, the error names the file; fix the file and save again. The workspace retries the upload.
