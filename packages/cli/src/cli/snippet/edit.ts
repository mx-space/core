import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { Api } from '../../services/Api'
import { Editor } from '../../services/Editor'
import { Renderer } from '../../services/Renderer'
import { isSnowflakeId } from '../../services/Resolver'
import { extForType, pickSnippetFields, unwrapDoc } from './_flags'

const target = Args.text({ name: 'pathOrId' })

export const edit = Command.make('edit', { target }, ({ target }) =>
  Effect.gen(function* () {
    const api = yield* Api
    const editor = yield* Editor
    const renderer = yield* Renderer
    const current = unwrapDoc(
      yield* api.request(
        isSnowflakeId(target) ? `/snippets/${target}` : '/snippets/by-path',
        isSnowflakeId(target) ? undefined : { query: { path: target } },
      ),
    )
    const initial = typeof current.raw === 'string' ? current.raw : ''
    const next = yield* editor.openEditor({
      filename: `snippet.${extForType(current.type)}`,
      initialContent: initial,
    })
    if (next.trim() === initial.trim()) {
      yield* renderer.emitInfo('no changes')
      return
    }
    const body = { ...pickSnippetFields(current), raw: next }
    const res = yield* api.request(
      isSnowflakeId(target) ? `/snippets/${target}` : '/snippets/by-path',
      {
        method: 'PUT',
        body,
      },
    )
    yield* renderer.emitSuccess(res)
  }),
).pipe(Command.withDescription('edit snippet content via $EDITOR'))
