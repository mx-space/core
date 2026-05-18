import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'

import * as Clack from '@clack/prompts'
import { FileSystem } from '@effect/platform'
import { Context, Effect, Layer } from 'effect'

import { Generic, ValidationFailed } from '../domain/errors'

export interface EditorRoundTrip {
  readonly filename: string
  readonly initialContent: string
  readonly editor?: string
}

export interface EditorService {
  /** Spawn `$EDITOR` against a tmp file seeded with `initialContent`. */
  readonly openEditor: (opts: EditorRoundTrip) => Effect.Effect<string, Generic>
  /** Prompt for free-form input. */
  readonly prompt: (
    message: string,
    opts?: { readonly initialValue?: string; readonly placeholder?: string },
  ) => Effect.Effect<string, Generic>
  /** Yes/no confirmation. */
  readonly confirm: (
    message: string,
    opts?: { readonly initialValue?: boolean },
  ) => Effect.Effect<boolean, Generic>
  /** Read a file path or stdin (`-` or no path). */
  readonly readFileOrStdin: (
    path: string | undefined,
  ) => Effect.Effect<string, ValidationFailed | Generic>
}

const messageOf = (err: unknown): string => {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return String(err)
}

const spawnInteractive = (cmd: string, args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`editor exited with code ${code}`))
    })
  })

const readStdinAll = (): Promise<string> =>
  new Promise((resolve, reject) => {
    const stdin = process.stdin
    const chunks: Buffer[] = []
    stdin.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    })
    stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    stdin.on('error', reject)
    if (stdin.isPaused?.()) stdin.resume()
  })

const makeService = (fs: FileSystem.FileSystem): EditorService => ({
  openEditor: (opts) =>
    Effect.tryPromise({
      try: async () => {
        const editor = opts.editor ?? process.env.EDITOR ?? process.env.VISUAL
        if (!editor) {
          throw new Error(
            '$EDITOR not set; export EDITOR=vim (or another editor) and try again',
          )
        }
        const dir = await new Promise<string>((resolve, reject) =>
          import('node:fs').then(({ promises }) =>
            promises
              .mkdtemp(path.join(os.tmpdir(), 'mxs-'))
              .then(resolve, reject),
          ),
        )
        const tmpPath = path.join(dir, opts.filename)
        const nodeFs = await import('node:fs')
        await nodeFs.promises.writeFile(tmpPath, opts.initialContent, 'utf8')
        await spawnInteractive(editor, [tmpPath])
        const next = await nodeFs.promises.readFile(tmpPath, 'utf8')
        await nodeFs.promises.unlink(tmpPath).catch(() => undefined)
        await nodeFs.promises.rmdir(dir).catch(() => undefined)
        return next
      },
      catch: (err) => new Generic({ message: messageOf(err), cause: err }),
    }),

  prompt: (message, opts) =>
    Effect.tryPromise({
      try: () =>
        Clack.text({
          message,
          initialValue: opts?.initialValue,
          placeholder: opts?.placeholder,
        }) as Promise<string | symbol>,
      catch: (err) => new Generic({ message: messageOf(err), cause: err }),
    }).pipe(
      Effect.flatMap((value) =>
        Clack.isCancel(value)
          ? Effect.fail(new Generic({ message: 'cancelled by user' }))
          : Effect.succeed(value as string),
      ),
    ),

  confirm: (message, opts) =>
    Effect.tryPromise({
      try: () =>
        Clack.confirm({
          message,
          initialValue: opts?.initialValue,
        }) as Promise<boolean | symbol>,
      catch: (err) => new Generic({ message: messageOf(err), cause: err }),
    }).pipe(
      Effect.flatMap((value) =>
        Clack.isCancel(value)
          ? Effect.fail(new Generic({ message: 'cancelled by user' }))
          : Effect.succeed(value as boolean),
      ),
    ),

  readFileOrStdin: (p) => {
    if (p === undefined || p === '-' || p === '') {
      return Effect.tryPromise({
        try: () => readStdinAll(),
        catch: (err) =>
          new ValidationFailed({
            message: `failed to read stdin: ${messageOf(err)}`,
          }) as ValidationFailed | Generic,
      })
    }
    return fs.readFileString(p).pipe(
      Effect.mapError(
        (err) =>
          new ValidationFailed({
            message: `failed to read ${p}: ${messageOf(err)}`,
          }),
      ),
    )
  },
})

export class Editor extends Context.Tag('Editor')<Editor, EditorService>() {
  static Default: Layer.Layer<Editor, never, FileSystem.FileSystem> =
    Layer.effect(
      Editor,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        return makeService(fs)
      }),
    )
}
