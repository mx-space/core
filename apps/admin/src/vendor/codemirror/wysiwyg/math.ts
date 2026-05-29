import katex from 'katex'
import type { EditorState, Range } from '@codemirror/state'
import type { DecorationSet } from '@codemirror/view'

import { StateField } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'

// Inline math widget
class InlineMathWidget extends WidgetType {
  private static renderCache = new Map<string, string>()

  constructor(readonly formula: string) {
    super()
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-wysiwyg-math-inline'

    // Try cache first
    const cached = InlineMathWidget.renderCache.get(this.formula)
    if (cached) {
      span.innerHTML = cached
      return span
    }

    try {
      const html = katex.renderToString(this.formula, {
        throwOnError: false,
        displayMode: false,
      })
      InlineMathWidget.renderCache.set(this.formula, html)
      span.innerHTML = html
    } catch {
      span.textContent = this.formula
      span.classList.add('cm-wysiwyg-math-error')
    }

    return span
  }

  eq(other: InlineMathWidget): boolean {
    return this.formula === other.formula
  }

  ignoreEvent(): boolean {
    return false
  }
}

// Block math widget
class BlockMathWidget extends WidgetType {
  private static renderCache = new Map<string, string>()
  private resizeObserver?: ResizeObserver

  constructor(
    readonly formula: string,
    readonly enterPos: number,
  ) {
    super()
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-wysiwyg-math-block'

    // Click to enter edit mode
    wrapper.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return
      event.preventDefault()
      view.dispatch({
        selection: { anchor: this.enterPos },
        scrollIntoView: true,
      })
      view.focus()
    })

    // Try cache first
    const cached = BlockMathWidget.renderCache.get(this.formula)
    if (cached) {
      wrapper.innerHTML = cached
      return wrapper
    }

    try {
      const html = katex.renderToString(this.formula, {
        throwOnError: false,
        displayMode: true,
      })
      BlockMathWidget.renderCache.set(this.formula, html)
      wrapper.innerHTML = html
    } catch {
      wrapper.textContent = this.formula
      wrapper.classList.add('cm-wysiwyg-math-error')
    }

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        view.requestMeasure()
      })
      this.resizeObserver.observe(wrapper)
    }

    return wrapper
  }

  eq(other: BlockMathWidget): boolean {
    return this.formula === other.formula && this.enterPos === other.enterPos
  }

  ignoreEvent(): boolean {
    return false
  }

  destroy(_dom: HTMLElement): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = undefined
    }
  }
}

interface InlineMathMatch {
  start: number
  end: number
  formula: string
}

interface BlockMath {
  startLine: number
  endLine: number
  formula: string
  startFrom: number
  endTo: number
}

// Find inline math: $...$  (not $$)
const findInlineMath = (
  lineText: string,
  lineFrom: number,
): InlineMathMatch[] => {
  const matches: InlineMathMatch[] = []
  // Match $...$ but not $$...$$
  const inlineMathRegex = /(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g
  let match: RegExpExecArray | null

  while ((match = inlineMathRegex.exec(lineText)) !== null) {
    matches.push({
      start: lineFrom + match.index,
      end: lineFrom + match.index + match[0].length,
      formula: match[1],
    })
  }

  return matches
}

// Find block math: $$...$$ (can span multiple lines)
const findBlockMath = (state: EditorState): BlockMath[] => {
  const blocks: BlockMath[] = []
  const blockMathStartRegex = /^\$\$\s*$/
  const blockMathEndRegex = /^\$\$\s*$/

  let inMathBlock = false
  let currentBlock: Partial<BlockMath> & { formulaLines?: string[] } = {}

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber++) {
    const line = state.doc.line(lineNumber)

    if (!inMathBlock) {
      if (blockMathStartRegex.test(line.text)) {
        inMathBlock = true
        currentBlock = {
          startLine: lineNumber,
          startFrom: line.from,
          formulaLines: [],
        }
      }
    } else {
      if (blockMathEndRegex.test(line.text)) {
        blocks.push({
          startLine: currentBlock.startLine!,
          endLine: lineNumber,
          formula: currentBlock.formulaLines!.join('\n'),
          startFrom: currentBlock.startFrom!,
          endTo: line.to,
        })
        inMathBlock = false
        currentBlock = {}
      } else {
        currentBlock.formulaLines!.push(line.text)
      }
    }
  }

  return blocks
}

// Check if cursor is within a range
const isCursorInRange = (
  state: EditorState,
  start: number,
  end: number,
): boolean => {
  const { from, to } = state.selection.main
  return from < end && to > start
}

// Get entry position for block math
const getBlockMathEntryPos = (state: EditorState, block: BlockMath): number => {
  const lineNumber = Math.min(block.startLine + 1, block.endLine)
  return state.doc.line(lineNumber).from
}

const buildMathDecorations = (state: EditorState): DecorationSet => {
  const decorations: Range<Decoration>[] = []

  // Handle block math first
  const blockMaths = findBlockMath(state)
  const blockMathRanges = new Set<number>()

  for (const block of blockMaths) {
    // Mark all positions in this block
    for (let pos = block.startFrom; pos <= block.endTo; pos++) {
      blockMathRanges.add(pos)
    }

    const cursorInBlock = isCursorInRange(state, block.startFrom, block.endTo)

    if (cursorInBlock) {
      // Show raw markdown with line decorations
      for (let lineNum = block.startLine; lineNum <= block.endLine; lineNum++) {
        const line = state.doc.line(lineNum)
        decorations.push(
          Decoration.line({
            class: 'cm-wysiwyg-math-block-line cm-wysiwyg-math-block-editing',
          }).range(line.from),
        )
      }
    } else {
      // Replace with rendered widget
      decorations.push(
        Decoration.replace({
          widget: new BlockMathWidget(
            block.formula,
            getBlockMathEntryPos(state, block),
          ),
          block: true,
        }).range(block.startFrom, block.endTo),
      )
    }
  }

  // Handle inline math (skip lines that are part of block math)
  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber++) {
    const line = state.doc.line(lineNumber)

    // Skip if this line is part of a block math
    if (blockMathRanges.has(line.from)) continue

    const inlineMaths = findInlineMath(line.text, line.from)

    for (const math of inlineMaths) {
      const cursorInMath = isCursorInRange(state, math.start, math.end)

      if (cursorInMath) {
        // Show raw markdown with styling
        decorations.push(
          Decoration.mark({ class: 'cm-wysiwyg-math-inline-editing' }).range(
            math.start,
            math.end,
          ),
        )
      } else {
        // Replace with rendered widget
        decorations.push(
          Decoration.replace({
            widget: new InlineMathWidget(math.formula),
          }).range(math.start, math.end),
        )
      }
    }
  }

  decorations.sort((a, b) => a.from - b.from || a.to - b.to)
  return Decoration.set(decorations)
}

// Use StateField to support block decorations
const mathWysiwygField = StateField.define<DecorationSet>({
  create(state) {
    return buildMathDecorations(state)
  },
  update(value, tr) {
    if (!tr.docChanged && tr.startState.selection.eq(tr.state.selection)) {
      return value
    }
    return buildMathDecorations(tr.state)
  },
  provide: (field) => EditorView.decorations.from(field),
})

export const mathWysiwygExtension = [mathWysiwygField]
