import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { Api } from '../../services/Api'
import { Editor } from '../../services/Editor'
import { Renderer } from '../../services/Renderer'
import { extForType, pickSnippetFields, unwrapDoc } from './_flags'
import { resolveSnippetId } from './_resolve'

const target = Args.text({ name: 'idOrRefName' })

export const edit = Command.make('edit', { target }, ({ target }) =>
  Effect.gen(function* () {
    const api = yield* Api
    const editor = yield* Editor
    const renderer = yield* Renderer
    const id = yield* resolveSnippetId(api, target)
    const current = unwrapDoc(yield* api.request(`/snippets/${id}`))
    const initial = typeof current.raw === 'string' ? current.raw : ''
    const next = yield* editor.openEditor({
      filename: `snippet-${id}.${extForType(current.type)}`,
      initialContent: initial,
    })
    if (next.trim() === initial.trim()) {
      yield* renderer.emitInfo('no changes')
      return
    }
    const body = { ...pickSnippetFields(current), raw: next }
    const res = yield* api.request(`/snippets/${id}`, {
      method: 'PUT',
      body,
    })
    yield* renderer.emitSuccess(res)
  }),
).pipe(Command.withDescription('edit snippet content via $EDITOR'))
