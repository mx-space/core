import { Args, Command, Options } from '@effect/cli'
import { FileSystem } from '@effect/platform'
import { Effect, Option } from 'effect'

import { ValidationFailed } from '../../domain/errors'
import { Config } from '../../services/Config'
import { Editor } from '../../services/Editor'
import { Profile } from '../../services/Profile'
import { Renderer } from '../../services/Renderer'

const name = Args.text({ name: 'name' })
const force = Options.boolean('force').pipe(Options.optional)

export const rm = Command.make('rm', { name, force }, ({ name, force }) =>
  Effect.gen(function* () {
    const profile = yield* Profile
    const config = yield* Config
    const editor = yield* Editor
    const renderer = yield* Renderer

    yield* profile.validateName(name)

    const forced = Option.getOrElse(force, () => false)
    const current = yield* profile.current
    if (current === name && !forced) {
      return yield* Effect.fail(
        new ValidationFailed({
          message: `profile '${name}' is currently active; pass --force to remove it`,
          hint: 'switch to another profile first with `mxs profile use <name>`',
        }),
      )
    }

    if (!forced) {
      if (!process.stdin.isTTY) {
        return yield* Effect.fail(
          new ValidationFailed({
            message: `cannot remove profile '${name}' non-interactively`,
            hint: 'pass --force to confirm removal in a non-interactive context',
          }),
        )
      }
      const confirmed = yield* editor
        .confirm(`Remove profile '${name}'? This cannot be undone.`)
        .pipe(Effect.catchAll(() => Effect.succeed(false)))
      if (!confirmed) return
    }

    yield* profile.rm(name)
    yield* renderer.emitInfo(`mxs: profile '${name}' removed`)

    if (current === name) {
      // Clear the stale active-profile pointer so subsequent commands don't
      // hit profile.not_found on a profile that no longer exists.
      const fs = yield* FileSystem.FileSystem
      const currentPath = yield* config.getCurrentPath
      yield* fs
        .remove(currentPath, { force: true })
        .pipe(Effect.catchAll(() => Effect.void))
      yield* renderer.emitInfo('mxs: cleared active profile pointer')
    }
  }),
)
