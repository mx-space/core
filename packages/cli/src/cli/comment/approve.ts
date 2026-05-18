import { Command } from '@effect/cli'
import { Effect } from 'effect'

import { Comment } from '../../services/Comment'
import { Renderer } from '../../services/Renderer'
import {
  all,
  force,
  ids,
  stateFilter,
  unwrapOption,
  validateBatchSelection,
} from './_flags'

export const approve = Command.make(
  'approve',
  { ids, all, force, state: stateFilter },
  ({ ids, all, force, state }) =>
    Effect.gen(function* () {
      yield* validateBatchSelection({ verb: 'approve', ids, all, force })
      const comment = yield* Comment
      const renderer = yield* Renderer
      if (all) {
        yield* comment.approveAll({
          currentState: unwrapOption(state),
        })
        yield* renderer.emitSuccess({
          approved: 'all',
          filter: { currentState: unwrapOption(state) ?? null },
        })
      } else {
        yield* comment.approve(ids)
        yield* renderer.emitSuccess({ approved: ids })
      }
    }),
).pipe(
  Command.withDescription(
    'mark comments as read; pass ids or --all [--state <s>]',
  ),
)
