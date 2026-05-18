import { MxsError, MxsErrorCode } from './errors'

export interface OutputOptions {
  json: boolean
  output?: string
  quiet: boolean
  verbose: boolean
}

export const defaultOutputOptions: OutputOptions = {
  json: false,
  output: 'pretty-json',
  quiet: false,
  verbose: false,
}

function isTTY(stream: NodeJS.WriteStream): boolean {
  return Boolean(stream.isTTY)
}

function color(stream: NodeJS.WriteStream, code: number, text: string): string {
  if (!isTTY(stream)) return text
  return `[${code}m${text}[0m`
}

export function emitSuccess(data: unknown, opts: OutputOptions): void {
  if (opts.json || opts.output === 'json') {
    process.stdout.write(`${JSON.stringify({ ok: true, data })}\n`)
    return
  }
  if (data === null || data === undefined) {
    return
  }
  if (typeof data === 'string') {
    process.stdout.write(`${data}\n`)
    return
  }
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
}

export function emitInfo(message: string, opts: OutputOptions): void {
  if (opts.quiet || opts.json) return
  process.stderr.write(`${message}\n`)
}

export function emitWarn(message: string, opts: OutputOptions): void {
  if (opts.json) return
  process.stderr.write(`${color(process.stderr, 33, 'warn')}: ${message}\n`)
}

export function emitError(err: unknown, opts: OutputOptions): void {
  if (err instanceof MxsError) {
    if (opts.json) {
      if (err.code === MxsErrorCode.ProfileWriteRequiresExplicit) {
        const details = err.details as
          | { profile?: unknown; api_url?: unknown }
          | undefined
        process.stdout.write(
          `${JSON.stringify({
            ok: false,
            error: err.code,
            profile: details?.profile ?? null,
            api_url: details?.api_url ?? null,
            hint: err.hint ?? null,
          })}\n`,
        )
        return
      }
      process.stdout.write(`${JSON.stringify(err.toJSON())}\n`)
      return
    }
    process.stderr.write(`${color(process.stderr, 31, '✘')} ${err.message}\n`)
    if (err.details) {
      const detailLines = formatDetails(err.details)
      for (const line of detailLines) {
        process.stderr.write(`  · ${line}\n`)
      }
    }
    if (err.hint) {
      process.stderr.write(`\nhint: ${err.hint}\n`)
    }
    return
  }
  const message = err instanceof Error ? err.message : String(err)
  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify({ ok: false, code: MxsErrorCode.Generic, message })}\n`,
    )
    return
  }
  process.stderr.write(`${color(process.stderr, 31, '✘')} ${message}\n`)
}

function formatDetails(details: unknown): string[] {
  if (!details || typeof details !== 'object') return [String(details)]
  if (Array.isArray(details)) {
    return details.map((item) => formatIssue(item))
  }
  if (
    'issues' in (details as Record<string, unknown>) &&
    Array.isArray((details as any).issues)
  ) {
    return (details as any).issues.map((issue: unknown) => formatIssue(issue))
  }
  return [JSON.stringify(details)]
}

function formatIssue(issue: unknown): string {
  if (!issue || typeof issue !== 'object') return String(issue)
  const obj = issue as Record<string, unknown>
  const path = Array.isArray(obj.path) ? obj.path.join('.') : ''
  const message =
    typeof obj.message === 'string' ? obj.message : JSON.stringify(obj)
  const line = typeof obj.line === 'number' ? ` (line ${obj.line})` : ''
  const suggestions = Array.isArray(obj.suggestions)
    ? ` — did you mean ${obj.suggestions.join(', ')}?`
    : ''
  return `${path ? `${path}: ` : ''}${message}${line}${suggestions}`
}

export function renderTable(
  rows: Record<string, unknown>[],
  columns: string[],
): string {
  if (rows.length === 0) return '(no rows)'
  const widths = columns.map((col) =>
    Math.max(col.length, ...rows.map((row) => String(row[col] ?? '').length)),
  )
  const header = columns.map((col, i) => col.padEnd(widths[i] ?? 0)).join('  ')
  const sep = widths.map((w) => '-'.repeat(w)).join('  ')
  const body = rows
    .map((row) =>
      columns
        .map((col, i) => String(row[col] ?? '').padEnd(widths[i] ?? 0))
        .join('  '),
    )
    .join('\n')
  return `${header}\n${sep}\n${body}`
}
