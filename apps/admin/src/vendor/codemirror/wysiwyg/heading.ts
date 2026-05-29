import type { EditorState, Range } from '@codemirror/state'
import type { DecorationSet, EditorView } from '@codemirror/view'

import { Decoration, ViewPlugin, WidgetType } from '@codemirror/view'

// Match heading lines: # to ###### followed by space and content
const headingPattern = /^(#{1,6})\s+(.+)$/

// Placeholder widget to replace the # symbols
class HeadingMarkerWidget extends WidgetType {
  constructor(readonly level: number) {
    super()
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-wysiwyg-heading-marker'
    span.textContent = `${'#'.repeat(this.level)} `
    return span
  }

  eq(other: HeadingMarkerWidget): boolean {
    return this.level === other.level
  }

  ignoreEvent(): boolean {
    return false
  }
}

// Cache widgets for each level
const headingMarkerWidgets = Array.from(
  { length: 6 },
  (_, i) => new HeadingMarkerWidget(i + 1),
)

// Line decoration for each heading level
const headingLineDecorations = Array.from({ length: 6 }, (_, i) =>
  Decoration.line({ class: `cm-wysiwyg-heading cm-wysiwyg-heading-${i + 1}` }),
)

// Check if cursor is on a specific line
const isCursorOnLine = (
  state: EditorState,
  lineFrom: number,
  lineTo: number,
): boolean => {
  const { from, to } = state.selection.main
  return from <= lineTo && to >= lineFrom
}

const buildHeadingDecorations = (state: EditorState): DecorationSet => {
  const decorations: Range<Decoration>[] = []

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber++) {
    const line = state.doc.line(lineNumber)
    const match = headingPattern.exec(line.text)

    if (match) {
      const level = match[1].length
      const markerLength = level + 1 // # symbols + space

      // Add line decoration for styling the entire line
      decorations.push(headingLineDecorations[level - 1].range(line.from))

      // Check if cursor is on this line
      const cursorOnLine = isCursorOnLine(state, line.from, line.to)

      // Only hide markers if cursor is NOT on this line
      if (!cursorOnLine) {
        decorations.push(
          Decoration.replace({ widget: headingMarkerWidgets[level - 1] }).range(
            line.from,
            line.from + markerLength,
          ),
        )
      }
    }
  }

  // Sort decorations by position
  decorations.sort((a, b) => a.from - b.from || a.to - b.to)

  return Decoration.set(decorations)
}

// Use ViewPlugin to react to selection changes
const headingWysiwygPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildHeadingDecorations(view.state)
    }

    update(update: {
      docChanged: boolean
      selectionSet: boolean
      state: EditorState
    }) {
      // Rebuild on doc change OR selection change
      if (update.docChanged || update.selectionSet) {
        this.decorations = buildHeadingDecorations(update.state)
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
)

export const headingWysiwygExtension = [headingWysiwygPlugin]
