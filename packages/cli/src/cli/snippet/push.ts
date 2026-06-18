import fs from 'node:fs/promises'

import { Args, Command, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { SNIPPET_TYPES } from './_flags'
import { detectSnippetType, toRemotePath, walkTextFiles } from './_sync'

const localDir = Args.text({ name: 'localDir' })
const remotePrefix = Args.text({ name: 'remotePrefix' })
const dryRun = Options.boolean('dry-run')
const forceType = Options.choice('type', SNIPPET_TYPES).pipe(Options.optional)

export const push = Command.make(
  'push',
  { localDir, remotePrefix, dryRun, forceType },
  ({ localDir, remotePrefix, dryRun, forceType }) =>
    Effect.gen(function* () {
      const api = yield* Api
      const renderer = yield* Renderer
      const files = yield* Effect.tryPromise(() => walkTextFiles(localDir))
      const typeOverride = Option.getOrUndefined(forceType)
      const planned: Array<{ local: string; remote: string; type: string }> = []

      for (const file of files) {
        const raw = yield* Effect.tryPromise(() => fs.readFile(file, 'utf8'))
        const remote = toRemotePath(remotePrefix, localDir, file)
        const type = typeOverride ?? detectSnippetType(remote, raw)
        planned.push({ local: file, remote, type })
        if (!dryRun) {
          yield* api.request('/snippets/by-path', {
            method: 'PUT',
            body: { path: remote, raw, type },
          })
        }
      }

      yield* renderer.emitSuccess({ dryRun, pushed: planned })
    }),
).pipe(Command.withDescription('push a local directory into snippet VFS'))
