// Structural sanity check for Mermaid diagram translations.
// LLM may break diagram syntax; on failure callers fall back to source.

export interface MermaidValidationResult {
  ok: boolean
  reason?: string
}

const MERMAID_DIRECTION_TOKENS = new Set(['TD', 'TB', 'BT', 'LR', 'RL'])

const CONNECTOR_TOKEN_RE = /--[ox]|[ox]--|[.<=>-]{2,}/g

const COUNTED_DELIMITERS = [
  '[',
  ']',
  '(',
  ')',
  '{',
  '}',
  '"',
  '`',
  '|',
] as const

const LENGTH_RATIO_MIN = 0.3
const LENGTH_RATIO_MAX = 4

function firstMeaningfulLine(text: string): string {
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('%%')) continue
    return line
  }
  return ''
}

function parseHeader(text: string): {
  keyword: string | null
  direction: string | null
} {
  const line = firstMeaningfulLine(text)
  if (!line) return { keyword: null, direction: null }

  const tokens = line.split(/[\s:]+/).filter(Boolean)
  const keyword = tokens[0] ?? null
  const direction =
    tokens[1] && MERMAID_DIRECTION_TOKENS.has(tokens[1]) ? tokens[1] : null
  return { keyword, direction }
}

function countOccurrences(text: string, char: string): number {
  let n = 0
  for (const c of text) if (c === char) n++
  return n
}

function connectorMultiset(text: string): Map<string, number> {
  const result = new Map<string, number>()
  const matches = text.match(CONNECTOR_TOKEN_RE) ?? []
  for (const token of matches) {
    result.set(token, (result.get(token) ?? 0) + 1)
  }
  return result
}

function nonEmptyLineCount(text: string): number {
  return text.split('\n').filter((line) => line.trim().length > 0).length
}

export function validateMermaidTranslation(
  source: string,
  translated: string,
): MermaidValidationResult {
  if (!source.trim()) return { ok: false, reason: 'empty_source' }
  if (!translated.trim()) return { ok: false, reason: 'empty_translation' }

  const srcHeader = parseHeader(source)
  const tgtHeader = parseHeader(translated)

  if (srcHeader.keyword && srcHeader.keyword !== tgtHeader.keyword) {
    return {
      ok: false,
      reason: `keyword_mismatch:${srcHeader.keyword}->${tgtHeader.keyword ?? 'null'}`,
    }
  }
  if (srcHeader.direction && srcHeader.direction !== tgtHeader.direction) {
    return {
      ok: false,
      reason: `direction_mismatch:${srcHeader.direction}->${tgtHeader.direction ?? 'null'}`,
    }
  }

  const srcConnectors = connectorMultiset(source)
  const tgtConnectors = connectorMultiset(translated)
  const seenConnectors = new Set<string>([
    ...srcConnectors.keys(),
    ...tgtConnectors.keys(),
  ])
  for (const token of seenConnectors) {
    if ((srcConnectors.get(token) ?? 0) !== (tgtConnectors.get(token) ?? 0)) {
      return { ok: false, reason: `connector_mismatch:${token}` }
    }
  }

  for (const ch of COUNTED_DELIMITERS) {
    const sc = countOccurrences(source, ch)
    const tc = countOccurrences(translated, ch)
    if (sc !== tc) {
      return { ok: false, reason: `delimiter_mismatch:${ch} ${sc}->${tc}` }
    }
  }

  const srcLines = nonEmptyLineCount(source)
  const tgtLines = nonEmptyLineCount(translated)
  if (srcLines !== tgtLines) {
    return { ok: false, reason: `line_count_mismatch:${srcLines}->${tgtLines}` }
  }

  const ratio = translated.length / source.length
  if (ratio < LENGTH_RATIO_MIN || ratio > LENGTH_RATIO_MAX) {
    return { ok: false, reason: `length_ratio:${ratio.toFixed(2)}` }
  }

  return { ok: true }
}
