import { FileSystem, Path } from '@effect/platform'
import { Effect } from 'effect'

import { ValidationFailed } from './errors'

export interface ContentSource {
  readonly text: string
  readonly origin: 'inline' | 'file' | 'stdin'
  readonly path?: string
}

const messageOf = (err: unknown): string => {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return String(err)
}

/**
 * Resolve a content spec — one of:
 *  - `undefined` → returns `null`
 *  - `"-"` or `"stdin"` → reads stdin
 *  - `"file=<path>"` → reads that file (relative to cwd)
 *  - any other value → inline literal
 */
export const readContentSpec = (
  spec: string | undefined,
  opts: { readonly cwd?: string } = {},
): Effect.Effect<
  ContentSource | null,
  ValidationFailed,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    if (spec === undefined) return null
    if (spec === '-' || spec === 'stdin') {
      const text = yield* readStdin
      return { text, origin: 'stdin' as const }
    }
    if (spec.startsWith('file=')) {
      const path = yield* Path.Path
      const fs = yield* FileSystem.FileSystem
      const p = path.resolve(
        opts.cwd ?? process.cwd(),
        spec.slice('file='.length),
      )
      const text = yield* fs.readFileString(p).pipe(
        Effect.mapError(
          (err) =>
            new ValidationFailed({
              message: `failed to read ${p}: ${messageOf(err)}`,
            }),
        ),
      )
      return { text, origin: 'file' as const, path: p }
    }
    return { text: spec, origin: 'inline' as const }
  })

export const readJsonSpec = (
  spec: string | undefined,
): Effect.Effect<
  unknown,
  ValidationFailed,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    if (spec === undefined) return undefined
    if (spec.startsWith('file=')) {
      const path = yield* Path.Path
      const fs = yield* FileSystem.FileSystem
      const p = path.resolve(process.cwd(), spec.slice('file='.length))
      const text = yield* fs.readFileString(p).pipe(
        Effect.mapError(
          (err) =>
            new ValidationFailed({
              message: `failed to read JSON from ${p}: ${messageOf(err)}`,
            }),
        ),
      )
      return yield* Effect.try({
        try: () => JSON.parse(text),
        catch: (err) =>
          new ValidationFailed({
            message: `failed to parse JSON: ${messageOf(err)}`,
          }),
      })
    }
    return yield* Effect.try({
      try: () => JSON.parse(spec),
      catch: (err) =>
        new ValidationFailed({
          message: `failed to parse JSON: ${messageOf(err)}`,
        }),
    })
  })

export const readStdin: Effect.Effect<string, ValidationFailed> = Effect.gen(
  function* () {
    if (process.stdin.isTTY) {
      return yield* Effect.fail(
        new ValidationFailed({
          message: 'requested stdin content but stdin is a TTY',
        }),
      )
    }
    return yield* Effect.tryPromise({
      try: async () => {
        const chunks: Buffer[] = []
        for await (const chunk of process.stdin) {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
        }
        return Buffer.concat(chunks).toString('utf8')
      },
      catch: (err) =>
        new ValidationFailed({
          message: `failed to read stdin: ${messageOf(err)}`,
        }),
    })
  },
)
