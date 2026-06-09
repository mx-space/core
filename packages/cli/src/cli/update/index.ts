import { createRequire } from 'node:module'

import { Command, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import { Renderer } from '../../services/Renderer'
import {
  make as makeUpdater,
  type RunUpdateOptions,
} from '../../services/UpdateNotifier'
import { registerCommandHelp } from '../help/registry'
import { bold, dim, fail, ok, star } from '../ui'

registerCommandHelp({
  name: 'update',
  description: 'install the newest mxs release (auto, no prompt)',
  isLeaf: true,
  leafOptions: [
    { flag: '--check', description: 'compare versions only; do not install' },
    { flag: '--prerelease', description: 'use the `next` dist-tag channel' },
    {
      flag: '--pm <name>',
      description: 'force package manager (one of: npm, pnpm, yarn, bun)',
    },
    { flag: '--force', description: 'bypass the 24h passive-check cache' },
    {
      flag: '--yes',
      description:
        'deprecated no-op (kept for back-compat; updates run without a prompt by default)',
    },
  ],
})

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
      const renderer = yield* Renderer
      const outOpts = yield* renderer.options

      // Auto-install: `mxs update` no longer prompts. Foreground runs go
      // through the same notifier as the passive background path; we do not
      // wire `Editor.confirm` here because `runUpdate` itself stopped calling
      // any confirmImpl.
      const updater = makeUpdater()

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
        yield* renderer.emitView(
          {
            current: result.fromVersion,
            latest: result.toVersion,
            channel: result.channel,
            up_to_date: true,
          },
          ({ color }) =>
            ok(
              `up to date · ${bold(result.fromVersion, color)} ${dim(`(${result.channel})`, color)}`,
              color,
            ),
        )
        return
      }

      if (result.cancelled) {
        yield* renderer.emitView(
          {
            current: result.fromVersion,
            latest: result.toVersion,
            channel: result.channel,
            pm: result.pm,
            command,
            cancelled: true,
          },
          ({ color }) =>
            fail(
              `update cancelled · ${dim(`${result.fromVersion} → ${result.toVersion}`, color)}`,
              color,
            ),
        )
        return
      }

      if (result.upgraded) {
        yield* renderer.emitView(
          {
            current: result.fromVersion,
            latest: result.toVersion,
            channel: result.channel,
            pm: result.pm,
            upgraded: true,
          },
          ({ color }) =>
            ok(
              `upgraded · ${bold(`${result.fromVersion} → ${result.toVersion}`, color)} ${dim(`(${result.channel}, ${result.pm})`, color)}`,
              color,
            ),
        )
        return
      }

      // --check path: not up to date, but no install ran.
      if (opts.check) {
        yield* renderer.emitView(
          {
            current: result.fromVersion,
            latest: result.toVersion,
            channel: result.channel,
            pm: result.pm,
            up_to_date: false,
          },
          ({ color }) => {
            const head = star('update available', color)
            const versions = `   ${bold(result.fromVersion, color)}  →  ${bold(result.toVersion, color)}   ${dim(result.channel, color)}`
            const cmd = command
              ? `\n\n   ${dim('run:', color)} ${bold(command, color)}`
              : ''
            return `${head}\n\n${versions}${cmd}`
          },
        )
        return
      }

      // --dry-run path
      yield* renderer.emitView(
        {
          current: result.fromVersion,
          latest: result.toVersion,
          channel: result.channel,
          pm: result.pm,
          command,
          dry_run: true,
        },
        ({ color }) => {
          const head = star('would upgrade', color)
          const versions = `   ${bold(result.fromVersion, color)}  →  ${bold(result.toVersion, color)}   ${dim(result.channel, color)}`
          const cmd = command
            ? `\n\n   ${dim('would run:', color)} ${bold(command, color)}`
            : ''
          return `${head}\n\n${versions}${cmd}`
        },
      )
    }),
)
