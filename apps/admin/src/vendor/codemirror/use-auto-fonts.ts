import { useEffect } from 'react'
import type { EditorView } from '@codemirror/view'

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

import { codemirrorReconfigureExtensionMap } from './extension'
import { useEditorConfig } from './universal/use-editor-setting'

export const monospaceFonts = `"OperatorMonoSSmLig Nerd Font","Cascadia Code PL","FantasqueSansMono Nerd Font","operator mono","Fira code Retina","Fira code","Consolas", Monaco, "Hannotate SC", monospace, -apple-system`

const markdownTags = [
  tags.heading1,
  tags.heading2,
  tags.heading3,
  tags.heading4,
  tags.heading5,
  tags.heading6,
  tags.strong,
  tags.emphasis,
  tags.deleted,
  tags.content,
  tags.url,
  tags.link,
]

export function useCodeMirrorConfigureFonts(
  view: EditorView | undefined,
): void {
  const { general } = useEditorConfig()
  const fontFamily = general.setting.fontFamily

  useEffect(() => {
    if (!view) return
    const sansFonts = fontFamily || 'var(--sans-font)'
    const fontStyles = HighlightStyle.define([
      {
        tag: [tags.processingInstruction, tags.monospace],
        fontFamily: monospaceFonts,
      },
      { tag: markdownTags, fontFamily: sansFonts },
    ])
    view.dispatch({
      effects: [
        codemirrorReconfigureExtensionMap.fonts.reconfigure([
          syntaxHighlighting(fontStyles),
        ]),
      ],
    })
  }, [view, fontFamily])
}
