import fs from 'node:fs/promises'
import path from 'node:path'

import { Args, Command, Options } from '@effect/cli'
import { Effect } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { toLocalPath } from './_sync'

const remotePrefix = Args.text({ name: 'remotePrefix' })
const localDir = Args.text({ name: 'localDir' })
const dryRun = Options.boolean('dry-run')

export const pull = Command.make(
  'pull',
  { remotePrefix, localDir, dryRun },
  ({ remotePrefix, localDir, dryRun }) =>
    Effect.gen(function* () {
      const api = yield* Api
      const renderer = yield* Renderer
      const list = (yield* api.request('/snippets', {
        query: { prefix: remotePrefix, recursive: true, limit: 1000 },
      })) as any
      const objects = (list?.data?.objects ?? list?.objects ?? []) as Array<{
        path: string
      }>
      const planned: Array<{ remote: string; local: string }> = []

      for (const object of objects) {
        const detail = (yield* api.request('/snippets/by-path', {
          query: { path: object.path },
        })) as any
        const row = detail?.data ?? detail
        const raw = typeof row?.raw === 'string' ? row.raw : ''
        const local = toLocalPath(localDir, remotePrefix, object.path)
        planned.push({ remote: object.path, local })
        if (!dryRun) {
          yield* Effect.tryPromise(() =>
            fs.mkdir(path.dirname(local), { recursive: true }),
          )
          yield* Effect.tryPromise(() => fs.writeFile(local, raw, 'utf8'))
        }
      }

      yield* renderer.emitSuccess({ dryRun, pulled: planned })
    }),
).pipe(
  Command.withDescription('pull a snippet VFS prefix into a local directory'),
)
