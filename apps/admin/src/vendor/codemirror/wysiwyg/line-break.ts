import type { EditorState, Range } from '@codemirror/state'
import type { DecorationSet, EditorView } from '@codemirror/view'

import { Decoration, ViewPlugin, WidgetType } from '@codemirror/view'

import { isLineBreakTagLine, isLineInBlock } from './block-registry'

class LineBreakWidget extends WidgetType {
  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-wysiwyg-line-break-icon'
    span.textContent = '↵'
    return span
  }

  ignoreEvent(): boolean {
    return false
  }
}

const lineBreakWidget = new LineBreakWidget()

const buildLineBreakDecorations = (state: EditorState): DecorationSet => {
  const decorations: Range<Decoration>[] = []
  const { from, to } = state.selection.main

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber++) {
    const line = state.doc.line(lineNumber)
    if (!isLineBreakTagLine(line.text)) continue
    if (isLineInBlock(state, lineNumber)) continue

    const cursorOnLine = from <= line.to && to >= line.from
    if (cursorOnLine) continue

    decorations.push(
      Decoration.replace({
        widget: lineBreakWidget,
      }).range(line.from, line.to),
    )
  }

  return Decoration.set(decorations)
}

const lineBreakWysiwygPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildLineBreakDecorations(view.state)
    }

    update(update: {
      docChanged: boolean
      selectionSet: boolean
      state: EditorState
    }) {
      if (update.docChanged || update.selectionSet) {
        this.decorations = buildLineBreakDecorations(update.state)
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
)

export const lineBreakWysiwygExtension = [lineBreakWysiwygPlugin]
