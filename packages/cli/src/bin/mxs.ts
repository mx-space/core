#!/usr/bin/env node
import { createRequire } from 'node:module'

import { Command } from '@effect/cli'
import { NodeContext, NodeHttpClient, NodeRuntime } from '@effect/platform-node'
import { Effect, Layer } from 'effect'

import { aiCmd } from '../cli/ai'
import { authCmd } from '../cli/auth'
import { categoryCmd } from '../cli/category'
import { commentCmd } from '../cli/comment'
import { configCmd } from '../cli/config'
import { draftCmd } from '../cli/draft'
import { fileCmd } from '../cli/file'
import {
  buildRootHelpData,
  emitGroupHelp,
  emitHelp,
  groupHelpDataFor,
  isGroupName,
} from '../cli/help'
import { noteCmd } from '../cli/note'
import { pageCmd } from '../cli/page'
import { postCmd } from '../cli/post'
import { previewCmd } from '../cli/preview'
import { profileCmd } from '../cli/profile'
import { projectCmd } from '../cli/project'
import { skillCmd } from '../cli/skill'
import { snippetCmd } from '../cli/snippet'
import { topicCmd } from '../cli/topic'
import { updateCmd } from '../cli/update'
import {
  type CliError,
  exitCodeForTag,
  Generic,
  ProfileInvalidName,
  ProfileNoneActive,
  tagToCode,
} from '../domain/errors'
import {
  detectInvokedCommand,
  requiresActiveProfile,
} from '../domain/preflight-guards'
import {
  currentDryRun,
  currentProfileFlag,
  type GlobalFlags,
  parseGlobalFlags,
} from '../domain/runtime-flags'
import { AppLayer } from '../layers/App'
import { Ai } from '../services/Ai'
import { Api } from '../services/Api'
import { Comment } from '../services/Comment'
import {
  LOCAL_DEV_ENV,
  LOCAL_DEV_PROFILE_NAME,
  shouldUseLocalDev,
} from '../services/Config'
import { Migration } from '../services/Migration'
import { Profile } from '../services/Profile'
import { currentOutputOptions, Renderer } from '../services/Renderer'
import { Resolver } from '../services/Resolver'
import { make as makeUpdater } from '../services/UpdateNotifier'

// ---------------------------------------------------------------------------
// Package version (read once at module load via createRequire).
// ---------------------------------------------------------------------------
//
// `import.meta.url` resolves to one of:
//   - `<root>/packages/cli/src/bin/mxs.ts`   (tsx, dev — 2 levels up)
//   - `<root>/packages/cli/dist/mxs.mjs`     (tsdown bundle — 1 level up)
//   - `<root>/packages/cli/dist/bin/mxs.mjs` (tsdown re-export shim — 2 up)
//
// To avoid hard-coding a fixed depth, walk up until we find a `package.json`
// whose `name` is `@mx-space/cli`.

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

// Force stdout/stderr into blocking mode on POSIX pipes so writes drain
// before `process.exit()` returns. Without this, output produced just before
// exit (help text, JSON envelopes, error frames) is silently dropped under
// pipe pressure — observable as empty-stdout flake when the CLI is spawned
// from another process (e2e harness, scripts, CI).
for (const stream of [process.stdout, process.stderr]) {
  const handle = (
    stream as unknown as {
      _handle?: { setBlocking?: (blocking: boolean) => void }
    }
  )._handle
  if (handle && typeof handle.setBlocking === 'function') {
    handle.setBlocking(true)
  }
}

// Mirror the v0.2.x convenience: when running this file directly from source,
// enable the local-dev default profile so the bare `mxs ...` invocation does
// not require explicit configuration.
if (import.meta.url.endsWith('/src/bin/mxs.ts')) {
  process.env[LOCAL_DEV_ENV] ??= '1'
}

// ---------------------------------------------------------------------------
// Root command (subcommands only — global flags are pre-parsed before
// `@effect/cli` ever sees argv, so they don't need to be declared here).
// ---------------------------------------------------------------------------

const rootCmd = Command.make('mxs', {}, () =>
  Effect.flatMap(Renderer, (r) =>
    r.emitInfo(
      'mxs: mx-space CLI — see `mxs --help` for the command list, or `mxs <command> --help` for details.',
    ),
  ),
).pipe(
  Command.withDescription(
    'mx-space CLI — manage your mx-core blog from the command line.',
  ),
  Command.withSubcommands([
    authCmd,
    profileCmd,
    postCmd,
    noteCmd,
    pageCmd,
    draftCmd,
    projectCmd,
    categoryCmd,
    topicCmd,
    commentCmd,
    snippetCmd,
    aiCmd,
    configCmd,
    fileCmd,
    skillCmd,
    previewCmd,
    updateCmd,
  ]),
)

// ---------------------------------------------------------------------------
// Preflight: profile-name validation, legacy migration, active-profile guard,
// fire-and-forget passive update notifier.
// ---------------------------------------------------------------------------

const preflight = (flags: GlobalFlags) =>
  Effect.gen(function* () {
    const profile = yield* Profile
    const migration = yield* Migration
    const updater = yield* Effect.sync(() =>
      makeUpdater({
        emitInfo: flags.quiet ? () => undefined : undefined,
      }),
    )

    // 1. Validate --profile name (mirrors legacy try { validateProfileName }).
    if (flags.profile) {
      yield* profile.validateName(flags.profile).pipe(
        Effect.catchTag('ProfileInvalidName', (e) =>
          Effect.fail(
            new ProfileInvalidName({
              name: e.name,
              message: e.message,
              hint: 'profile name must match ^[a-z0-9_-]{1,32}$ and must not be "current"',
            }),
          ),
        ),
      )
    }

    // 2. Run legacy migration if needed; stream status to stderr unless quiet.
    yield* migration
      .runLegacyMigrationIfNeeded({
        report: flags.quiet ? null : undefined,
      })
      .pipe(
        Effect.catchAll((err) =>
          Effect.fail(
            new Generic({
              message: err.message ?? 'legacy migration failed',
              cause: err,
            }),
          ),
        ),
      )

    // 3. Guard: throw profile.none_active if no profile is resolvable AND the
    //    active subcommand is not exempt.
    const invoked = detectInvokedCommand(process.argv)
    const currentProfile = yield* profile.current.pipe(
      Effect.catchAll(() => Effect.succeed(null)),
    )
    const effectiveCurrentProfile =
      currentProfile ||
      (shouldUseLocalDev({
        profileOverride: flags.profile,
        envProfile: process.env.MXS_PROFILE,
        apiUrlOverride: flags.apiUrl,
        envApiUrl: process.env.MXS_API_URL,
        currentProfile,
      })
        ? LOCAL_DEV_PROFILE_NAME
        : null)
    if (
      requiresActiveProfile({
        profileFlag: flags.profile,
        apiUrlFlag: flags.apiUrl,
        envProfile: process.env.MXS_PROFILE?.trim(),
        envApiUrl: process.env.MXS_API_URL?.trim(),
        currentProfile: effectiveCurrentProfile,
        parentName: invoked.parentName,
        commandName: invoked.commandName,
      })
    ) {
      return yield* Effect.fail(
        new ProfileNoneActive({
          message: 'no active mxs profile',
          hint: 'run `mxs profile use <name>` to switch, or `mxs auth login --profile <name>` to create one',
        }),
      )
    }

    // 4. Fire-and-forget passive update notifier (no fiber leak — the bin's
    //    runMain awaits all daemon fibers before exit).
    yield* Effect.forkDaemon(
      updater.maybeNotify({
        currentVersion: CLI_VERSION,
        quiet: flags.quiet,
        json: flags.json,
        output: flags.output,
        commandName: invoked.commandName,
        parentName: invoked.parentName,
      }),
    )
  })

// ---------------------------------------------------------------------------
// Wire it up.
// ---------------------------------------------------------------------------

/**
 * Decide whether the user is asking for a help screen we render ourselves.
 *
 * We override `@effect/cli`'s built-in renderer at two levels:
 *
 *   - `root` — bare `mxs`, `mxs --help`, `mxs -h`. The default renderer
 *     flattens every nested verb into one COMMANDS table and can't see our
 *     pre-parsed global flags (stripped from argv before `Command.run`).
 *
 *   - `group` — `mxs <group>` or `mxs <group> --help|-h` for the 9 top-level
 *     commands. The default renderer mis-labels the header as `mxs` instead
 *     of `mxs <group>`, lists `$ <group>` (no program prefix) under USAGE,
 *     and clutters OPTIONS with five built-in flags that don't apply to us.
 *
 * Verb-level help (`mxs post create --help`, etc.) is NOT intercepted —
 * `@effect/cli`'s single-command pages are reasonable as-is.
 */
type HelpTarget =
  | { readonly kind: 'none' }
  | { readonly kind: 'root' }
  | { readonly kind: 'group'; readonly name: string }

// Top-level commands that are leafs (have their own handler) rather than
// subcommand groups. Bare `mxs <leaf>` MUST execute the handler — only
// `mxs <leaf> --help` should render our custom group/leaf help page.
const LEAF_COMMANDS = new Set<string>(['update', 'skill', 'preview'])

const detectHelpTarget = (rest: readonly string[]): HelpTarget => {
  // `rest` includes argv[0] (node) and argv[1] (script).
  const args = rest.slice(2)
  if (args.length === 0) return { kind: 'root' }
  const first = args[0]
  if (args.length === 1 && (first === '--help' || first === '-h')) {
    return { kind: 'root' }
  }
  // Bare `mxs <group>` (no flags, no verb) → group help. Groups have no
  // default executable; @effect/cli would print its default help anyway.
  // Leafs like `update` carry a real handler and must NOT be intercepted.
  if (args.length === 1 && isGroupName(first) && !LEAF_COMMANDS.has(first)) {
    return { kind: 'group', name: first }
  }
  // Explicit `--help` / `-h` on any top-level command (group OR leaf) → our
  // custom help.
  if (
    args.length === 2 &&
    isGroupName(first) &&
    (args[1] === '--help' || args[1] === '-h')
  ) {
    return { kind: 'group', name: first }
  }
  return { kind: 'none' }
}

export const run = (argv: readonly string[]): Promise<void> => {
  const parsed = parseGlobalFlags(argv)
  const flags = parsed.flags

  // Intercept root- and group-level help BEFORE building any layers or
  // invoking `@effect/cli`. This sidesteps the broken layout produced by the
  // default renderer at both depths (see `src/cli/help.ts`).
  const helpTarget = detectHelpTarget(parsed.rest)
  if (helpTarget.kind === 'root') {
    emitHelp(buildRootHelpData(CLI_VERSION))
    return Promise.resolve()
  }
  if (helpTarget.kind === 'group') {
    emitGroupHelp(groupHelpDataFor(helpTarget.name, CLI_VERSION))
    return Promise.resolve()
  }

  // The HttpClient layer used by Api + Auth. NodeContext.layer brings FS,
  // Path, Terminal, CommandExecutor but NOT HttpClient — that's a separate
  // export.
  const httpLayer = NodeHttpClient.layer

  // Build the flag-aware Api layer. Resolver depends on Api, so we provide
  // its dependencies first and let `Layer.provide` resolve the rest.
  const apiLayer = Api.layer({
    overrides: {
      apiUrl: flags.apiUrl,
      token: flags.token,
      apiKey: flags.apiKey,
      profile: flags.profile,
    },
    verbose: flags.verbose,
    quiet: flags.quiet,
    dryRun: flags.dryRun,
    lang: flags.lang,
  })

  // Layer composition. `AppLayer` requires platform services (FileSystem,
  // Path, HttpClient). `Layer.mergeAll` does not internally wire deps so we
  // use `Layer.provideMerge` to thread HttpClient into AppLayer while
  // re-exporting both. The result still requires FileSystem + Path, which
  // come from `NodeContext.layer` at the outer `Effect.provide` site.
  const appWithHttp = AppLayer.pipe(Layer.provideMerge(httpLayer))
  const apiWithDeps = apiLayer.pipe(Layer.provideMerge(appWithHttp))
  const commentWithDeps = Comment.Default.pipe(Layer.provideMerge(apiWithDeps))
  const resolverWithDeps = Resolver.Default.pipe(
    Layer.provideMerge(commentWithDeps),
  )
  const aiWithDeps = Ai.Default.pipe(Layer.provideMerge(resolverWithDeps))
  const fullAppLayer = aiWithDeps

  const cli = Command.run(rootCmd, { name: 'mxs', version: CLI_VERSION })

  // Tagged-error rendering + exit-code mapping happen INSIDE the FiberRef
  // scopes so the Renderer sees the parsed `--json` / `--output` settings.
  const core = preflight(flags).pipe(
    Effect.zipRight(cli(parsed.rest)),
    Effect.tapError((err) =>
      isCliError(err)
        ? Effect.flatMap(Renderer, (r) => r.emitError(err))
        : Effect.sync(() => undefined),
    ),
    Effect.catchAll((err) =>
      Effect.sync(() => {
        const tag = isCliError(err) ? err._tag : 'Generic'
        process.exit(exitCodeForTag(tag))
      }),
    ),
  )

  const program = Effect.locally(
    Effect.locally(
      Effect.locally(core, currentOutputOptions, {
        json: flags.json,
        output: flags.output,
        quiet: flags.quiet,
        verbose: flags.verbose,
      }),
      currentDryRun,
      flags.dryRun,
    ),
    currentProfileFlag,
    flags.profile?.trim() || undefined,
  )

  // Defects bypass the Effect error channel; surface them generically.
  const finalized = program.pipe(
    Effect.catchAllDefect((defect) =>
      Effect.sync(() => {
        process.stderr.write(`mxs: internal error\n${String(defect)}\n`)
        process.exit(1)
      }),
    ),
    Effect.provide(fullAppLayer),
    Effect.provide(NodeContext.layer),
  )

  return NodeRuntime.runMain(finalized) as unknown as Promise<void>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isCliError = (err: unknown): err is CliError => {
  if (typeof err !== 'object' || err === null) return false
  if (!('_tag' in err)) return false
  const tag = (err as { _tag: unknown })._tag
  return typeof tag === 'string' && tag in tagToCode
}

// ---------------------------------------------------------------------------
// Auto-run when executed as the program entry-point.
//
// `import.meta.url` ends in either `src/bin/mxs.ts` (tsx, dev) or
// `dist/mxs.mjs` (built bundle); both invoke `run(process.argv)`. When the
// module is imported (tests, library use), `run` is not invoked.
// ---------------------------------------------------------------------------

const isDirectInvocation = (): boolean => {
  const url = import.meta.url
  // Direct dev/source invocation (`tsx src/bin/mxs.ts`) or the legacy
  // CommonJS shim (`bin/mxs.cjs`).
  if (/\/bin\/mxs\.(?:ts|cjs)$/.test(url)) return true
  // Bundled invocation: tsdown emits a re-export shim at `dist/bin/mxs.mjs`
  // that pulls in the bundled core (`dist/mxs-<hash>.mjs`). Match either.
  if (/\/dist\/bin\/mxs\.mjs$/.test(url)) return true
  if (/\/dist\/mxs(?:-[^/]*)?\.mjs$/.test(url)) return true
  // Fallback: process.argv[1]'s basename matches the module url's basename.
  if (process.argv[1]) {
    const argvBase = process.argv[1].split('/').pop() ?? ''
    const urlBase = url.split('/').pop() ?? ''
    if (argvBase === urlBase) return true
  }
  return false
}

if (isDirectInvocation()) {
  void run(process.argv)
}
