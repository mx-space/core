import { createRequire } from 'node:module'

import { Command, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import { Editor } from '../services/Editor'
import { Renderer } from '../services/Renderer'
import {
  make as makeUpdater,
  type RunUpdateOptions,
} from '../services/UpdateNotifier'

// Read package version once at module load. Walks up to find the cli
// package.json so the lookup works for both dev (`tsx src/...`) and the
// bundled `dist/*.mjs` layouts.
const requireFrom = createRequire(import.meta.url)
const resolveCliVersion = (): string => {
  const candidates = [
    '../package.json',
    '../../package.json',
    '../../../package.json',
  ]
  for (const candidate of candidates) {
    try {
      const pkg = requireFrom(candidate) as {
        name?: string
        version?: string
      }
      if (pkg.name === '@mx-space/cli' && typeof pkg.version === 'string') {
        return pkg.version
      }
    } catch {
      // try next candidate
    }
  }
  return '0.0.0-unknown'
}
const CLI_VERSION = resolveCliVersion()

const check = Options.boolean('check').pipe(Options.optional)
const prerelease = Options.boolean('prerelease').pipe(Options.optional)
const pm = Options.choice('pm', ['npm', 'pnpm', 'yarn', 'bun']).pipe(
  Options.optional,
)
const force = Options.boolean('force').pipe(Options.optional)
const yes = Options.boolean('yes').pipe(Options.optional)

const optBool = (opt: Option.Option<boolean>): boolean | undefined =>
  Option.getOrUndefined(opt)

export const updateCmd = Command.make(
  'update',
  { check, prerelease, pm, force, yes },
  ({ check, prerelease, pm, force, yes }) =>
    Effect.gen(function* () {
      const editor = yield* Editor
      const renderer = yield* Renderer
      const outOpts = yield* renderer.options

      // Build a fresh UpdateNotifier instance with Editor.confirm wired in.
      // The bin's AppLayer also registers a default UpdateNotifier (used by
      // the passive `maybeNotify`), but the interactive `runUpdate` path
      // needs the user-facing confirm prompt — Effect-based on the Editor
      // service, which is itself layered on FileSystem / Terminal.
      const updater = makeUpdater({
        confirmImpl: (message: string) =>
          Effect.runPromise(
            editor
              .confirm(message)
              .pipe(Effect.catchAll(() => Effect.succeed(false))),
          ),
      })

      const opts: RunUpdateOptions = {
        currentVersion: CLI_VERSION,
        check: optBool(check),
        prerelease: optBool(prerelease),
        pm: Option.getOrUndefined(pm),
        force: optBool(force),
        yes: optBool(yes),
        json: outOpts.json,
      }

      const result = yield* updater.runUpdate(opts)

      // The UpdateNotifier already streams `emitInfo` lines via deps.emitInfo
      // (default: process.stderr). The renderer.emitSuccess emits the final
      // structured result for JSON consumers + a closing info line in TTY.

      const command = result.command ?? null

      if (result.upToDate) {
        yield* renderer.emitSuccess({
          current: result.fromVersion,
          latest: result.toVersion,
          channel: result.channel,
          up_to_date: true,
        })
        if (!outOpts.json) {
          yield* renderer.emitInfo(
            `mxs: already up to date (${result.fromVersion})`,
          )
        }
        return
      }

      if (result.cancelled) {
        // The notifier already emitted the cancellation line via emitInfo.
        yield* renderer.emitSuccess({
          current: result.fromVersion,
          latest: result.toVersion,
          channel: result.channel,
          pm: result.pm,
          command,
          cancelled: true,
        })
        return
      }

      if (result.upgraded) {
        yield* renderer.emitSuccess({
          current: result.fromVersion,
          latest: result.toVersion,
          channel: result.channel,
          pm: result.pm,
          upgraded: true,
        })
        return
      }

      // Either --check or --dry-run path: no install ran, but not up to date.
      if (opts.check) {
        yield* renderer.emitSuccess({
          current: result.fromVersion,
          latest: result.toVersion,
          channel: result.channel,
          pm: result.pm,
          up_to_date: false,
        })
        return
      }

      // --dry-run
      yield* renderer.emitSuccess({
        current: result.fromVersion,
        latest: result.toVersion,
        channel: result.channel,
        pm: result.pm,
        command,
        dry_run: true,
      })
    }),
)
