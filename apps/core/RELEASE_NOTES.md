## TL;DR

Typing in the admin snippet editor now keeps focus in the editor, including when a letter also serves as a navigation shortcut.

## Changes

- Page shortcuts now respect Monaco, CodeMirror, and rich-text editing. Typing `h` in a snippet keeps the caret in place, and keyboard navigation still works outside the editor. ([561a9c7](https://github.com/mx-space/core/commit/561a9c71b067ce9502fb7616ec98006b5549aa83))
- The bundled editor uses haklex 0.67.1, which rounds the checkbox corners in Ink checklists. ([0b1c5e1](https://github.com/mx-space/core/commit/0b1c5e1bd))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v18.2.3...v18.2.4
