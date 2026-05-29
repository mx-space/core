import { Args, Command, Options } from '@effect/cli'
import { Effect } from 'effect'

import { readContentSpec } from '../../domain/content-spec'
import { ValidationFailed } from '../../domain/errors'
import { Comment } from '../../services/Comment'
import { Renderer } from '../../services/Renderer'
import { unwrapOption } from './_flags'

const id = Args.text({ name: 'id' })

const text = Options.text('text').pipe(
  Options.withDescription(
    'reply text — inline literal, `file=<path>`, or `-`/`stdin` to read stdin',
  ),
  Options.optional,
)

const whispers = Options.boolean('whispers').pipe(
  Options.withDescription('mark this reply as whispers (owner-only visible)'),
)

const silent = Options.boolean('silent').pipe(
  Options.withDescription(
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
