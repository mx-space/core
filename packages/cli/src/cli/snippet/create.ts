import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { ValidationFailed } from '../../domain/errors'
import { Api } from '../../services/Api'
import { Editor } from '../../services/Editor'
import { Renderer } from '../../services/Renderer'
import {
  extForType,
  resolveRawSource,
  snippetFieldsOf,
  snippetWriteOptions,
  toSnippetFlagInputs,
} from './_flags'

const path = Args.text({ name: 'path' })

export const create = Command.make(
  'put',
  { path, ...snippetWriteOptions },
  ({ path, ...rest }) =>
    Effect.gen(function* () {
      const flags = toSnippetFlagInputs(rest)
      const api = yield* Api
      const renderer = yield* Renderer
      let raw = yield* resolveRawSource(flags, { implicitStdin: true })
      if (raw === undefined) {
        if (!process.stdin.isTTY) {
          return yield* Effect.fail(
            new ValidationFailed({
              message:
                'no snippet content provided; pass --file, --raw, or pipe stdin',
            }),
          )
        }
        const editor = yield* Editor
        raw = yield* editor.openEditor({
          filename: `snippet.${extForType(flags.type ?? 'json')}`,
          initialContent: '',
        })
      }
      if (!raw.trim()) {
        return yield* Effect.fail(
          new ValidationFailed({ message: 'snippet content is empty' }),
        )
      }
      const body = { ...snippetFieldsOf(flags), path, raw }
      const res = yield* api.request('/snippets/by-path', {
        method: 'PUT',
        body,
      })
      yield* renderer.emitSuccess(res)
    }),
).pipe(Command.withDescription('write a snippet by path'))
