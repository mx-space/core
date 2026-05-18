import { Command, Options } from '@effect/cli'
import { Effect } from 'effect'

import { Comment } from '../../services/Comment'
import { Renderer } from '../../services/Renderer'
import { unwrapOption } from './_flags'
import { commentListView } from './view'

// Convenience alias for `mxs comment list --state unread`. Accepts only the
// paging knobs — state is fixed, and `--all` is intentionally omitted (would
// defeat the purpose of the alias).
const page = Options.integer('page').pipe(Options.optional)
const size = Options.integer('size').pipe(Options.optional)

export const unread = Command.make('unread', { page, size }, ({ page, size }) =>
  Effect.gen(function* () {
    const comment = yield* Comment
    const renderer = yield* Renderer
    const res = yield* comment.list({
      page: unwrapOption(page),
      size: unwrapOption(size),
      state: 'unread',
    })
    yield* renderer.emit(commentListView, res)
  }),
).pipe(
  Command.withDescription(
    'list unread comments (alias for `comment list --state unread`)',
  ),
)
