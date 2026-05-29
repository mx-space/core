import type { EditorState, Range } from '@codemirror/state'
import type { DecorationSet, EditorView } from '@codemirror/view'

import { Decoration, ViewPlugin, WidgetType } from '@codemirror/view'

type GithubAlertType = 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION'

const ALERT_COLORS: Record<GithubAlertType, string> = {
  NOTE: '#0969da',
  TIP: '#1a7f37',
  IMPORTANT: '#8250df',
  WARNING: '#9a6700',
  CAUTION: '#cf222e',
}

type LucideIconNode = Array<[tag: string, attrs: Record<string, string>]>

const lucideIconNodes: Record<
  GithubAlertType,
  { name: string; node: LucideIconNode }
> = {
  NOTE: {
    name: 'info',
    node: [
      ['circle', { cx: '12', cy: '12', r: '10' }],
      ['path', { d: 'M12 16v-4' }],
      ['path', { d: 'M12 8h.01' }],
    ],
  },
  TIP: {
    name: 'lightbulb',
    node: [
      [
        'path',
        {
          d: 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5',
        },
      ],
      ['path', { d: 'M9 18h6' }],
      ['path', { d: 'M10 22h4' }],
    ],
  },
  IMPORTANT: {
    name: 'badge-info',
    node: [
      [
        'path',
        {
          d: 'M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z',
        },
      ],
      ['line', { x1: '12', x2: '12', y1: '16', y2: '12' }],
      ['line', { x1: '12', x2: '12.01', y1: '8', y2: '8' }],
    ],
  },
  WARNING: {
    name: 'circle-alert',
    node: [
      ['circle', { cx: '12', cy: '12', r: '10' }],
      ['line', { x1: '12', x2: '12', y1: '8', y2: '12' }],
      ['line', { x1: '12', x2: '12.01', y1: '16', y2: '16' }],
    ],
  },
  CAUTION: {
    name: 'octagon-alert',
    node: [
      ['path', { d: 'M12 16h.01' }],
      ['path', { d: 'M12 8v4' }],
      [
        'path',
        {
          d: 'M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z',
        },
      ],
    ],
  },
}

const createLucideSvg = (type: GithubAlertType): SVGSVGElement => {
  const icon = lucideIconNodes[type]
  const svgNS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('xmlns', svgNS)
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('class', `cm-wysiwyg-alert-icon lucide lucide-${icon.name}`)
  svg.setAttribute('aria-hidden', 'true')

  for (const [tag, attrs] of icon.node) {
    const el = document.createElementNS(svgNS, tag)
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value)
    }
    svg.appendChild(el)
  }

  return svg
}

// Blockquote marker widget - hidden but occupies space
class BlockquoteMarkerWidget extends WidgetType {
  constructor(readonly level: number) {
    super()
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-wysiwyg-blockquote-marker'
    // Add visual indicator for nesting level
    span.style.marginLeft = `${(this.level - 1) * 0.5}em`
    return span
  }

  eq(other: BlockquoteMarkerWidget): boolean {
    return this.level === other.level
  }

  ignoreEvent(): boolean {
    return true
  }
}

// GitHub alert marker widget - replaces > [!TYPE]
class AlertMarkerWidget extends WidgetType {
  constructor(
    readonly level: number,
    readonly type: GithubAlertType,
  ) {
    super()
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    const typeClass = `cm-wysiwyg-alert-${this.type.toLowerCase()}`
    span.className = `cm-wysiwyg-alert-marker ${typeClass}`
    span.style.marginLeft = `${(this.level - 1) * 0.5}em`
    span.style.setProperty('--cm-alert-color', ALERT_COLORS[this.type])

    span.appendChild(createLucideSvg(this.type))

    const label = document.createElement('span')
    label.className = 'cm-wysiwyg-alert-label'
    // Title Case for the label (e.g., NOTE -> Note)
    const titleCase =
      this.type.charAt(0).toUpperCase() + this.type.slice(1).toLowerCase()
    label.textContent = titleCase

    span.appendChild(label)
    span.appendChild(document.createTextNode(' '))

    return span
  }

  eq(other: AlertMarkerWidget): boolean {
    return this.level === other.level && this.type === other.type
  }

  ignoreEvent(): boolean {
    return true
  }
}

// Pattern for blockquote detection: > at start, possibly nested
const blockquotePattern = /^(\s*)((?:>\s*)+)/
const githubAlertPattern = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i

interface BlockquoteMatch {
  lineFrom: number
  lineTo: number
  markerStart: number
  markerEnd: number
  level: number // Nesting level (number of >)
  alertType?: GithubAlertType
  alertMarkerEnd?: number
}

interface BlockquoteLineInfo {
  lineNumber: number
  lineFrom: number
  blockquote: BlockquoteMatch | null
  cursorOnLine: boolean
  alertType: GithubAlertType | null
  alertLevel: number | null
}

// Find blockquote in a line
const findBlockquote = (
  lineText: string,
  lineFrom: number,
  lineTo: number,
): BlockquoteMatch | null => {
  const match = blockquotePattern.exec(lineText)
  if (!match) return null

  const indent = match[1].length
  const markers = match[2]
  // Count the number of > for nesting level
  const level = (markers.match(/>/g) || []).length

  const markerStart = lineFrom + indent
  const markerEnd = markerStart + markers.length
  const afterMarker = lineText.slice(indent + markers.length)
  const alertMatch = githubAlertPattern.exec(afterMarker)

  let alertType: GithubAlertType | undefined
  let alertMarkerEnd: number | undefined

  if (alertMatch) {
    alertType = alertMatch[1].toUpperCase() as GithubAlertType
    alertMarkerEnd = markerEnd + alertMatch[0].length
  }

  return {
    lineFrom,
    lineTo,
    markerStart,
    markerEnd,
    level,
    alertType,
    alertMarkerEnd,
  }
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

const buildBlockquoteDecorations = (state: EditorState): DecorationSet => {
  const decorations: Range<Decoration>[] = []
  const lineInfos: BlockquoteLineInfo[] = []
  let activeAlert: { level: number; type: GithubAlertType } | null = null

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber++) {
    const line = state.doc.line(lineNumber)
    const blockquote = findBlockquote(line.text, line.from, line.to)

    if (!blockquote) {
      activeAlert = null
      lineInfos.push({
        lineNumber,
        lineFrom: line.from,
        blockquote: null,
        cursorOnLine: false,
        alertType: null,
        alertLevel: null,
      })
      continue
    }

    const cursorOnLine = isCursorOnLine(
      state,
      blockquote.lineFrom,
      blockquote.lineTo,
    )

    if (activeAlert && blockquote.level < activeAlert.level) {
      activeAlert = null
    }

    if (blockquote.alertType) {
      activeAlert = { level: blockquote.level, type: blockquote.alertType }
    }

    const alertType = blockquote.alertType ?? activeAlert?.type
    const alertLevel = alertType
      ? (activeAlert?.level ?? blockquote.level)
      : null

    lineInfos.push({
      lineNumber,
      lineFrom: line.from,
      blockquote,
      cursorOnLine,
      alertType: alertType ?? null,
      alertLevel,
    })
  }

  for (let i = 0; i < lineInfos.length; i++) {
    const info = lineInfos[i]
    if (!info.blockquote) continue

    const { blockquote, alertType, alertLevel } = info
    const prev = i > 0 ? lineInfos[i - 1] : null
    const next = i < lineInfos.length - 1 ? lineInfos[i + 1] : null

    const isSameAlert = (
      a: BlockquoteLineInfo | null,
      b: BlockquoteLineInfo,
    ): boolean => {
      if (!a?.blockquote || !a.alertType || !a.alertLevel) return false
      if (!b.alertType || !b.alertLevel || !b.blockquote) return false
      if (a.alertType !== b.alertType) return false
      if (a.alertLevel !== b.alertLevel) return false
      return (
        a.blockquote.level >= a.alertLevel && b.blockquote.level >= b.alertLevel
      )
    }

    const prevSameAlert = isSameAlert(prev, info)
    const nextSameAlert = next ? isSameAlert(next, info) : false

    let alertShapeClass = ''
    if (alertType) {
      if (!prevSameAlert && !nextSameAlert) {
        alertShapeClass = ' cm-wysiwyg-alert-single'
      } else if (!prevSameAlert) {
        alertShapeClass = ' cm-wysiwyg-alert-start'
      } else if (!nextSameAlert) {
        alertShapeClass = ' cm-wysiwyg-alert-end'
      } else {
        alertShapeClass = ' cm-wysiwyg-alert-middle'
      }
    }

    const prevIsBlockquote = Boolean(prev?.blockquote)
    const nextIsBlockquote = Boolean(next?.blockquote)
    let blockquoteShapeClass = ''
    if (!alertType) {
      if (!prevIsBlockquote && !nextIsBlockquote) {
        blockquoteShapeClass = ' cm-wysiwyg-blockquote-single'
      } else if (!prevIsBlockquote) {
        blockquoteShapeClass = ' cm-wysiwyg-blockquote-start'
      } else if (!nextIsBlockquote) {
        blockquoteShapeClass = ' cm-wysiwyg-blockquote-end'
      } else {
        blockquoteShapeClass = ' cm-wysiwyg-blockquote-middle'
      }
    }

    const alertClass = alertType
      ? ` cm-wysiwyg-alert-line cm-wysiwyg-alert-${alertType.toLowerCase()}${alertShapeClass}`
      : ''

    // Add line decoration for styling
    decorations.push(
      Decoration.line({
        class: `cm-wysiwyg-blockquote-line cm-wysiwyg-blockquote-level-${Math.min(blockquote.level, 5)}${alertClass}${blockquoteShapeClass}`,
      }).range(info.lineFrom),
    )

    // Only hide marker if cursor is NOT on this line
    if (!info.cursorOnLine) {
      if (blockquote.alertType && blockquote.alertMarkerEnd) {
        decorations.push(
          Decoration.replace({
            widget: new AlertMarkerWidget(
              blockquote.level,
              blockquote.alertType,
            ),
          }).range(blockquote.markerStart, blockquote.alertMarkerEnd),
        )
      } else {
        decorations.push(
          Decoration.replace({
            widget: new BlockquoteMarkerWidget(blockquote.level),
          }).range(blockquote.markerStart, blockquote.markerEnd),
        )
      }
    }
  }

  decorations.sort((a, b) => a.from - b.from || a.to - b.to)
  return Decoration.set(decorations)
}

// Use ViewPlugin to react to selection changes
const blockquoteWysiwygPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildBlockquoteDecorations(view.state)
    }

    update(update: {
      docChanged: boolean
      selectionSet: boolean
      state: EditorState
    }) {
      if (update.docChanged || update.selectionSet) {
        this.decorations = buildBlockquoteDecorations(update.state)
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
)

export const blockquoteWysiwygExtension = [blockquoteWysiwygPlugin]
