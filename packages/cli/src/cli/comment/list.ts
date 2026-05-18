import { Command, Options } from '@effect/cli'
import { Effect } from 'effect'

import { Comment } from '../../services/Comment'
import { Renderer } from '../../services/Renderer'
import { stateFilter, unwrapOption } from './_flags'
import { commentListView } from './view'

const page = Options.integer('page').pipe(Options.optional)
const size = Options.integer('size').pipe(Options.optional)
const allFlag = Options.boolean('all').pipe(
  Options.withDescription(
    'list comments across every state (ignores --state)',
  ),
)

export const list = Command.make(
  'list',
  { page, size, state: stateFilter, all: allFlag },
  ({ page, size, state, all }) =>
    Effect.gen(function* () {
      const comment = yield* Comment
      const renderer = yield* Renderer
      const res = yield* comment.list({
        page: unwrapOption(page),
        size: unwrapOption(size),
        state: unwrapOption(state),
        all,
      })
      yield* renderer.emit(commentListView, res)
    }),
).pipe(
  Command.withDescription(
    'list comments (default state: unread; use --all for every state)',
  ),
)
