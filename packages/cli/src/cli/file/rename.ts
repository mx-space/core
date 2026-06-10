import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { typeOption } from './_shared'

const name = Args.text({ name: 'name' })
const newName = Args.text({ name: 'newName' })

export const rename = Command.make(
  'rename',
  { name, newName, type: typeOption },
  ({ name, newName, type }) =>
    Effect.gen(function* () {
      const api = yield* Api
      const renderer = yield* Renderer
      yield* api.request(
        `/objects/${type}/${encodeURIComponent(name)}/rename`,
        {
          method: 'PATCH',
          query: { newName },
        },
      )
      yield* renderer.emitSuccess({ renamed: `${type}/${name}`, to: newName })
    }),
).pipe(Command.withDescription('rename an uploaded file'))
