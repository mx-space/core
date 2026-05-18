import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { Comment } from '../../services/Comment'
import { Renderer } from '../../services/Renderer'
import { commentView } from './view'

const id = Args.text({ name: 'id' })

export const get = Command.make('get', { id }, ({ id }) =>
  Effect.gen(function* () {
    const comment = yield* Comment
    const renderer = yield* Renderer
    const res = yield* comment.get(id)
    yield* renderer.emit(commentView, res)
  }),
).pipe(Command.withDescription('show a single comment by id'))
