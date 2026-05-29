import type { EditorState, Range } from '@codemirror/state'
import type { DecorationSet } from '@codemirror/view'
import type { Root } from 'react-dom/client'

import { Prec, StateField } from '@codemirror/state'
import { Decoration, EditorView, keymap, WidgetType } from '@codemirror/view'

import { blockDetectorFacet, isHiddenSeparatorLine } from './block-registry'

const detailsOpenPattern = /^\s*<details(\s+open)?\s*>\s*$/i
const summaryOpenPattern = /^\s*<summary>\s*$/i
const summaryInlinePattern = /^\s*<summary>(.*)<\/summary>\s*$/i
const summaryClosePattern = /^\s*<\/summary>\s*$/i
const detailsClosePattern = /^\s*<\/details>\s*$/i

const DETAILS_HEADER_HEIGHT = 36
const DETAILS_BORDER_HEIGHT = 2
const DETAILS_EDITOR_LINE_HEIGHT = 28
const DETAILS_EDITOR_VERTICAL_PADDING = 16
const DETAILS_EDITOR_MIN_HEIGHT = 48
const DETAILS_ESTIMATE_CHARS_PER_LINE = 64

const enum SummaryState {
  SEARCHING,
  IN_SUMMARY,
  DONE,
}

interface DetailsBlock {
  startLine: number
  endLine: number
  startFrom: number
  endTo: number
  collapsedByDefault: boolean
  summaryText: string
  summaryLineFrom: number
  summaryLineTo: number
  contentFrom: number
  contentTo: number
  content: string
}

const detailsCollapseState = new Map<string, boolean>()

const getDetailsBlockKey = (blockStart: number, blockEnd: number): string => {
  return `${blockStart}:${blockEnd}`
}

const findDetailsBlocks = (state: EditorState): DetailsBlock[] => {
  const blocks: DetailsBlock[] = []
  let inDetails = false
  let summaryState = SummaryState.SEARCHING
  let current: Partial<DetailsBlock> & {
    summaryLines?: string[]
    hasOpen?: boolean
  } = {}

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber++) {
    const line = state.doc.line(lineNumber)

    if (!inDetails) {
      const detailsOpenMatch = detailsOpenPattern.exec(line.text)
      if (detailsOpenMatch) {
        inDetails = true
        summaryState = SummaryState.SEARCHING
        current = {
          startLine: lineNumber,
          startFrom: line.from,
          hasOpen: Boolean(detailsOpenMatch[1]),
          summaryText: '',
          summaryLineFrom: 0,
          summaryLineTo: 0,
          summaryLines: [],
        }
      }
      continue
    }

    if (detailsClosePattern.test(line.text)) {
      const summaryEndLine = current.summaryLineTo
        ? state.doc.lineAt(current.summaryLineTo).number
        : current.startLine!
      const contentStartLine = summaryEndLine + 1
      const contentEndLine = lineNumber - 1
      const hasContent = contentStartLine <= contentEndLine
      const contentFrom = hasContent
        ? state.doc.line(contentStartLine).from
        : line.from
      const contentTo = hasContent
        ? state.doc.line(contentEndLine).to
        : line.from

      blocks.push({
        startLine: current.startLine!,
        endLine: lineNumber,
        startFrom: current.startFrom!,
        endTo: line.to,
        collapsedByDefault: !current.hasOpen,
        summaryText: current.summaryText!,
        summaryLineFrom: current.summaryLineFrom || current.startFrom!,
        summaryLineTo: current.summaryLineTo || current.startFrom!,
        contentFrom,
        contentTo,
        content: hasContent
          ? state.doc.sliceString(contentFrom, contentTo)
          : '',
      })
      inDetails = false
      summaryState = SummaryState.SEARCHING
      current = {}
      continue
    }

    if (summaryState === SummaryState.SEARCHING) {
      const inlineMatch = summaryInlinePattern.exec(line.text)
      if (inlineMatch) {
        current.summaryText = inlineMatch[1].trim()
        current.summaryLineFrom = line.from
        current.summaryLineTo = line.to
        summaryState = SummaryState.DONE
        continue
      }
      if (summaryOpenPattern.test(line.text)) {
        current.summaryLineFrom = line.from
        current.summaryLines = []
        summaryState = SummaryState.IN_SUMMARY
        continue
      }
    }

    if (summaryState === SummaryState.IN_SUMMARY) {
      if (summaryClosePattern.test(line.text)) {
        current.summaryText = current.summaryLines!.join('\n').trim()
        current.summaryLineTo = line.to
        summaryState = SummaryState.DONE
        continue
      }
      current.summaryLines!.push(line.text.trim())
    }
  }

  return blocks
}

const isDarkMode = (): boolean => {
  return document.documentElement.classList.contains('dark')
}

const estimateDetailsVisualLines = (content: string): number => {
  if (!content) return 1
  let visualLines = 0
  const lines = content.split('\n')
  for (const line of lines) {
    visualLines += Math.max(
      1,
      Math.ceil(Math.max(line.length, 1) / DETAILS_ESTIMATE_CHARS_PER_LINE),
    )
  }
  return Math.max(1, visualLines)
}

const estimateDetailsEditorHeight = (content: string): number => {
  const visualLines = estimateDetailsVisualLines(content)
  const estimated = visualLines * DETAILS_EDITOR_LINE_HEIGHT
  return Math.max(
    DETAILS_EDITOR_MIN_HEIGHT,
    estimated + DETAILS_EDITOR_VERTICAL_PADDING,
  )
}

const estimateDetailsWidgetHeight = (
  content: string,
  collapsed: boolean,
): number => {
  if (collapsed) {
    return DETAILS_HEADER_HEIGHT + DETAILS_BORDER_HEIGHT
  }

  return (
    DETAILS_HEADER_HEIGHT +
    DETAILS_BORDER_HEIGHT +
    estimateDetailsEditorHeight(content)
  )
}

// SVG triangle icon
const triangleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>`

// --- DOM-based Details Element (no Shadow DOM) ---

interface DetailsElementState {
  summaryText: string
  content: string
  enterPos: number
  contentFrom: number
  contentTo: number
  summaryLineFrom: number
  summaryLineTo: number
  blockKey: string
  blockStart: number
  blockEnd: number
  outerView: EditorView | undefined
  isCollapsed: boolean
  syncingFromOuter: boolean
  reactRoot: Root | undefined
  innerEditorView: EditorView | undefined
  resizeObserver: ResizeObserver | undefined
  measureScheduled: boolean
  // DOM refs
  triangleEl: HTMLElement | undefined
  summaryInput: HTMLInputElement | undefined
  contentEl: HTMLElement | undefined
  editorMountEl: HTMLElement | undefined
}

function createDetailsElement(
  outerView: EditorView,
  summaryText: string,
  content: string,
  enterPos: number,
  contentFrom: number,
  contentTo: number,
  summaryLineFrom: number,
  summaryLineTo: number,
  collapsed: boolean,
  blockStart: number,
  blockEnd: number,
): HTMLElement {
  const el = document.createElement('div')
  el.className = 'cm-wysiwyg-details'
  el.dataset.enterPos = String(enterPos)
  const blockKey = getDetailsBlockKey(blockStart, blockEnd)
  const isCollapsed = detailsCollapseState.get(blockKey) ?? collapsed
  detailsCollapseState.set(blockKey, isCollapsed)

  const state: DetailsElementState = {
    summaryText,
    content,
    enterPos,
    contentFrom,
    contentTo,
    summaryLineFrom,
    summaryLineTo,
    blockKey,
    blockStart,
    blockEnd,
    outerView,
    isCollapsed,
    syncingFromOuter: false,
    reactRoot: undefined,
    innerEditorView: undefined,
    resizeObserver: undefined,
    measureScheduled: false,
    triangleEl: undefined,
    summaryInput: undefined,
    contentEl: undefined,
    editorMountEl: undefined,
  }

  // Store state on element for updateDOM access
  ;(el as any).__detailsState = state

  // --- Build DOM ---

  // Header
  const header = document.createElement('div')
  header.className = 'cm-wysiwyg-details-header'

  const triangle = document.createElement('span')
  triangle.className = 'cm-wysiwyg-details-triangle'
  triangle.innerHTML = triangleSvg
  state.triangleEl = triangle

  const input = document.createElement('input')
  input.className = 'cm-wysiwyg-details-summary-input'
  input.type = 'text'
  input.value = summaryText
  input.placeholder = '摘要'
  state.summaryInput = input

  header.appendChild(triangle)
  header.appendChild(input)

  // Content area
  const contentArea = document.createElement('div')
  contentArea.className = 'cm-wysiwyg-details-content'
  state.contentEl = contentArea

  const editorMount = document.createElement('div')
  editorMount.className = 'cm-wysiwyg-details-editor'
  editorMount.style.minHeight = `${estimateDetailsEditorHeight(content)}px`
  state.editorMountEl = editorMount
  contentArea.appendChild(editorMount)

  el.appendChild(header)
  el.appendChild(contentArea)

  // --- Event Handlers ---

  const compensateScrollAfterHeightChange = (beforeTop: number) => {
    const scroller = state.outerView?.scrollDOM as HTMLElement | undefined
    if (!scroller) return
    const afterTop = header.getBoundingClientRect().top
    const delta = afterTop - beforeTop
    if (Math.abs(delta) > 0.5) {
      scroller.scrollTop += delta
    }
  }

  const applyCollapseState = () => {
    el.classList.toggle('collapsed', state.isCollapsed)
    triangle.classList.toggle('collapsed', state.isCollapsed)
    contentArea.classList.toggle('collapsed', state.isCollapsed)
  }

  applyCollapseState()

  const toggleCollapse = () => {
    const beforeTop = header.getBoundingClientRect().top
    state.isCollapsed = !state.isCollapsed
    detailsCollapseState.set(state.blockKey, state.isCollapsed)
    applyCollapseState()
    requestAnimationFrame(() => {
      compensateScrollAfterHeightChange(beforeTop)
      scheduleOuterMeasure(state)
    })
  }

  header.addEventListener('click', (e) => {
    if (e.composedPath().includes(input)) return
    e.stopPropagation()
    toggleCollapse()
  })

  input.addEventListener('click', (e) => e.stopPropagation())

  input.addEventListener('input', () => {
    syncSummaryToOuter(state, input.value)
  })

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault()
      if (state.isCollapsed) toggleCollapse()
      state.innerEditorView?.focus()
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!state.outerView) return
      const target = Math.max(0, state.blockStart - 1)
      state.outerView.dispatch({ selection: { anchor: target } })
      state.outerView.focus()
    }
  })

  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return
    const path = e.composedPath()
    if (path.includes(input)) return
    if (path.includes(header)) return
    if (path.includes(contentArea)) return
    e.preventDefault()
    state.innerEditorView?.focus()
  })

  // --- Mount inner editor ---
  void mountInnerEditor(state, el, toggleCollapse)

  // --- ResizeObserver ---
  if (typeof ResizeObserver !== 'undefined') {
    state.resizeObserver = new ResizeObserver(() => {
      scheduleOuterMeasure(state)
    })
    state.resizeObserver.observe(el)
  }

  return el
}

async function mountInnerEditor(
  state: DetailsElementState,
  rootEl: HTMLElement,
  toggleCollapse: () => void,
): Promise<void> {
  if (!state.editorMountEl) return

  const [{ createRoot }, { createElement }, { CodeMirrorEditor }] =
    await Promise.all([
      import('react-dom/client'),
      import('react'),
      import('../CodeMirrorEditor'),
    ])

  let currentContent = state.content
  let syncing = false
  let rerender: () => void = () => {}

  const findEditorView = () => {
    const cmEl = state.editorMountEl?.querySelector(
      '.cm-editor',
    ) as HTMLElement | null
    if (cmEl) {
      state.innerEditorView = EditorView.findFromDOM(cmEl) ?? undefined
      if (state.innerEditorView) {
        state.editorMountEl?.style.setProperty('min-height', '')
        scheduleOuterMeasure(state)
      }
    }
  }

  const root = createRoot(state.editorMountEl)
  state.reactRoot = root

  const renderEditor = () =>
    createElement(CodeMirrorEditor, {
      text: currentContent,
      renderMode: 'wysiwyg',
      embedded: true,
      unSaveConfirm: false,
      onChange: (text: string) => {
        if (syncing) return
        syncing = true
        currentContent = text
        syncOuterDoc(state, text)
        scheduleOuterMeasure(state)
        syncing = false
      },
    })

  rerender = () => root.render(renderEditor())
  rerender()

  requestAnimationFrame(findEditorView)
  setTimeout(findEditorView, 100)

  // Watch for external content updates
  ;(rootEl as any).__updateContent = (newContent: string) => {
    if (syncing) return
    currentContent = newContent
    rerender()
  }

  // Focus the inner editor
  ;(rootEl as any).__focusEditor = (position: 'start' | 'end') => {
    if (state.isCollapsed) {
      toggleCollapse()
    }
    requestAnimationFrame(() => {
      const view = state.innerEditorView
      if (!view) return
      const anchor = position === 'end' ? view.state.doc.length : 0
      view.dispatch({ selection: { anchor } })
      view.focus()
    })
  }
}

function syncSummaryToOuter(state: DetailsElementState, text: string): void {
  if (!state.outerView) return
  const newLine = `<summary>${text}</summary>`
  if (
    state.summaryLineFrom === state.summaryLineTo &&
    state.summaryLineFrom === 0
  )
    return
  const oldLen = state.summaryLineTo - state.summaryLineFrom
  const delta = newLine.length - oldLen
  state.outerView.dispatch({
    changes: {
      from: state.summaryLineFrom,
      to: state.summaryLineTo,
      insert: newLine,
    },
    userEvent: 'input',
  })
  state.summaryLineTo = state.summaryLineFrom + newLine.length
  state.contentFrom += delta
  state.contentTo += delta
  state.blockEnd += delta
}

function syncOuterDoc(state: DetailsElementState, next: string): void {
  if (!state.outerView) return
  const current = state.outerView.state.doc.sliceString(
    state.contentFrom,
    state.contentTo,
  )
  if (current === next) return
  const delta = next.length - (state.contentTo - state.contentFrom)
  state.outerView.dispatch({
    changes: { from: state.contentFrom, to: state.contentTo, insert: next },
    userEvent: 'input',
  })
  state.contentTo = state.contentFrom + next.length
  state.blockEnd += delta
}

function scheduleOuterMeasure(state: DetailsElementState): void {
  if (!state.outerView || state.measureScheduled) return
  state.measureScheduled = true
  requestAnimationFrame(() => {
    state.measureScheduled = false
    state.outerView?.requestMeasure()
  })
}

function updateDetailsElement(
  el: HTMLElement,
  view: EditorView,
  summaryText: string,
  content: string,
  enterPos: number,
  contentFrom: number,
  contentTo: number,
  summaryLineFrom: number,
  summaryLineTo: number,
  collapsed: boolean,
  blockStart: number,
  blockEnd: number,
): void {
  const state = (el as any).__detailsState as DetailsElementState | undefined
  if (!state) return

  const nextBlockKey = getDetailsBlockKey(blockStart, blockEnd)
  if (nextBlockKey !== state.blockKey) {
    const currentCollapsed =
      detailsCollapseState.get(state.blockKey) ?? state.isCollapsed
    detailsCollapseState.delete(state.blockKey)
    state.blockKey = nextBlockKey
    if (detailsCollapseState.has(nextBlockKey)) {
      state.isCollapsed = detailsCollapseState.get(nextBlockKey)!
    } else {
      state.isCollapsed = currentCollapsed
      detailsCollapseState.set(nextBlockKey, state.isCollapsed)
    }
  } else {
    state.isCollapsed = collapsed
    detailsCollapseState.set(state.blockKey, collapsed)
  }

  el.classList.toggle('collapsed', state.isCollapsed)
  state.triangleEl?.classList.toggle('collapsed', state.isCollapsed)
  state.contentEl?.classList.toggle('collapsed', state.isCollapsed)

  state.outerView = view
  state.enterPos = enterPos
  state.contentFrom = contentFrom
  state.contentTo = contentTo
  state.summaryLineFrom = summaryLineFrom
  state.summaryLineTo = summaryLineTo
  state.blockStart = blockStart
  state.blockEnd = blockEnd
  el.dataset.enterPos = String(enterPos)

  if (state.summaryInput && state.summaryText !== summaryText) {
    state.summaryText = summaryText
    state.summaryInput.value = summaryText
  }

  if (state.content !== content) {
    state.content = content
    if (!state.innerEditorView && state.editorMountEl) {
      state.editorMountEl.style.minHeight = `${estimateDetailsEditorHeight(content)}px`
    }
    const updateFn = (el as any).__updateContent as
      | ((c: string) => void)
      | undefined
    updateFn?.(content)
  }
}

function destroyDetailsElement(el: HTMLElement): void {
  const state = (el as any).__detailsState as DetailsElementState | undefined
  if (!state) return
  const root = state.reactRoot
  if (root) {
    // Defer unmount to avoid React 19 warning about unmounting during render
    queueMicrotask(() => root.unmount())
  }
  state.reactRoot = undefined
  ;(el as any).__updateContent = undefined
  ;(el as any).__focusEditor = undefined
  state.innerEditorView = undefined
  state.resizeObserver?.disconnect()
  state.resizeObserver = undefined
}

// --- Widget ---

class DetailsBlockWidget extends WidgetType {
  private readonly estimatedHeightValue: number

  constructor(
    readonly summaryText: string,
    readonly content: string,
    readonly collapsed: boolean,
    readonly isDark: boolean,
    readonly enterPos: number,
    readonly contentFrom: number,
    readonly contentTo: number,
    readonly summaryLineFrom: number,
    readonly summaryLineTo: number,
    readonly blockStart: number,
    readonly blockEnd: number,
  ) {
    super()
    this.estimatedHeightValue = estimateDetailsWidgetHeight(content, collapsed)
  }

  get estimatedHeight(): number {
    return this.estimatedHeightValue
  }

  toDOM(view: EditorView): HTMLElement {
    return createDetailsElement(
      view,
      this.summaryText,
      this.content,
      this.enterPos,
      this.contentFrom,
      this.contentTo,
      this.summaryLineFrom,
      this.summaryLineTo,
      this.collapsed,
      this.blockStart,
      this.blockEnd,
    )
  }

  updateDOM(dom: HTMLElement, view: EditorView): boolean {
    if (!(dom as any).__detailsState) return false
    updateDetailsElement(
      dom,
      view,
      this.summaryText,
      this.content,
      this.enterPos,
      this.contentFrom,
      this.contentTo,
      this.summaryLineFrom,
      this.summaryLineTo,
      this.collapsed,
      this.blockStart,
      this.blockEnd,
    )
    return true
  }

  eq(other: DetailsBlockWidget): boolean {
    return (
      this.summaryText === other.summaryText &&
      this.content === other.content &&
      this.collapsed === other.collapsed &&
      this.isDark === other.isDark &&
      this.enterPos === other.enterPos &&
      this.contentFrom === other.contentFrom &&
      this.contentTo === other.contentTo &&
      this.blockStart === other.blockStart &&
      this.blockEnd === other.blockEnd &&
      this.estimatedHeightValue === other.estimatedHeightValue
    )
  }

  ignoreEvent(_event: Event): boolean {
    return true
  }

  destroy(dom: HTMLElement): void {
    destroyDetailsElement(dom)
  }
}

// --- Decorations ---

const getDetailsEntryPos = (
  state: EditorState,
  block: DetailsBlock,
): number => {
  const lineNumber = Math.min(block.startLine + 1, block.endLine)
  return state.doc.line(lineNumber).from
}

const buildDetailsDecorations = (state: EditorState): DecorationSet => {
  const decorations: Range<Decoration>[] = []
  const blocks = findDetailsBlocks(state)
  const activeBlockKeys = new Set(
    blocks.map((block) => getDetailsBlockKey(block.startFrom, block.endTo)),
  )
  const dark = isDarkMode()

  for (const key of detailsCollapseState.keys()) {
    if (!activeBlockKeys.has(key)) {
      detailsCollapseState.delete(key)
    }
  }

  for (const block of blocks) {
    const blockKey = getDetailsBlockKey(block.startFrom, block.endTo)
    const collapsed =
      detailsCollapseState.get(blockKey) ?? block.collapsedByDefault

    decorations.push(
      Decoration.replace({
        widget: new DetailsBlockWidget(
          block.summaryText,
          block.content,
          collapsed,
          dark,
          getDetailsEntryPos(state, block),
          block.contentFrom,
          block.contentTo,
          block.summaryLineFrom,
          block.summaryLineTo,
          block.startFrom,
          block.endTo,
        ),
        block: true,
      }).range(block.startFrom, block.endTo),
    )
  }

  decorations.sort((a, b) => a.from - b.from || a.to - b.to)
  return Decoration.set(decorations)
}

const detailsWysiwygField = StateField.define<DecorationSet>({
  create(state) {
    return buildDetailsDecorations(state)
  },
  update(value, tr) {
    if (tr.docChanged || tr.effects.length > 0) {
      return buildDetailsDecorations(tr.state)
    }
    return value
  },
  provide: (field) => EditorView.decorations.from(field),
})

// --- Keyboard Navigation ---

const focusDetailsEditor = (
  view: EditorView,
  enterPos: number,
  position: 'start' | 'end',
  retries = 3,
): void => {
  const attempt = () => {
    const el = view.dom.querySelector(
      `.cm-wysiwyg-details[data-enter-pos="${enterPos}"]`,
    ) as HTMLElement | null
    if (!el) return false
    const focusFn = (el as any).__focusEditor as
      | ((p: 'start' | 'end') => void)
      | undefined
    if (!focusFn) return false
    focusFn(position)
    return true
  }

  if (attempt() || retries <= 0) return
  requestAnimationFrame(() => {
    focusDetailsEditor(view, enterPos, position, retries - 1)
  })
}

const detailsWysiwygKeymap = Prec.highest(
  keymap.of([
    {
      key: 'ArrowDown',
      run(view) {
        const { state } = view
        if (!state.selection.main.empty) return false

        const blocks = findDetailsBlocks(state)
        const currentLine = state.doc.lineAt(state.selection.main.head)
        let nextLineNumber = currentLine.number + 1
        if (nextLineNumber > state.doc.lines) return false

        if (isHiddenSeparatorLine(state, nextLineNumber)) {
          nextLineNumber += 1
        }
        if (nextLineNumber > state.doc.lines) return false

        const block = blocks.find((item) => item.startLine === nextLineNumber)
        if (!block) return false

        const enterPos = getDetailsEntryPos(state, block)
        view.dispatch({
          selection: { anchor: enterPos },
          scrollIntoView: true,
        })
        focusDetailsEditor(view, enterPos, 'start')
        return true
      },
    },
    {
      key: 'ArrowUp',
      run(view) {
        const { state } = view
        if (!state.selection.main.empty) return false

        const blocks = findDetailsBlocks(state)
        const currentLine = state.doc.lineAt(state.selection.main.head)
        let prevLineNumber = currentLine.number - 1
        if (prevLineNumber < 1) return false

        if (isHiddenSeparatorLine(state, prevLineNumber)) {
          prevLineNumber -= 1
        }
        if (prevLineNumber < 1) return false

        const block = blocks.find((item) => item.endLine === prevLineNumber)
        if (!block) return false

        const enterPos = getDetailsEntryPos(state, block)
        view.dispatch({
          selection: { anchor: enterPos },
          scrollIntoView: true,
        })
        focusDetailsEditor(view, enterPos, 'end')
        return true
      },
    },
  ]),
)

// --- Detector Registration ---

const detailsBlockDetector = blockDetectorFacet.of({
  type: 'details',
  priority: 80,
  detect: (state) => {
    const blocks = findDetailsBlocks(state)
    return blocks.map((b) => ({
      from: b.startFrom,
      to: b.endTo,
      startLine: b.startLine,
      endLine: b.endLine,
    }))
  },
})

// --- Export ---

export const detailsWysiwygExtension = [
  detailsBlockDetector,
  detailsWysiwygField,
  detailsWysiwygKeymap,
]
