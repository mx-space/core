import {
  type CliError,
  codeForTag,
  defaultMessageFor,
  toErrorEnvelope,
} from '../../domain/errors'
import type { OutputOptions } from './options'
import { color, writeStderr, writeStdout } from './primitives'

const formatIssue = (issue: unknown): string => {
  if (!issue || typeof issue !== 'object') return String(issue)
  const obj = issue as Record<string, unknown>
  const path = Array.isArray(obj.path) ? (obj.path as unknown[]).join('.') : ''
  const message =
    typeof obj.message === 'string' ? obj.message : JSON.stringify(obj)
  const line = typeof obj.line === 'number' ? ` (line ${obj.line})` : ''
  const suggestions = Array.isArray(obj.suggestions)
    ? ` — did you mean ${(obj.suggestions as unknown[]).join(', ')}?`
    : ''
  return `${path ? `${path}: ` : ''}${message}${line}${suggestions}`
}

const formatDetails = (details: unknown): string[] => {
  if (!details || typeof details !== 'object') return [String(details)]
  if (Array.isArray(details)) {
    return (details as unknown[]).map((item) => formatIssue(item))
  }
  if (
    'issues' in (details as Record<string, unknown>) &&
    Array.isArray((details as { issues?: unknown[] }).issues)
  ) {
    return (details as { issues: unknown[] }).issues.map((issue: unknown) =>
      formatIssue(issue),
    )
  }
  return [JSON.stringify(details)]
}

export const emitErrorSync = (err: CliError, opts: OutputOptions): void => {
  const tag = err._tag
  if (opts.json) {
    if (tag === 'WriteRequiresExplicit') {
      // Preserve legacy special-case JSON shape for the production write
      // gate (`error`, `profile`, `api_url`, `hint`).
      const e = err as { profile?: string; apiUrl?: string; hint?: string }
      writeStdout(
        `${JSON.stringify({
          ok: false,
          error: codeForTag(tag),
          profile: e.profile ?? null,
          api_url: e.apiUrl ?? null,
          hint: e.hint ?? null,
        })}\n`,
      )
      return
    }
    writeStdout(`${JSON.stringify(toErrorEnvelope(err))}\n`)
    return
  }
  const message =
    'message' in err && typeof err.message === 'string' && err.message
      ? err.message
      : defaultMessageFor(tag)
  writeStderr(`${color(process.stderr, 31, '✘')} ${message}\n`)
  if ('details' in err && err.details !== undefined) {
    const detailLines = formatDetails(err.details)
    for (const line of detailLines) {
      writeStderr(`  · ${line}\n`)
    }
  }
  if ('hint' in err && typeof err.hint === 'string' && err.hint.length > 0) {
    writeStderr(`\nhint: ${err.hint}\n`)
  }
}
