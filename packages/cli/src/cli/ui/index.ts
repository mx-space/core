// Small TTY-aware UI primitives for command-specific rendering.
//
// `renderMarkdownToAnsi` (in ../render) handles structured prose, but
// some commands need bespoke layouts — boxed device-codes, fixed-width tables,
// status badges. Those primitives live here. Each takes an explicit
// `{ color: boolean }` so callers can opt out (NO_COLOR / non-TTY).

import { ANSI, visibleLen, wrap } from '../render'

export { ANSI, isColorEnabled, visibleLen, wrap } from '../render'

// ---------------------------------------------------------------------------
// Badges — leading icon + text, coloured when permitted.
// ---------------------------------------------------------------------------

export const ok = (text: string, color: boolean): string =>
  `${wrap(ANSI.green, '✓', color)} ${text}`

export const fail = (text: string, color: boolean): string =>
  `${wrap(ANSI.red, '✗', color)} ${text}`

export const arrow = (text: string, color: boolean): string =>
  `${wrap(ANSI.cyan, '→', color)} ${text}`

export const star = (text: string, color: boolean): string =>
  `${wrap(ANSI.yellow, '✦', color)} ${text}`

export const dot = (text: string, color: boolean): string =>
  `${wrap(ANSI.cyan, '●', color)} ${text}`

export const dim = (text: string, color: boolean): string =>
  wrap(ANSI.dim, text, color)

export const bold = (text: string, color: boolean): string =>
  wrap(ANSI.bold, text, color)

// ---------------------------------------------------------------------------
// Rounded box — `╭─╮│╰─╯`. Always unicode; modern terminals handle it.
// ---------------------------------------------------------------------------

export const roundedBox = (lines: string[]): string => {
  const inner = lines.map((l) => l)
  const width = inner.reduce((max, l) => Math.max(max, visibleLen(l)), 0)
  const horizontal = '─'.repeat(width + 2)
  const top = `╭${horizontal}╮`
  const bottom = `╰${horizontal}╯`
  const middle = inner.map((l) => {
    const pad = ' '.repeat(width - visibleLen(l))
    return `│ ${l}${pad} │`
  })
  return [top, ...middle, bottom].join('\n')
}

/** Indent every line of `text` by `pad` spaces. */
export const indent = (text: string, pad: number): string => {
  const prefix = ' '.repeat(pad)
  return text
    .split('\n')
    .map((l) => `${prefix}${l}`)
    .join('\n')
}

// ---------------------------------------------------------------------------
// Table — fixed-width columns, header rendered dim.
// ---------------------------------------------------------------------------

export interface TableColumn {
  readonly key: string
  readonly label: string
  /** Minimum column width (auto-grows to fit content). */
  readonly minWidth?: number
}

export const renderTable = (
  cols: readonly TableColumn[],
  rows: readonly Record<string, string>[],
  opts: { readonly color: boolean; readonly prefix?: (row: number) => string },
): string => {
  if (rows.length === 0) {
    return dim('(no rows)', opts.color)
  }
  const widths = cols.map((c) =>
    Math.max(
      c.label.length,
      c.minWidth ?? 0,
      ...rows.map((r) => visibleLen(r[c.key] ?? '')),
    ),
  )
  const renderRow = (cells: string[]) =>
    cells
      .map((cell, i) => {
        const padLen = widths[i] - visibleLen(cell)
        return `${cell}${' '.repeat(Math.max(0, padLen))}`
      })
      .join('  ')

  const header = wrap(
    ANSI.dim,
    renderRow(cols.map((c) => c.label.toUpperCase())),
    opts.color,
  )
  const body = rows.map((row, idx) => {
    const prefix = opts.prefix?.(idx) ?? ' '
    return `${prefix} ${renderRow(cols.map((c) => row[c.key] ?? ''))}`
  })
  return [`  ${header}`, ...body].join('\n')
}

// ---------------------------------------------------------------------------
// Human-readable duration — seconds → "30 min", "2h 14m", "45s".
// ---------------------------------------------------------------------------

export const humanDuration = (seconds: number): string => {
  if (seconds < 0) return 'expired'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remMin = minutes % 60
  if (hours < 24) return remMin ? `${hours}h ${remMin}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  const remH = hours % 24
  return remH ? `${days}d ${remH}h` : `${days}d`
}

/** Format milliseconds-since-epoch as `<duration>` until that point. */
export const humanUntil = (epochMs: number): string => {
  const seconds = Math.round((epochMs - Date.now()) / 1000)
  return humanDuration(seconds)
}
