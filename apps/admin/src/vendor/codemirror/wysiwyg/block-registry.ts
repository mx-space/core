import type { EditorState } from '@codemirror/state'

import { Facet, StateField } from '@codemirror/state'

export interface BlockRange {
  from: number
  to: number
  startLine: number
  endLine: number
  type: string
}

export interface BlockDetectorConfig {
  type: string
  priority: number
  detect: (state: EditorState) => Omit<BlockRange, 'type'>[]
}

export const blockDetectorFacet = Facet.define<BlockDetectorConfig>()
const lineBreakTagPattern = /^\s*<br\s*\/?>\s*$/i

export const isLineBreakTagLine = (text: string): boolean =>
  lineBreakTagPattern.test(text)

function computeBlockRanges(state: EditorState): BlockRange[] {
  const configs = [...state.facet(blockDetectorFacet)].sort(
    (a, b) => b.priority - a.priority,
  )

  const claimedLines = new Set<number>()
  const result: BlockRange[] = []

  for (const config of configs) {
    const ranges = config.detect(state)
    for (const range of ranges) {
      let overlap = false
      for (let l = range.startLine; l <= range.endLine; l++) {
        if (claimedLines.has(l)) {
          overlap = true
          break
        }
      }
      if (!overlap) {
        for (let l = range.startLine; l <= range.endLine; l++) {
          claimedLines.add(l)
        }
        result.push({ ...range, type: config.type })
      }
    }
  }

  return result.sort((a, b) => a.from - b.from)
}

export const blockRangesField = StateField.define<BlockRange[]>({
  create(state) {
    return computeBlockRanges(state)
  },
  update(value, tr) {
    if (tr.docChanged) return computeBlockRanges(tr.state)
    return value
  },
})

export function isLineInBlock(
  state: EditorState,
  lineNumber: number,
  excludeType?: string,
): boolean {
  const ranges = state.field(blockRangesField)
  for (const range of ranges) {
    if (excludeType && range.type === excludeType) continue
    if (lineNumber >= range.startLine && lineNumber <= range.endLine)
      return true
  }
  return false
}

export const isHiddenSeparatorLine = (
  state: EditorState,
  lineNumber: number,
): boolean => {
  const doc = state.doc
  if (lineNumber < 1 || lineNumber > doc.lines) return false
  const line = doc.line(lineNumber)
  if (line.text.trim() !== '') return false
  if (lineNumber === 1) return false
  const prevLine = doc.line(lineNumber - 1)
  return prevLine.text.trim() !== ''
}
