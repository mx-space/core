import { Command } from '@effect/cli'
import { Effect } from 'effect'

import { ValidationFailed } from '../../domain/errors'
import { Api } from '../../services/Api'
import { Editor } from '../../services/Editor'
import { Renderer } from '../../services/Renderer'

export const edit = Command.make('edit', {}, () =>
  Effect.gen(function* () {
    const api = yield* Api
    const editor = yield* Editor
    const renderer = yield* Renderer

    const current = yield* api.request<Record<string, unknown>>('/options')
    const initial = JSON.stringify(current ?? {}, null, 2)
    const next = yield* editor.openEditor({
      filename: 'mxs-config.json',
      initialContent: initial,
    })

    if (next.trim() === initial.trim()) {
      yield* renderer.emitInfo('no changes')
      return
    }

    const parsed = yield* Effect.try({
      try: () => JSON.parse(next) as Record<string, unknown>,
      catch: (err) =>
        new ValidationFailed({
          message: `invalid JSON: ${(err as Error)?.message ?? String(err)}`,
        }),
    })

    const results: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(parsed)) {
      const r = yield* api.request(`/options/${encodeURIComponent(k)}`, {
        method: 'PATCH',
        body: v,
      })
      results[k] = r
    }
    yield* renderer.emitSuccess(results)
  }),
)
