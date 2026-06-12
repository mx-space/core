import { Args, Command, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import {
  pickSnippetFields,
  resolveRawSource,
  snippetFieldsOf,
  snippetWriteOptions,
  toSnippetFlagInputs,
  unwrapDoc,
} from './_flags'
import { resolveSnippetId } from './_resolve'

const target = Args.text({ name: 'idOrRefName' })
const name = Options.text('name').pipe(Options.optional)

export const update = Command.make(
  'update',
  { target, name, ...snippetWriteOptions },
  ({ target, name, ...rest }) =>
    Effect.gen(function* () {
      const flags = toSnippetFlagInputs(rest)
      const api = yield* Api
      const renderer = yield* Renderer
      const id = yield* resolveSnippetId(api, target)
      const current = pickSnippetFields(
        unwrapDoc(yield* api.request(`/snippets/${id}`)),
      )
      const raw = yield* resolveRawSource(flags, { implicitStdin: false })
      const body: Record<string, unknown> = {
        ...current,
        ...snippetFieldsOf(flags),
      }
      const n = Option.getOrUndefined(name)
      if (n !== undefined) body.name = n
      if (raw !== undefined) body.raw = raw
      const res = yield* api.request(`/snippets/${id}`, {
        method: 'PUT',
        body,
      })
      yield* renderer.emitSuccess(res)
    }),
).pipe(Command.withDescription('update a snippet'))
