import type { EditorState } from '@codemirror/state'
import type { DecorationSet } from '@codemirror/view'

import { RangeSetBuilder, StateField } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'

const dividerPattern = /^-{3}\s*$/

class DividerWidget extends WidgetType {
  toDOM(_view: EditorView): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-wysiwyg-divider'

    const line = document.createElement('hr')
    wrapper.appendChild(line)

    return wrapper
  }

  ignoreEvent(): boolean {
    return false
  }
}

const dividerWidget = new DividerWidget()

const buildDividerDecorations = (state: EditorState): DecorationSet => {
  const builder = new RangeSetBuilder<Decoration>()

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber++) {
    const line = state.doc.line(lineNumber)
    if (dividerPattern.test(line.text)) {
      builder.add(
        line.from,
        line.to,
        Decoration.replace({ widget: dividerWidget, block: true }),
      )
    }
  }

  return builder.finish()
}

const dividerWysiwygField = StateField.define<DecorationSet>({
  create(state) {
    return buildDividerDecorations(state)
  },
  update(value, tr) {
    if (!tr.docChanged) return value
    return buildDividerDecorations(tr.state)
  },
  provide: (field) => EditorView.decorations.from(field),
})

export const dividerWysiwygExtension = [dividerWysiwygField]
