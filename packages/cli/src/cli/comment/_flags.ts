import { Args, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import { ValidationFailed } from '../../domain/errors'
import type { CommentStateName } from '../../services/Comment'

export const ids = Args.text({ name: 'id' }).pipe(Args.repeated)

export const all = Options.boolean('all').pipe(
  Options.withDescription(
    'apply to every comment (optionally filtered by --state)',
  ),
)

export const force = Options.boolean('force').pipe(
  Options.withDescription('skip TTY confirmation guard'),
)

export const stateFilter = Options.choice('state', [
  'unread',
  'read',
  'junk',
]).pipe(Options.optional)

export const unwrapOption = <A>(value: Option.Option<A>): A | undefined =>
  Option.getOrUndefined(value)

/**
 * Shared invariants for ids/--all batch verbs (`approve`, `reject`, `delete`).
 *
 *   - exactly one of `ids` (>= 1) or `--all` MUST be supplied
 *   - `--all` in a non-TTY context requires `--force`
 *   - additional guards (e.g. single-id `delete`) are applied per-verb
 */
export const validateBatchSelection = (params: {
  readonly verb: 'approve' | 'reject' | 'delete'
  readonly ids: ReadonlyArray<string>
  readonly all: boolean
  readonly force: boolean
}): Effect.Effect<void, ValidationFailed> =>
  Effect.suspend(() => {
    if (params.all && params.ids.length > 0) {
      return Effect.fail(
        new ValidationFailed({
          message: '--all cannot be combined with explicit ids',
        }),
      )
    }
    if (!params.all && params.ids.length === 0) {
      return Effect.fail(
        new ValidationFailed({
          message: `${params.verb} requires at least one id or --all`,
        }),
      )
    }
    if (params.all && !params.force && !process.stdin.isTTY) {
      return Effect.fail(
        new ValidationFailed({
          message: `refusing to ${params.verb} --all without --force in non-TTY context`,
        }),
      )
    }
    return Effect.void
  })

export const requireForceForSingleDelete = (params: {
  readonly ids: ReadonlyArray<string>
  readonly all: boolean
  readonly force: boolean
}): Effect.Effect<void, ValidationFailed> =>
  Effect.suspend(() => {
    if (params.all) return Effect.void
    if (params.force) return Effect.void
    if (process.stdin.isTTY) return Effect.void
    return Effect.fail(
      new ValidationFailed({
        message: 'refusing to delete without --force in non-TTY context',
      }),
    )
  })

export type CurrentStateFilter = CommentStateName | undefined
