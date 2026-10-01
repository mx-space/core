import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'

import { readContentSpec } from '../../domain/content-spec'
import { ValidationFailed } from '../../domain/errors'
import { Comment } from '../../services/Comment'
import { Renderer } from '../../services/Renderer'
import { unwrapOption } from './_flags'

const id = Argument.String('id')

const text = Flag.String('text').pipe(
  Flag.withDescription(
    'reply text — inline literal, `file=<path>`, or `-`/`stdin` to read stdin',
  ),
  Flag.optional,
)

const whispers = Flag.Boolean('whispers').pipe(
  Flag.withDefault(false),
  Flag.withDescription('mark this reply as whispers (owner-only visible)'),
)

const silent = Flag.Boolean('silent').pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    'on success, emit a minimal `ok` instead of the full server response',
  ),
)

export const reply = Command.make(
  'reply',
  { id, text, whispers, silent },
  ({ id, text, whispers, silent }) =>
    Effect.gen(function* () {
      const spec = unwrapOption(text)
      if (spec === undefined) {
        return yield* Effect.fail(
          new ValidationFailed({
            message:
              'reply requires --text (inline, `file=<path>`, or `-` for stdin)',
          }),
        )
      }
      const source = yield* readContentSpec(spec)
      const body = source?.text.trim() ?? ''
      if (body.length === 0) {
        return yield* Effect.fail(
          new ValidationFailed({ message: 'reply text must not be empty' }),
        )
      }
      const comment = yield* Comment
      const renderer = yield* Renderer
      const res = yield* comment.reply(id, {
        text: body,
        ...(whispers ? { isWhispers: true } : {}),
      })
      yield* renderer.emitSuccess(silent ? { ok: true } : res)
    }),
).pipe(
  Command.withDescription(
    'post an owner reply to a comment; pass --text inline, --text file=<path>, or --text -',
  ),
)
