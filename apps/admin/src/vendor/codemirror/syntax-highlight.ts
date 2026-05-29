import type { Extension } from '@codemirror/state'

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'

import { monospaceFonts } from './use-auto-fonts'

export const syntaxHighlightingStyle = HighlightStyle.define([
  {
    tag: tags.heading1,
    fontSize: '1.4em',
    fontWeight: 'bold',
  },
  {
    tag: tags.heading2,
    fontSize: '1.3em',
    fontWeight: 'bold',
  },
  {
    tag: tags.heading3,
    fontSize: '1.2em',
    fontWeight: 'bold',
  },
  {
    tag: tags.heading4,
    fontSize: '1.1em',
    fontWeight: 'bold',
  },
  {
    tag: tags.heading5,
    fontSize: '1.1em',
    fontWeight: 'bold',
  },
  {
    tag: tags.heading6,
    fontSize: '1.1em',
    fontWeight: 'bold',
  },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.deleted, textDecoration: 'line-through' },
  {
    tag: tags.url,
    fontWeight: 'bold',
    textDecoration: 'underline',
  },
  {
    tag: tags.link,
    textDecoration: 'underline',
    fontWeight: '500',
  },
])

export const syntaxTheme: Extension = [
  EditorView.theme({
    '.cm-scroller': {
      fontFamily: monospaceFonts,
    },
  }),
  syntaxHighlighting(syntaxHighlightingStyle),
]
