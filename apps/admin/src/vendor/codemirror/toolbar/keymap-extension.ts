import type { EditorView, KeyBinding } from '@codemirror/view'

import { keymap } from '@codemirror/view'

import { commands } from './markdown-commands'

export const markdownToolbarKeymap: KeyBinding[] = [
  {
    key: 'Mod-b',
    run: (view: EditorView) => commands.bold(view),
    preventDefault: true,
  },
  {
    key: 'Mod-i',
    run: (view: EditorView) => commands.italic(view),
    preventDefault: true,
  },
  {
    key: 'Mod-d',
    run: (view: EditorView) => commands.strikethrough(view),
    preventDefault: true,
  },
  {
    key: 'Mod-g',
    run: (view: EditorView) => commands.inlineCode(view),
    preventDefault: true,
  },
  {
    key: 'Mod-u',
    run: (view: EditorView) => commands.codeBlock(view),
    preventDefault: true,
  },
  {
    key: 'Mod-k',
    run: (view: EditorView) => commands.link(view),
    preventDefault: true,
  },
  {
    key: 'Mod-h',
    run: (view: EditorView) => commands.heading(view),
    preventDefault: true,
  },
  {
    key: 'Mod-l',
    run: (view: EditorView) => commands.bulletList(view),
    preventDefault: true,
  },
  {
    key: 'Mod-o',
    run: (view: EditorView) => commands.orderedList(view),
    preventDefault: true,
  },
  {
    key: 'Mod-j',
    run: (view: EditorView) => commands.taskList(view),
    preventDefault: true,
  },
  {
    key: 'Mod-;',
    run: (view: EditorView) => commands.quote(view),
    preventDefault: true,
  },
  {
    key: 'Mod-Shift-h',
    run: (view: EditorView) => commands.horizontalRule(view),
    preventDefault: true,
  },
]

export function createToolbarKeymapExtension() {
  return keymap.of(markdownToolbarKeymap)
}
