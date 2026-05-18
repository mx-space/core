import { createDefaultRegistry, serializeToXml } from '@haklex/rich-litexml'
import { Context, Effect, FiberRef, Layer } from 'effect'

import {
  type CliError,
  codeForTag,
  defaultMessageFor,
  toErrorEnvelope,
} from '../domain/errors'

// ---------------------------------------------------------------------------
// Output options + FiberRef
// ---------------------------------------------------------------------------

export type OutputMode =
  | 'pretty-json'
  | 'json'
  | 'readable'
  | 'llm'
  | 'envelope'

export interface OutputOptions {
  readonly json: boolean
  readonly output: OutputMode
  readonly quiet: boolean
  readonly verbose: boolean
}

export const defaultOutputOptions: OutputOptions = {
  json: false,
  output: 'pretty-json',
  quiet: false,
  verbose: false,
}

// One FiberRef carries the per-run output options. The bin entry sets it once
// at the root after parsing global flags; tests override it per-Effect via
// `Effect.locally(currentOutputOptions, ...)`. Choosing a FiberRef over a
// command-level context parameter keeps every `Api`/`Renderer`/command body
// free of an explicit options argument while still being fully testable.
export const currentOutputOptions =
  FiberRef.unsafeMake<OutputOptions>(defaultOutputOptions)

export type DocumentKind = 'post' | 'note' | 'page'

export interface RendererService {
  /** Active output configuration in the current fiber. */
  readonly options: Effect.Effect<OutputOptions>
  /** Generic success payload — switches on `--output`. */
  readonly emitSuccess: (data: unknown) => Effect.Effect<void>
  /** Info line on stderr (suppressed by `--quiet` / `--json`). */
  readonly emitInfo: (message: string) => Effect.Effect<void>
  /** Warning line on stderr (suppressed by `--json`). */
  readonly emitWarn: (message: string) => Effect.Effect<void>
  /** Error envelope or pretty error to stderr/stdout per output mode. */
  readonly emitError: (err: CliError) => Effect.Effect<void>
  /** Typed document emission for post/note/page. */
  readonly emitDocument: (
    kind: DocumentKind,
    data: unknown,
  ) => Effect.Effect<void>
  /** Typed post list emission. */
  readonly emitPostList: (data: unknown) => Effect.Effect<void>
  /** Typed profile show emission. */
  readonly emitProfileShow: (data: unknown) => Effect.Effect<void>
  /** Typed profile list emission. */
  readonly emitProfileList: (data: unknown) => Effect.Effect<void>
}

// ---------------------------------------------------------------------------
// Pure renderers (ported from src/core/document-output.ts)
// ---------------------------------------------------------------------------

const POST_LIST_OUTPUT_MODES = new Set<OutputMode>([
  'pretty-json',
  'json',
  'readable',
  'llm',
])

const DOCUMENT_OUTPUT_MODES = new Set<OutputMode>([
  'pretty-json',
  'json',
  'readable',
  'llm',
  'envelope',
])

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const first = (record: Record<string, unknown>, ...keys: string[]): unknown => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key]
  }
  return undefined
}

const firstString = (
  record: Record<string, unknown>,
  ...keys: string[]
): string => {
  const value = first(record, ...keys)
  return typeof value === 'string' ? value : ''
}

const contentFormat = (doc: Record<string, unknown>): string => {
  const value = first(doc, 'content_format', 'contentFormat')
  return typeof value === 'string' ? value : 'markdown'
}

const publishState = (doc: Record<string, unknown>): string | undefined => {
  const value = first(doc, 'is_published', 'isPublished')
  if (typeof value === 'boolean') return value ? 'published' : 'draft'
  return undefined
}

const relationLabel = (value: unknown): string | undefined => {
  if (!value) return undefined
  if (typeof value === 'string') return value
  const obj = asRecord(value)
  return (
    firstString(obj, 'name') ||
    firstString(obj, 'slug') ||
    firstString(obj, 'id')
  )
}

const relationSlugOrLabel = (value: unknown): string | undefined => {
  if (!value) return undefined
  if (typeof value === 'string') return value
  const obj = asRecord(value)
  return (
    firstString(obj, 'slug') ||
    firstString(obj, 'name') ||
    firstString(obj, 'id')
  )
}

const formatScalar = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(formatScalar).join(', ')
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && value !== null) return JSON.stringify(value)
  return String(value)
}

const escapeXml = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const renderEnvelopeMeta = (key: string, value: unknown): string => {
  if (key === 'tags' && Array.isArray(value)) {
    const tags = value
      .map((item) => `      <tag>${escapeXml(formatScalar(item))}</tag>`)
      .join('\n')
    return `    <tags>\n${tags}\n    </tags>`
  }
  return `    <${key}>${escapeXml(formatScalar(value))}</${key}>`
}

const unwrapDocument = (data: unknown): unknown => {
  const obj = asRecord(data)
  const nested = obj.data
  if (nested && typeof nested === 'object' && !Array.isArray(nested))
    return nested
  return data
}

// Synchronous Lexical → LiteXML helper kept inline so the Renderer can match
// legacy `document-output.ts` behaviour without depending on the Lexical
// service. The Lexical service still owns Markdown derivation (`--output llm`)
// and stateful round-trips; here we only need the cheap XML serialization.
let cachedRegistry: ReturnType<typeof createDefaultRegistry> | null = null
const getRegistry = () => {
  if (!cachedRegistry) cachedRegistry = createDefaultRegistry()
  return cachedRegistry
}

const stripDocWrapper = (xml: string): string => {
  const trimmed = xml.trim()
  if (trimmed.startsWith('<doc>') && trimmed.endsWith('</doc>')) {
    return trimmed.slice('<doc>'.length, trimmed.length - '</doc>'.length)
  }
  return trimmed
}

const tryLexicalToLitexml = (jsonStr: string): string | null => {
  try {
    const parsed = JSON.parse(jsonStr) as unknown
    const xml = serializeToXml(parsed as any, getRegistry(), { compact: false })
    return stripDocWrapper(xml).trim()
  } catch {
    return null
  }
}

const renderContent = (
  doc: Record<string, unknown>,
): { body: string; format: 'litexml' | 'markdown' | 'text' } => {
  const format = contentFormat(doc)
  const content = firstString(doc, 'content')
  const text = firstString(doc, 'text')
  if (format === 'lexical' && content) {
    const xml = tryLexicalToLitexml(content)
    if (xml !== null) return { body: xml, format: 'litexml' }
    return { body: text || content, format: text ? 'text' : 'markdown' }
  }
  return {
    body: content || text || '',
    format: format === 'markdown' ? 'markdown' : 'text',
  }
}

const collectReadableFields = (
  kind: DocumentKind,
  doc: Record<string, unknown>,
): Array<[string, unknown]> => {
  const base: Array<[string, unknown]> = [
    ['id', first(doc, 'id')],
    ['title', first(doc, 'title')],
    ['slug', first(doc, 'slug')],
  ]
  if (kind === 'post') {
    base.push(
      ['state', publishState(doc)],
      ['category', relationLabel(first(doc, 'category'))],
      ['tags', first(doc, 'tags')],
      ['pin', first(doc, 'pin')],
    )
  } else if (kind === 'note') {
    base.push(
      ['nid', first(doc, 'nid')],
      ['state', publishState(doc)],
      ['topic', relationLabel(first(doc, 'topic'))],
      ['mood', first(doc, 'mood')],
      ['weather', first(doc, 'weather')],
      ['public_at', first(doc, 'public_at', 'publicAt')],
      ['bookmark', first(doc, 'bookmark')],
    )
  } else {
    base.push(
      ['subtitle', first(doc, 'subtitle')],
      ['order', first(doc, 'order')],
    )
  }
  base.push(
    ['created_at', first(doc, 'created_at', 'createdAt')],
    ['modified_at', first(doc, 'modified_at', 'modifiedAt')],
    ['source_lang', first(doc, 'source_lang', 'sourceLang')],
    ['translated', first(doc, 'is_translated', 'isTranslated')],
  )
  return base
}

const collectEnvelopeMeta = (
  kind: DocumentKind,
  doc: Record<string, unknown>,
): Array<[string, unknown]> => {
  const meta: Array<[string, unknown]> = [
    ['title', first(doc, 'title')],
    ['slug', first(doc, 'slug')],
  ]
  if (kind === 'post') {
    meta.push(
      ['category', relationSlugOrLabel(first(doc, 'category'))],
      ['state', publishState(doc) === 'published' ? 'publish' : 'draft'],
      ['summary', first(doc, 'summary')],
      ['tags', first(doc, 'tags')],
    )
  } else if (kind === 'note') {
    meta.push(
      ['topic', relationSlugOrLabel(first(doc, 'topic'))],
      ['state', publishState(doc) === 'published' ? 'publish' : 'draft'],
      ['mood', first(doc, 'mood')],
      ['weather', first(doc, 'weather')],
      ['publicAt', first(doc, 'public_at', 'publicAt')],
      ['bookmark', first(doc, 'bookmark')],
      ['location', first(doc, 'location')],
    )
  } else {
    meta.push(
      ['subtitle', first(doc, 'subtitle')],
      ['order', first(doc, 'order')],
    )
  }
  meta.push(['format', contentFormat(doc)])
  return meta.filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  )
}

export const renderReadableDocument = (
  kind: DocumentKind,
  data: unknown,
): string => {
  const doc = asRecord(data)
  const lines: string[] = [kind]
  const fields = collectReadableFields(kind, doc)
  for (const [key, value] of fields) {
    if (value === undefined || value === null || value === '') continue
    lines.push(`${key}: ${formatScalar(value)}`)
  }
  const summary = firstString(doc, 'summary', 'subtitle')
  if (summary) {
    lines.push('', 'summary:', summary)
  }
  const content = renderContent(doc)
  if (content.body) {
    lines.push(
      '',
      `content_format: ${content.format}`,
      '',
      'content:',
      content.body,
    )
  }
  return lines.join('\n')
}

export const renderDocumentEnvelope = (
  kind: DocumentKind,
  data: unknown,
): string => {
  const doc = asRecord(data)
  const root = kind === 'note' ? 'mxnote' : 'mxpost'
  const meta = collectEnvelopeMeta(kind, doc)
  const metaLines = meta.map(([key, value]) => renderEnvelopeMeta(key, value))
  const content = renderContent(doc)
  return `<${root}>
  <meta>
${metaLines.join('\n')}
  </meta>
  <content>
${content.body}
  </content>
</${root}>`
}

export const renderPostList = (data: unknown): string => {
  const payload = asRecord(data)
  const rows = Array.isArray(payload.data)
    ? (payload.data as unknown[])
    : Array.isArray(data)
      ? (data as unknown[])
      : []
  const pagination = asRecord(first(payload, 'pagination'))
  const lines = ['posts']
  if (rows.length > 0) lines.push(`count: ${rows.length}`)
  else lines.push('count: 0')
  const page = first(pagination, 'page', 'currentPage')
  const size = first(pagination, 'size', 'pageSize')
  const total = first(pagination, 'total', 'totalCount')
  if (page !== undefined) lines.push(`page: ${formatScalar(page)}`)
  if (size !== undefined) lines.push(`size: ${formatScalar(size)}`)
  if (total !== undefined) lines.push(`total: ${formatScalar(total)}`)
  rows.forEach((row, index) => {
    const doc = asRecord(row)
    lines.push('', `post ${index + 1}:`)
    const fields: Array<[string, unknown]> = [
      ['id', first(doc, 'id')],
      ['title', first(doc, 'title')],
      ['slug', first(doc, 'slug')],
      ['state', publishState(doc)],
      ['category', relationLabel(first(doc, 'category'))],
      ['tags', first(doc, 'tags')],
      ['summary', first(doc, 'summary')],
      ['created_at', first(doc, 'created_at', 'createdAt')],
      ['modified_at', first(doc, 'modified_at', 'modifiedAt')],
      ['source_lang', first(doc, 'source_lang', 'sourceLang')],
      ['translated', first(doc, 'is_translated', 'isTranslated')],
    ]
    for (const [key, value] of fields) {
      if (value === undefined || value === null || value === '') continue
      lines.push(`${key}: ${formatScalar(value)}`)
    }
  })
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// stderr / stdout helpers
// ---------------------------------------------------------------------------

const isTTY = (stream: NodeJS.WriteStream): boolean => Boolean(stream.isTTY)

const color = (
  stream: NodeJS.WriteStream,
  code: number,
  text: string,
): string => {
  if (!isTTY(stream)) return text
  return `\x1B[${code}m${text}\x1B[0m`
}

const writeStdout = (s: string): void => {
  process.stdout.write(s)
}
const writeStderr = (s: string): void => {
  process.stderr.write(s)
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

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

const makeService = (): RendererService => {
  const getOpts: Effect.Effect<OutputOptions> =
    FiberRef.get(currentOutputOptions)

  const emitSuccessSync = (data: unknown, opts: OutputOptions): void => {
    if (opts.json || opts.output === 'json') {
      writeStdout(`${JSON.stringify({ ok: true, data })}\n`)
      return
    }
    if (data === null || data === undefined) return
    if (typeof data === 'string') {
      writeStdout(`${data}\n`)
      return
    }
    writeStdout(`${JSON.stringify(data, null, 2)}\n`)
  }

  const emitErrorSync = (err: CliError, opts: OutputOptions): void => {
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

  return {
    options: getOpts,

    emitSuccess: (data) =>
      Effect.flatMap(getOpts, (opts) =>
        Effect.sync(() => emitSuccessSync(data, opts)),
      ),

    emitInfo: (message) =>
      Effect.flatMap(getOpts, (opts) =>
        Effect.sync(() => {
          if (opts.quiet || opts.json) return
          writeStderr(`${message}\n`)
        }),
      ),

    emitWarn: (message) =>
      Effect.flatMap(getOpts, (opts) =>
        Effect.sync(() => {
          if (opts.json) return
          writeStderr(`${color(process.stderr, 33, 'warn')}: ${message}\n`)
        }),
      ),

    emitError: (err) =>
      Effect.flatMap(getOpts, (opts) =>
        Effect.sync(() => emitErrorSync(err, opts)),
      ),

    emitDocument: (kind, data) =>
      Effect.flatMap(getOpts, (opts) =>
        Effect.sync(() => {
          const mode: OutputMode = opts.output ?? 'pretty-json'
          if (!DOCUMENT_OUTPUT_MODES.has(mode)) {
            // Match legacy MxsError thrown for unsupported output; emit as
            // error and bail.
            writeStderr(
              `${color(process.stderr, 31, '✘')} unsupported --output value: ${mode}\n`,
            )
            return
          }
          if (opts.json || mode === 'json' || mode === 'pretty-json') {
            emitSuccessSync(data, opts)
            return
          }
          const doc = unwrapDocument(data)
          const rendered =
            mode === 'envelope'
              ? renderDocumentEnvelope(kind, doc)
              : renderReadableDocument(kind, doc)
          writeStdout(`${rendered}\n`)
        }),
      ),

    emitPostList: (data) =>
      Effect.flatMap(getOpts, (opts) =>
        Effect.sync(() => {
          const mode: OutputMode = opts.output ?? 'pretty-json'
          if (!POST_LIST_OUTPUT_MODES.has(mode)) {
            writeStderr(
              `${color(process.stderr, 31, '✘')} unsupported --output value for post list: ${mode}\n`,
            )
            return
          }
          if (opts.json || mode === 'json' || mode === 'pretty-json') {
            emitSuccessSync(data, opts)
            return
          }
          writeStdout(`${renderPostList(data)}\n`)
        }),
      ),

    emitProfileShow: (data) =>
      Effect.flatMap(getOpts, (opts) =>
        Effect.sync(() => emitSuccessSync(data, opts)),
      ),

    emitProfileList: (data) =>
      Effect.flatMap(getOpts, (opts) =>
        Effect.sync(() => emitSuccessSync(data, opts)),
      ),
  }
}

export class Renderer extends Context.Tag('Renderer')<
  Renderer,
  RendererService
>() {
  static Default: Layer.Layer<Renderer> = Layer.succeed(Renderer, makeService())

  /** Apply the given `OutputOptions` for the duration of `effect`. */
  static withOptions: <A, E, R>(
    options: OutputOptions,
  ) => (effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R> =
    (options) => (effect) =>
      Effect.locally(effect, currentOutputOptions, options)
}
