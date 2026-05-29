import type { Extension } from '@codemirror/state'

import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { Compartment } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

const extensionMap = {
  theme: new Compartment(),
  language: new Compartment(),
  fonts: new Compartment(),
  wysiwyg: new Compartment(),
  wysiwygMode: new Compartment(),
  slashMenu: new Compartment(),
}

// Extension to add wysiwyg class to editor
export const wysiwygModeExtension = EditorView.editorAttributes.of({
  class: 'cm-wysiwyg-mode',
})

export const codemirrorReconfigureExtension: Extension[] = [
  extensionMap.theme.of([]),
  extensionMap.language.of(
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
      addKeymap: true,
    }),
  ),
  extensionMap.fonts.of([]),
  extensionMap.wysiwyg.of([]),
  extensionMap.wysiwygMode.of([]),
  extensionMap.slashMenu.of([]),
]

export { extensionMap as codemirrorReconfigureExtensionMap }
