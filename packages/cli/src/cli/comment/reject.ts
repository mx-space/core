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

export const reject = Command.make(
  'reject',
  { ids, all, force, state: stateFilter },
  ({ ids, all, force, state }) =>
    Effect.gen(function* () {
      yield* validateBatchSelection({ verb: 'reject', ids, all, force })
      const comment = yield* Comment
      const renderer = yield* Renderer
      if (all) {
        yield* comment.rejectAll({
          currentState: unwrapOption(state),
        })
        yield* renderer.emitSuccess({
          rejected: 'all',
          filter: { currentState: unwrapOption(state) ?? null },
        })
      } else {
        yield* comment.reject(ids)
        yield* renderer.emitSuccess({ rejected: ids })
      }
    }),
).pipe(
  Command.withDescription(
    'mark comments as junk; pass ids or --all [--state <s>]',
  ),
)
