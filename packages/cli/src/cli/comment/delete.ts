import { Command } from '@effect/cli'
import { Effect } from 'effect'

import { Comment } from '../../services/Comment'
import { Renderer } from '../../services/Renderer'
import {
  all,
  force,
  ids,
  requireForceForSingleDelete,
  stateFilter,
  unwrapOption,
  validateBatchSelection,
} from './_flags'

export const del = Command.make(
  'delete',
  { ids, all, force, state: stateFilter },
  ({ ids, all, force, state }) =>
    Effect.gen(function* () {
      yield* validateBatchSelection({ verb: 'delete', ids, all, force })
      yield* requireForceForSingleDelete({ ids, all, force })
      const comment = yield* Comment
      const renderer = yield* Renderer
      if (all) {
        yield* comment.deleteAll({
          currentState: unwrapOption(state),
        })
        yield* renderer.emitSuccess({
          deleted: 'all',
          filter: { currentState: unwrapOption(state) ?? null },
        })
      } else {
        yield* comment.delete(ids)
        yield* renderer.emitSuccess({ deleted: ids })
      }
    }),
).pipe(
  Command.withDescription(
    'soft-delete comments; pass ids or --all [--state <s>]',
  ),
)
