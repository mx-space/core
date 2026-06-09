import { Options } from '@effect/cli'
import { FileSystem } from '@effect/platform'
import { Effect, Option } from 'effect'

import { ValidationFailed } from '../../domain/errors'

const optional = <A>(self: Options.Options<A>) => Options.optional(self)
const unwrap = <A>(value: Option.Option<A>): A | undefined =>
  Option.getOrUndefined(value)

export const name = optional(Options.text('name'))
export const description = optional(Options.text('description'))
export const previewUrl = optional(Options.text('preview-url'))
export const docUrl = optional(Options.text('doc-url'))
export const projectUrl = optional(Options.text('project-url'))
export const avatar = optional(Options.text('avatar'))
export const images = optional(Options.text('images'))
export const text = optional(Options.text('text'))
export const file = optional(Options.text('file'))

export const openFlag = Options.boolean('open').pipe(
  Options.withDescription(
    'After success, open the admin edit page in the default browser.',
  ),
)
export const silentFlag = Options.boolean('silent').pipe(
  Options.withDescription(
    'On success, emit a minimal `ok` instead of the full server response.',
  ),
)

const parseCsv = (v: string | undefined): string[] | undefined => {
  if (v === undefined) return undefined
  const parts = v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return parts
}

export const projectWriteOptions = {
  name,
  description,
  previewUrl,
  docUrl,
  projectUrl,
  avatar,
  images,
  text,
  file,
  open: openFlag,
  silent: silentFlag,
}

export interface ProjectWriteOptionsParsed {
  readonly name: Option.Option<string>
  readonly description: Option.Option<string>
  readonly previewUrl: Option.Option<string>
  readonly docUrl: Option.Option<string>
  readonly projectUrl: Option.Option<string>
  readonly avatar: Option.Option<string>
  readonly images: Option.Option<string>
  readonly text: Option.Option<string>
  readonly file: Option.Option<string>
  readonly open: boolean
  readonly silent: boolean
}

export interface ProjectFlagInputs {
  readonly name?: string
  readonly description?: string
  readonly previewUrl?: string | null
  readonly docUrl?: string | null
  readonly projectUrl?: string | null
  readonly avatar?: string | null
  readonly images?: string[] | null
  readonly text?: string | null
  readonly file?: string
}

export const toProjectFlagInputs = (
  opts: ProjectWriteOptionsParsed,
): ProjectFlagInputs => ({
  name: unwrap(opts.name),
  description: unwrap(opts.description),
  previewUrl: unwrap(opts.previewUrl),
  docUrl: unwrap(opts.docUrl),
  projectUrl: unwrap(opts.projectUrl),
  avatar: unwrap(opts.avatar),
  images: parseCsv(unwrap(opts.images)),
  text: unwrap(opts.text),
  file: unwrap(opts.file),
})

const PROJECT_KEYS = [
  'name',
  'description',
  'previewUrl',
  'docUrl',
  'projectUrl',
  'avatar',
  'images',
  'text',
] as const

const readJsonFile = (
  path: string,
): Effect.Effect<
  Record<string, unknown>,
  ValidationFailed,
  FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const raw = yield* fs.readFileString(path).pipe(
      Effect.mapError(
        (cause) =>
          new ValidationFailed({
            message: `cannot read --file ${path}`,
            details: { cause: String(cause) },
          }),
      ),
    )
    const parsed = yield* Effect.try({
      try: () => JSON.parse(raw) as unknown,
      catch: (err) =>
        new ValidationFailed({
          message: `--file ${path} is not valid JSON`,
          details: { cause: String(err) },
        }),
    })
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return yield* Effect.fail(
        new ValidationFailed({
          message: `--file ${path} must contain a JSON object`,
        }),
      )
    }
    return parsed as Record<string, unknown>
  })

const pickProjectFields = (
  raw: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const key of PROJECT_KEYS) {
    if (key in raw) out[key] = raw[key]
  }
  return out
}

export const buildProjectPayload = (
  flags: ProjectFlagInputs,
): Effect.Effect<
  Record<string, unknown>,
  ValidationFailed,
  FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const fileMerge: Record<string, unknown> = flags.file
      ? pickProjectFields(yield* readJsonFile(flags.file))
      : {}
    const payload: Record<string, unknown> = { ...fileMerge }
    if (flags.name !== undefined) payload.name = flags.name
    if (flags.description !== undefined) payload.description = flags.description
    if (flags.previewUrl !== undefined) payload.previewUrl = flags.previewUrl
    if (flags.docUrl !== undefined) payload.docUrl = flags.docUrl
    if (flags.projectUrl !== undefined) payload.projectUrl = flags.projectUrl
    if (flags.avatar !== undefined) payload.avatar = flags.avatar
    if (flags.images !== undefined) payload.images = flags.images
    if (flags.text !== undefined) payload.text = flags.text
    return payload
  })

export const extractId = (res: unknown): string | undefined => {
  if (!res || typeof res !== 'object') return undefined
  const r = res as Record<string, unknown>
  if (typeof r.id === 'string') return r.id
  if (typeof r._id === 'string') return r._id
  return undefined
}

export const editableFieldsOf = (
  raw: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const key of PROJECT_KEYS) {
    out[key] = key in raw ? (raw[key] ?? null) : null
  }
  return out
}
