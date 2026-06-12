import { Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import type { Generic, ValidationFailed } from '../../domain/errors'
import { Editor } from '../../services/Editor'

const optional = <A>(self: Options.Options<A>) => Options.optional(self)
const unwrap = <A>(value: Option.Option<A>): A | undefined =>
  Option.getOrUndefined(value)

export const SNIPPET_TYPES = [
  'json',
  'json5',
  'function',
  'text',
  'yaml',
] as const

export const SNIPPET_KEYS = [
  'name',
  'reference',
  'type',
  'raw',
  'private',
  'comment',
  'metatype',
  'schema',
  'method',
  'customPath',
  'secret',
  'enable',
] as const

const reference = optional(Options.text('reference'))
const type = optional(Options.choice('type', SNIPPET_TYPES))
const file = optional(Options.text('file'))
const raw = optional(Options.text('raw'))
const comment = optional(Options.text('comment'))
const method = optional(
  Options.choice('method', ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL']),
)
const metatype = optional(Options.text('metatype'))
const schema = optional(Options.text('schema'))
const customPath = optional(Options.text('custom-path'))
const secret = optional(Options.text('secret'))
const privateFlag = Options.boolean('private')
const enableFlag = Options.boolean('enable')
const noEnableFlag = Options.boolean('no-enable')

export const snippetWriteOptions = {
  reference,
  type,
  file,
  raw,
  comment,
  method,
  metatype,
  schema,
  customPath,
  secret,
  private: privateFlag,
  enable: enableFlag,
  noEnable: noEnableFlag,
}

export interface SnippetWriteOptionsParsed {
  readonly reference: Option.Option<string>
  readonly type: Option.Option<string>
  readonly file: Option.Option<string>
  readonly raw: Option.Option<string>
  readonly comment: Option.Option<string>
  readonly method: Option.Option<string>
  readonly metatype: Option.Option<string>
  readonly schema: Option.Option<string>
  readonly customPath: Option.Option<string>
  readonly secret: Option.Option<string>
  readonly private: boolean
  readonly enable: boolean
  readonly noEnable: boolean
}

export interface SnippetFlagInputs {
  readonly reference?: string
  readonly type?: string
  readonly file?: string
  readonly raw?: string
  readonly comment?: string
  readonly method?: string
  readonly metatype?: string
  readonly schema?: string
  readonly customPath?: string
  readonly secret?: string
  readonly private?: boolean
  readonly enable?: boolean
}

export const toSnippetFlagInputs = (
  opts: SnippetWriteOptionsParsed,
): SnippetFlagInputs => ({
  reference: unwrap(opts.reference),
  type: unwrap(opts.type),
  file: unwrap(opts.file),
  raw: unwrap(opts.raw),
  comment: unwrap(opts.comment),
  method: unwrap(opts.method),
  metatype: unwrap(opts.metatype),
  schema: unwrap(opts.schema),
  customPath: unwrap(opts.customPath),
  secret: unwrap(opts.secret),
  private: opts.private ? true : undefined,
  enable: opts.enable ? true : opts.noEnable ? false : undefined,
})

export const snippetFieldsOf = (
  flags: SnippetFlagInputs,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  if (flags.reference !== undefined) out.reference = flags.reference
  if (flags.type !== undefined) out.type = flags.type
  if (flags.comment !== undefined) out.comment = flags.comment
  if (flags.method !== undefined) out.method = flags.method
  if (flags.metatype !== undefined) out.metatype = flags.metatype
  if (flags.schema !== undefined) out.schema = flags.schema
  if (flags.customPath !== undefined) out.customPath = flags.customPath
  if (flags.secret !== undefined) out.secret = flags.secret
  if (flags.private !== undefined) out.private = flags.private
  if (flags.enable !== undefined) out.enable = flags.enable
  return out
}

export const resolveRawSource = (flags: {
  readonly file?: string
  readonly raw?: string
}): Effect.Effect<string | undefined, ValidationFailed | Generic, Editor> =>
  Effect.gen(function* () {
    if (flags.file !== undefined) {
      const editor = yield* Editor
      return yield* editor.readFileOrStdin(flags.file)
    }
    if (flags.raw !== undefined) return flags.raw
    if (!process.stdin.isTTY) {
      const editor = yield* Editor
      const piped = yield* editor.readFileOrStdin(undefined)
      return piped.trim() ? piped : undefined
    }
    return undefined
  })

export const unwrapDoc = (res: unknown): Record<string, unknown> => {
  if (!res || typeof res !== 'object') return {}
  const r = res as Record<string, unknown>
  if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
    return r.data as Record<string, unknown>
  }
  return r
}

export const pickSnippetFields = (
  doc: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const key of SNIPPET_KEYS) {
    if (key in doc && doc[key] !== undefined) out[key] = doc[key]
  }
  return out
}

const EXT_BY_TYPE: Record<string, string> = {
  json: 'json',
  json5: 'json5',
  function: 'js',
  yaml: 'yaml',
  text: 'txt',
}

export const extForType = (type: unknown): string =>
  (typeof type === 'string' && EXT_BY_TYPE[type]) || 'txt'
