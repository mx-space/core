import { Cause, Effect, Exit, FileSystem, Option } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'
import open from 'open'

import { Generic, ValidationXml } from '../../domain/errors'
import { Lexical, type LexicalState } from '../../services/Lexical'
import { Renderer } from '../../services/Renderer'
import { registerCommandHelp } from '../help/registry'
import { openAuthorDocument } from './document'
import { nodeSessionFs } from './fs'
import {
  findCliPackageRoot,
  isAuthorSourceModule,
  pickAuthorPort,
  resolveAuthorSpaDir,
} from './paths'
import { startAuthorServer } from './server'
import { createAuthorSession } from './session'
import { watchAuthorFile } from './watch'

registerCommandHelp({
  name: 'author',
  description:
    'open a local admin editor for a LiteXML fragment or <mxpost>/<mxnote> envelope',
  isLeaf: true,
  skillChapter: 'commands-author',
  leafOptions: [
    {
      flag: '--port <n>',
      description:
        'listen on this port; fail if occupied. Default: first free port from 4173',
    },
    {
      flag: '--no-open',
      description: 'print the URL without opening a browser',
    },
    {
      flag: '--variant <article|note>',
      description:
        'editor variant for raw fragments; envelopes use the root tag',
    },
    {
      flag: '--base <file>',
      description:
        'pre-edit copy of <file>; changed blocks open as inline diff notes and the sidecar diff is taken against it',
    },
  ],
})

const fileArg = Argument.String('file')
const portOpt = Flag.Int('port').pipe(Flag.optional)
const noOpenOpt = Flag.Boolean('no-open').pipe(Flag.optional)
const variantOpt = Flag.Literals('variant', ['article', 'note']).pipe(
  Flag.optional,
)
const baseOpt = Flag.File('base').pipe(Flag.optional)

export const authorCmd = Command.make(
  'author',
  {
    file: fileArg,
    port: portOpt,
    noOpen: noOpenOpt,
    variant: variantOpt,
    base: baseOpt,
  },
  ({ file, port, noOpen, variant, base }) =>
    Effect.gen(function* () {
      const renderer = yield* Renderer
      const lexical = yield* Lexical
      const fs = yield* FileSystem.FileSystem

      if (file === '-' || file === '') {
        return yield* Effect.fail(
          new ValidationXml({
            message: 'mxs author requires a file path',
            hint: 'write the envelope to a file first, then `mxs author <file>`',
          }),
        )
      }

      const exists = yield* fs.exists(file)
      if (!exists) {
        return yield* Effect.fail(
          new Generic({
            message: `file not found: ${file}`,
          }),
        )
      }

      const readText = (path: string) =>
        fs.readFileString(path).pipe(
          Effect.mapError(
            (err) =>
              new Generic({
                message: `cannot read ${path}: ${err.message}`,
                cause: err,
              }),
          ),
        )
      const source = yield* readText(file)
      const basePath = Option.getOrUndefined(base)
      const baseSource =
        basePath === undefined ? undefined : yield* readText(basePath)

      const cliRoot = findCliPackageRoot(import.meta.url)
      if (!cliRoot) {
        return yield* Effect.fail(
          new Generic({ message: 'cannot resolve @mx-space/cli package root' }),
        )
      }

      const spaDir = resolveAuthorSpaDir(
        cliRoot,
        isAuthorSourceModule(import.meta.url),
      )
      const listenPort = yield* Effect.tryPromise({
        try: () => pickAuthorPort(Option.getOrUndefined(port)),
        catch: (err) =>
          err instanceof Generic
            ? err
            : new Generic({ message: String(err), cause: err }),
      })

      const doc = yield* Effect.try({
        try: () =>
          openAuthorDocument(file, source, Option.getOrUndefined(variant)),
        catch: (err) =>
          err instanceof ValidationXml
            ? err
            : new ValidationXml({
                message: err instanceof Error ? err.message : String(err),
                cause: err,
              }),
      })

      const runXml = <A>(eff: Effect.Effect<A, ValidationXml>): A => {
        const exit = Effect.runSyncExit(eff)
        if (Exit.isSuccess(exit)) return exit.value
        const err = Cause.squash(exit.cause)
        throw err instanceof Error ? err : new Error(String(err))
      }

      const baseLexical = yield* Effect.try({
        try: () => {
          const baseBody =
            basePath === undefined || baseSource === undefined
              ? undefined
              : openAuthorDocument(
                  basePath,
                  baseSource,
                  Option.getOrUndefined(variant),
                ).originalBody
          const parsed = runXml(
            lexical.litexmlToPayload(baseBody ?? doc.originalBody),
          )
          doc.originalBody = runXml(lexical.payloadToLitexml(parsed))
          return baseBody === undefined ? undefined : parsed
        },
        catch: (err) =>
          err instanceof ValidationXml
            ? err
            : new ValidationXml({
                message: err instanceof Error ? err.message : String(err),
                cause: err,
              }),
      })

      const log = (line: string) => Effect.runSync(renderer.emitInfo(line))
      const toGeneric = (err: unknown) =>
        new Generic({
          message: err instanceof Error ? err.message : String(err),
          cause: err,
        })

      const session = yield* Effect.tryPromise({
        try: () =>
          createAuthorSession({
            doc,
            fs: nodeSessionFs,
            base: baseLexical,
            log,
            codec: {
              litexmlToLexical: (xml) => runXml(lexical.litexmlToPayload(xml)),
              lexicalToLitexml: (state) =>
                runXml(lexical.payloadToLitexml(state as LexicalState)),
            },
          }),
        catch: toGeneric,
      })

      const server = yield* Effect.tryPromise({
        try: () =>
          startAuthorServer({ doc, session, spaDir, port: listenPort, log }),
        catch: toGeneric,
      })

      const watcher = watchAuthorFile(file, session.onFileText)

      const url = `http://127.0.0.1:${server.port}`
      yield* renderer.emitInfo(`mxs author ${url}`)
      yield* renderer.emitInfo(
        `edits autosave to ${file} (+ .diff); history in ${file}.loro`,
      )

      if (!Option.getOrElse(noOpen, () => false)) {
        yield* Effect.promise(() => open(url))
      }

      yield* Effect.callback<void, Generic>((resume) => {
        const stop = () => {
          watcher.close()
          void Promise.all([server.close(), session.close()]).then(
            () => resume(Effect.void),
            (err) =>
              resume(
                Effect.fail(
                  new Generic({
                    message: err instanceof Error ? err.message : String(err),
                    cause: err,
                  }),
                ),
              ),
          )
        }
        process.once('SIGINT', stop)
        process.once('SIGTERM', stop)
        process.once('SIGHUP', stop)
      })
    }),
)
