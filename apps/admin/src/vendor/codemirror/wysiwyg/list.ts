import type { EditorState, Range } from '@codemirror/state'
import type { DecorationSet, EditorView } from '@codemirror/view'

import { Decoration, ViewPlugin, WidgetType } from '@codemirror/view'

// Unordered list marker widget
class UnorderedListMarkerWidget extends WidgetType {
  constructor(
    readonly indent: number,
    readonly marker: string,
  ) {
    super()
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-wysiwyg-list-marker cm-wysiwyg-ul-marker'
    span.style.paddingLeft = `${this.indent}ch`
    span.innerHTML = '•&nbsp;'
    return span
  }

  eq(other: UnorderedListMarkerWidget): boolean {
    return this.indent === other.indent && this.marker === other.marker
  }

  ignoreEvent(): boolean {
    return false
  }
}

// Ordered list marker widget
class OrderedListMarkerWidget extends WidgetType {
  constructor(
    readonly indent: number,
    readonly number: number,
  ) {
    super()
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-wysiwyg-list-marker cm-wysiwyg-ol-marker'
    span.style.paddingLeft = `${this.indent}ch`
    span.textContent = `${this.number}. `
    return span
  }

  eq(other: OrderedListMarkerWidget): boolean {
    return this.indent === other.indent && this.number === other.number
  }

  ignoreEvent(): boolean {
    return false
  }
}

// Task list marker widget with click support
class TaskListMarkerWidget extends WidgetType {
  constructor(
    readonly indent: number,
    readonly checked: boolean,
    readonly checkboxPos: number, // Position of '[' in the document
  ) {
    super()
  }

  toDOM(view: EditorView): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-wysiwyg-list-marker cm-wysiwyg-task-marker'
    span.style.paddingLeft = `${this.indent}ch`

    const checkbox = document.createElement('span')
    checkbox.className = this.checked
      ? 'cm-wysiwyg-checkbox cm-wysiwyg-checkbox-checked'
      : 'cm-wysiwyg-checkbox'
    checkbox.innerHTML = this.checked ? '☑' : '☐'

    // Handle click to toggle checkbox
    checkbox.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()

      // Toggle the checkbox: replace [ ] with [x] or [x] with [ ]
      const newChar = this.checked ? ' ' : 'x'
      view.dispatch({
        changes: {
          from: this.checkboxPos + 1, // Position after '['
          to: this.checkboxPos + 2, // Position before ']'
          insert: newChar,
        },
      })
    })

    span.appendChild(checkbox)
    span.appendChild(document.createTextNode(' '))

    return span
  }

  eq(other: TaskListMarkerWidget): boolean {
    return (
      this.indent === other.indent &&
      this.checked === other.checked &&
      this.checkboxPos === other.checkboxPos
    )
  }

  ignoreEvent(event: Event): boolean {
    // Allow mousedown events to pass through for checkbox clicking
    return event.type !== 'mousedown'
  }
}

interface ListMatch {
  lineFrom: number
  lineTo: number
  markerStart: number
  markerEnd: number
  type: 'ul' | 'ol' | 'task'
  indent: number
  number?: number
  checked?: boolean
  checkboxPos?: number // Position of '[' for task lists
  marker: string
}

// Patterns for list detection
const unorderedListPattern = /^(\s*)([-*+])\s+/
const orderedListPattern = /^(\s*)(\d+)\.\s+/
const taskListPattern = /^(\s*)([-*+])\s+\[([ xX])\]\s+/

// Find list items in a line
const findListItem = (
  lineText: string,
  lineFrom: number,
  lineTo: number,
): ListMatch | null => {
  // Check for task list first (more specific)
  let match = taskListPattern.exec(lineText)
  if (match) {
    const indent = match[1].length
    const checked = match[3].toLowerCase() === 'x'
    // Calculate the position of '[' in the document
    // Format: <indent><marker> [x] ...
    // Position: indent + marker(1) + space(1) = indent + 2
    const checkboxPos = lineFrom + indent + 2

    return {
      lineFrom,
      lineTo,
      markerStart: lineFrom,
      markerEnd: lineFrom + match[0].length,
      type: 'task',
      indent,
      checked,
      checkboxPos,
      marker: match[0],
    }
  }

  // Check for unordered list
  match = unorderedListPattern.exec(lineText)
  if (match) {
    const indent = match[1].length
    return {
      lineFrom,
      lineTo,
      markerStart: lineFrom,
      markerEnd: lineFrom + match[0].length,
      type: 'ul',
      indent,
      marker: match[2],
    }
  }

  // Check for ordered list
  match = orderedListPattern.exec(lineText)
  if (match) {
    const indent = match[1].length
    const number = parseInt(match[2], 10)
    return {
      lineFrom,
      lineTo,
      markerStart: lineFrom,
      markerEnd: lineFrom + match[0].length,
      type: 'ol',
      indent,
      number,
      marker: match[0],
    }
  }

  return null
}

// Check if cursor is on a line
const isCursorOnLine = (
  state: EditorState,
  lineFrom: number,
  lineTo: number,
): boolean => {
  const { from, to } = state.selection.main
  return from <= lineTo && to >= lineFrom
}

const buildListDecorations = (state: EditorState): DecorationSet => {
  const decorations: Range<Decoration>[] = []

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber++) {
    const line = state.doc.line(lineNumber)
    const listItem = findListItem(line.text, line.from, line.to)

    if (listItem) {
      // Add line decoration
      decorations.push(
        Decoration.line({
          class: `cm-wysiwyg-list-line cm-wysiwyg-${listItem.type}-line`,
        }).range(line.from),
      )

      let widget: WidgetType

      if (listItem.type === 'task') {
        widget = new TaskListMarkerWidget(
          listItem.indent,
          listItem.checked!,
          listItem.checkboxPos!,
        )
      } else if (listItem.type === 'ol') {
        widget = new OrderedListMarkerWidget(listItem.indent, listItem.number!)
      } else {
        widget = new UnorderedListMarkerWidget(listItem.indent, listItem.marker)
      }

      decorations.push(
        Decoration.replace({ widget }).range(
          listItem.markerStart,
          listItem.markerEnd,
        ),
      )
    }
  }

  decorations.sort((a, b) => a.from - b.from || a.to - b.to)
  return Decoration.set(decorations)
}

// Use ViewPlugin to react to selection changes
const listWysiwygPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildListDecorations(view.state)
    }

    update(update: {
      docChanged: boolean
      selectionSet: boolean
      state: EditorState
    }) {
      if (update.docChanged || update.selectionSet) {
        this.decorations = buildListDecorations(update.state)
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
)

export const listWysiwygExtension = [listWysiwygPlugin]
