import { Effect } from 'effect'
import { Command, Flag } from 'effect/cli'

import { Comment } from '../../services/Comment'
import { Renderer } from '../../services/Renderer'
import { stateFilter, unwrapOption } from './_flags'
import { commentListView } from './view'

const page = Flag.Int('page').pipe(Flag.optional)
const size = Flag.Int('size').pipe(Flag.optional)
const allFlag = Flag.Boolean('all').pipe(
  Flag.withDefault(false),
  Flag.withDescription('list comments across every state (ignores --state)'),
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
