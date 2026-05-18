import { Args, Command, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import { ValidationFailed } from '../../domain/errors'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'

const key = Args.text({ name: 'key' })
const value = Args.text({ name: 'value' })
const type_ = Options.choice('type', [
  'json',
  'string',
  'number',
  'bool',
] as const).pipe(Options.optional)

type CoerceType = 'json' | 'string' | 'number' | 'bool'

const coerce = (
  raw: string,
  type: CoerceType | undefined,
): Effect.Effect<unknown, ValidationFailed> => {
  if (type === 'string') return Effect.succeed(raw)
  if (type === 'number') {
    const n = Number(raw)
    if (Number.isNaN(n)) {
      return Effect.fail(
        new ValidationFailed({ message: `invalid number: ${raw}` }),
      )
    }
    return Effect.succeed(n)
  }
  if (type === 'bool') return Effect.succeed(raw === 'true')
  // json | undefined → try JSON.parse; on failure fall back to raw string when
  // type was not explicitly 'json', else fail.
  try {
    return Effect.succeed(JSON.parse(raw))
  } catch {
    if (type === 'json') {
      return Effect.fail(
        new ValidationFailed({ message: `invalid JSON: ${raw}` }),
      )
    }
    return Effect.succeed(raw)
  }
}

export const set = Command.make(
  'set',
  { key, value, type: type_ },
  ({ key, value, type }) =>
    Effect.gen(function* () {
      const t = Option.getOrUndefined(type) as CoerceType | undefined
      const coerced = yield* coerce(value, t)
      const api = yield* Api
      const renderer = yield* Renderer
      const res = yield* api.request(`/options/${encodeURIComponent(key)}`, {
        method: 'PATCH',
        body: coerced,
      })
      yield* renderer.emitSuccess(res)
    }),
)
