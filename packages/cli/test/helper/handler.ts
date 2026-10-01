import type { Effect } from 'effect'
import type { Command } from 'effect/cli'

type Handle<Input, E, R> = {
  readonly handle: (
    input: Input,
    commandPath: ReadonlyArray<string>,
  ) => Effect.Effect<void, E, R>
}

// effect/cli v4 keeps the handler on the internal command impl only.
export const handler =
  <Name extends string, Input, ContextInput, E, R>(
    cmd: Command.Command<Name, Input, ContextInput, E, R>,
  ) =>
  (input: Input): Effect.Effect<void, E, R> =>
    (cmd as unknown as Handle<Input, E, R>).handle(input, [cmd.name])
