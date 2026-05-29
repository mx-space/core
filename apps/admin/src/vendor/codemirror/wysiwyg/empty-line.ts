import type { Text } from '@codemirror/state'
import type { DecorationSet, EditorView, ViewUpdate } from '@codemirror/view'

import { cursorLineDown, cursorLineUp } from '@codemirror/commands'
import {
  EditorSelection,
  EditorState,
  Prec,
  RangeSetBuilder,
} from '@codemirror/state'
import { Decoration, keymap, ViewPlugin } from '@codemirror/view'

// Decoration to hide paragraph separator empty lines
const hiddenEmptyLineDecoration = Decoration.line({
  class: 'cm-wysiwyg-hidden-empty-line',
})

/**
 * This plugin hides the first empty line after a content line (paragraph separator),
 * but keeps additional consecutive empty lines visible.
 *
 * Logic:
 * - An empty line that follows a non-empty line is a "paragraph separator" -> hide it
 * - An empty line that follows another empty line is "extra spacing" -> show it
 */
function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc

  let prevLineEmpty = true // Treat "before first line" as empty to not hide first empty line

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const isCurrentEmpty = line.text.trim() === ''

    if (isCurrentEmpty && !prevLineEmpty) {
      // This empty line follows a content line -> it's a paragraph separator, hide it
      builder.add(line.from, line.from, hiddenEmptyLineDecoration)
    }

    prevLineEmpty = isCurrentEmpty
  }

  return builder.finish()
}

const emptyLinePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
)

/**
 * Check if a line is a hidden paragraph separator (empty line after content)
 */
function isHiddenSeparatorLine(doc: Text, lineNumber: number): boolean {
  if (lineNumber < 1 || lineNumber > doc.lines) return false

  const line = doc.line(lineNumber)
  const isCurrentEmpty = line.text.trim() === ''

  if (!isCurrentEmpty) return false
  if (lineNumber === 1) return false // First line can't be a separator

  const prevLine = doc.line(lineNumber - 1)
  const isPrevEmpty = prevLine.text.trim() === ''

  return !isPrevEmpty // It's a separator if previous line has content
}

const getHiddenLineAdjustedPos = (
  doc: Text,
  lineNumber: number,
  direction: 'up' | 'down',
): number | null => {
  const hasPrev = lineNumber > 1
  const hasNext = lineNumber < doc.lines

  if (direction === 'down' && hasNext) {
    return doc.line(lineNumber + 1).from
  }

  if (hasPrev) {
    return doc.line(lineNumber - 1).to
  }

  if (hasNext) {
    return doc.line(lineNumber + 1).from
  }

  return null
}

const skipHiddenLineSelectionFilter = EditorState.transactionFilter.of((tr) => {
  const selection = tr.newSelection.main
  if (!selection.empty) return tr

  const doc = tr.newDoc
  const line = doc.lineAt(selection.head)
  const isHidden = isHiddenSeparatorLine(doc, line.number)
  if (!isHidden) return tr

  const prevHead = tr.startState.selection.main.head
  const direction = selection.head >= prevHead ? 'down' : 'up'
  const adjustedPos = getHiddenLineAdjustedPos(doc, line.number, direction)
  if (adjustedPos == null || adjustedPos === selection.head) return tr

  if (
    typeof window !== 'undefined' &&
    ((window as unknown as { __CM_WYSIWYG_DEBUG__?: boolean })
      .__CM_WYSIWYG_DEBUG__ === true ||
      window.localStorage?.getItem('cm-wysiwyg-debug') === '1')
  ) {
    const prevLine = line.number > 1 ? doc.line(line.number - 1) : null
    const nextLine = line.number < doc.lines ? doc.line(line.number + 1) : null
    console.log('[CM WYSIWYG] hidden-line-adjust', {
      line: {
        number: line.number,
        from: line.from,
        to: line.to,
        text: line.text,
      },
      prevLine: prevLine
        ? { number: prevLine.number, text: prevLine.text }
        : null,
      nextLine: nextLine
        ? { number: nextLine.number, text: nextLine.text }
        : null,
      selection: {
        head: selection.head,
        anchor: selection.anchor,
      },
      direction,
      adjustedPos,
    })
  }

  return [
    tr,
    {
      selection: EditorSelection.cursor(adjustedPos),
      sequential: true,
    },
  ]
})

/**
 * Custom cursor movement that skips hidden empty lines.
 * First executes the default movement, then checks if we landed on a hidden line.
 * This preserves visual line navigation within wrapped paragraphs.
 */
function moveCursorSkippingHidden(
  view: EditorView,
  direction: 'up' | 'down',
): boolean {
  const moveCommand = direction === 'up' ? cursorLineUp : cursorLineDown

  // Execute default movement first
  const moved = moveCommand(view)
  if (!moved) return false

  // Check if we landed on a hidden separator line
  const pos = view.state.selection.main.head
  const currentLine = view.state.doc.lineAt(pos)

  if (isHiddenSeparatorLine(view.state.doc, currentLine.number)) {
    // If on a hidden line, move once more to skip it
    return moveCommand(view)
  }

  return true
}

const skipHiddenLineKeymap = Prec.highest(
  keymap.of([
    {
      key: 'ArrowUp',
      run: (view) => moveCursorSkippingHidden(view, 'up'),
    },
    {
      key: 'ArrowDown',
      run: (view) => moveCursorSkippingHidden(view, 'down'),
    },
  ]),
)

export const emptyLineWysiwygExtension = [
  emptyLinePlugin,
  skipHiddenLineSelectionFilter,
  skipHiddenLineKeymap,
]
