import { highlightCode } from './codehighlight'

// ---------------------------------------------------------------------------
// Minimal markdown → ANSI renderer.
//
// We deliberately hand-roll instead of pulling in `marked-terminal` (~270 KB
// of transitive deps incl. cli-highlight, node-emoji, cli-table3) because:
//   (a) our markdown subset is tiny and fully under our control,
//   (b) the CLI is already over its bundle budget,
//   (c) we want zero runtime surprises around NO_COLOR / non-TTY detection.
//
// Supported constructs:
//   - `# heading`, `## heading`            → bold + colour
//   - paragraphs                            → as-is (with inline span parsing)
//   - 4-space indented code blocks          → dim + grey-ish
//   - fenced code blocks (```...```)        → same
//   - GFM-style two-column tables           → padded, header bold
//   - `**bold**`, ``code spans``           → ANSI bold / cyan
//   - list items (`- foo`)                  → preserved
//
// This module knows nothing about CLI help — it's a pure renderer. The help
// composition (banner, tables, sections) happens in `./index.ts`.
// ---------------------------------------------------------------------------

export interface RenderOptions {
  readonly color: boolean
}

export const ANSI = {
  reset: '\x1B[0m',
  bold: '\x1B[1m',
  dim: '\x1B[2m',
  red: '\x1B[31m',
  green: '\x1B[32m',
  yellow: '\x1B[33m',
  blue: '\x1B[34m',
  magenta: '\x1B[35m',
  cyan: '\x1B[36m',
} as const

export const wrap = (code: string, text: string, on: boolean): string =>
  on ? `${code}${text}${ANSI.reset}` : text

export const visibleLen = (s: string): number =>
  // eslint-disable-next-line no-control-regex
  s.replaceAll(/\x1B\[[\d;]*m/g, '').length

export const isColorEnabled = (stream: NodeJS.WriteStream): boolean => {
  if (process.env.NO_COLOR && process.env.NO_COLOR !== '') return false
  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0') return true
  return Boolean(stream.isTTY)
}

/**
 * Parse inline spans inside a single line of paragraph text.
 *
 * Order matters: we strip inline code spans first (so their contents are
 * never re-interpreted as bold), then bold.
 */
const renderInline = (line: string, opts: RenderOptions): string => {
  // Inline code: `text`
  let out = line.replaceAll(/`([^`]+)`/g, (_m, inner) =>
    wrap(ANSI.cyan, inner, opts.color),
  )
  // Bold: **text**
  out = out.replaceAll(/\*\*([^*]+)\*\*/g, (_m, inner) =>
    wrap(ANSI.bold, inner, opts.color),
  )
  return out
}

interface TableRow {
  readonly cells: readonly string[]
}

const parseTable = (
  source: readonly string[],
  start: number,
): { rows: TableRow[]; end: number } | null => {
  // Header row must start with `|` and the next row must be the alignment row
  // matching the same pipe layout.
  if (start + 1 >= source.length) return null
  const header = source[start]
  const sep = source[start + 1]
  if (!header.startsWith('|') || !sep.startsWith('|')) return null
  // eslint-disable-next-line regexp/no-super-linear-backtracking, unicorn/better-regex -- separator-row regex; safe in practice (literal `|` anchors each cell)
  if (!/^(?:\|[ \t]*:?-+:?[ \t]*)+\|?[ \t]*$/.test(sep)) return null

  const splitRow = (row: string): string[] => {
    const cells = row.split('|').map((c) => c.trim())
    // Strip leading/trailing empties created by the surrounding pipes.
    if (cells.length > 0 && cells[0] === '') cells.shift()
    if (cells.length > 0 && cells.at(-1) === '') cells.pop()
    return cells
  }

  const rows: TableRow[] = [{ cells: splitRow(header) }]
  let i = start + 2
  while (i < source.length) {
    const row = source[i]
    if (!row.startsWith('|')) break
    rows.push({ cells: splitRow(row) })
    i++
  }
  return { rows, end: i }
}

const renderTable = (
  rows: readonly TableRow[],
  opts: RenderOptions,
): string => {
  if (rows.length === 0) return ''
  // Render each cell through inline span parsing first so we can measure
  // visible width (post inline-styling, the ANSI sequences add no visible
  // width).
  const rendered: string[][] = rows.map((r) =>
    r.cells.map((c) => renderInline(c, opts)),
  )

  const numCols = Math.max(...rendered.map((r) => r.length))
  const widths: number[] = []
  for (let c = 0; c < numCols; c++) {
    let max = 0
    for (const row of rendered) {
      const cell = row[c] ?? ''
      if (visibleLen(cell) > max) max = visibleLen(cell)
    }
    widths.push(max)
  }

  const padRight = (s: string, width: number): string => {
    const visible = visibleLen(s)
    return visible < width ? s + ' '.repeat(width - visible) : s
  }

  const lines: string[] = []
  rendered.forEach((row, rowIdx) => {
    const cells = row.map((cell, idx) => padRight(cell, widths[idx]))
    if (rowIdx === 0) {
      // Header: bold the cells (text already styled via renderInline; wrap
      // the whole row in bold for emphasis).
      lines.push(
        '  ' + cells.map((c) => wrap(ANSI.bold, c, opts.color)).join('  '),
      )
      // Underline rule.
      lines.push(
        '  ' +
          widths
            .map((w) => wrap(ANSI.dim, '-'.repeat(w), opts.color))
            .join('  '),
      )
    } else {
      lines.push('  ' + cells.join('  '))
    }
  })
  return lines.join('\n')
}

const renderHeading = (
  level: number,
  text: string,
  opts: RenderOptions,
): string => {
  const styled = renderInline(text, opts)
  if (level === 1) {
    return wrap(`${ANSI.bold}${ANSI.magenta}`, styled, opts.color)
  }
  if (level === 2) {
    return wrap(`${ANSI.bold}${ANSI.yellow}`, styled.toUpperCase(), opts.color)
  }
  return wrap(ANSI.bold, styled, opts.color)
}

export const renderMarkdownToAnsi = (
  markdown: string,
  opts: RenderOptions,
): string => {
  const source = markdown.split('\n')
  const out: string[] = []
  let i = 0
  while (i < source.length) {
    const line = source[i]

    // Fenced code block.
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      i++
      const code: string[] = []
      while (i < source.length && !source[i].startsWith('```')) {
        code.push(source[i])
        i++
      }
      if (i < source.length) i++ // skip closing fence
      const highlighted = highlightCode(code.join('\n'), lang, opts.color)
      for (const c of highlighted.split('\n')) {
        out.push('  ' + c)
      }
      continue
    }

    // Indented code (4 spaces).
    if (line.startsWith('    ')) {
      out.push('  ' + wrap(ANSI.cyan, line.slice(4), opts.color))
      i++
      continue
    }

    // Heading.
    const headingMatch = /^(#{1,6}) (.+)$/.exec(line)
    if (headingMatch) {
      const level = headingMatch[1].length
      // Blank line before non-leading headings, for breathing room.
      if (out.length > 0 && out.at(-1) !== '') out.push('')
      out.push(renderHeading(level, headingMatch[2], opts))
      i++
      continue
    }

    // Table.
    if (line.startsWith('|')) {
      const parsed = parseTable(source, i)
      if (parsed) {
        out.push(renderTable(parsed.rows, opts))
        i = parsed.end
        continue
      }
    }

    // List item.
    if (/^[*-]\s+/.test(line)) {
      const rest = line.replace(/^[*-]\s+/, '')
      out.push('  • ' + renderInline(rest, opts))
      i++
      continue
    }

    // Blank line.
    if (line.trim() === '') {
      out.push('')
      i++
      continue
    }

    // Plain paragraph.
    out.push(renderInline(line, opts))
    i++
  }
  return out.join('\n')
}
