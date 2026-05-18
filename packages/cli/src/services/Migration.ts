import { FileSystem } from '@effect/platform'
import { Context, Effect, Layer } from 'effect'

import { ConfigMigrationFailed, type Generic } from '../domain/errors'
import { Config, stripLegacyConfigFields } from './Config'

// ---------------------------------------------------------------------------
// Service contract
// ---------------------------------------------------------------------------

export interface MigrationResult {
  readonly profile: string | null
  readonly production: boolean
  readonly cleanedStaleLegacy: boolean
}

export interface MigrationOptions {
  /** Defaults to process.stdin.isTTY && process.stdout.isTTY. */
  readonly isTTY?: boolean
  /**
   * Injected for tests. Called when TTY + legacy api_url present. Resolves
   * `true` to set production. May resolve a symbol (treated as cancel → false).
   */
  readonly promptIsProduction?: (apiUrl: string) => Promise<boolean | symbol>
  /**
   * Where to emit status messages. Defaults to `process.stderr`. Pass `null`
   * to suppress entirely.
   */
  readonly report?: ((line: string) => void) | null
}

export interface MigrationService {
  readonly runLegacyMigrationIfNeeded: (
    opts?: MigrationOptions,
  ) => Effect.Effect<MigrationResult | null, ConfigMigrationFailed | Generic>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const emit = (report: MigrationOptions['report'], line: string): void => {
  if (report === null) return
  if (report !== undefined) {
    report(line)
    return
  }
  process.stderr.write(`${line}\n`)
}

const isNotFound = (err: unknown): boolean => {
  if (typeof err === 'object' && err !== null) {
    const e = err as { _tag?: string; reason?: string; code?: string }
    if (e._tag === 'SystemError' && e.reason === 'NotFound') return true
    if (e.code === 'ENOENT') return true
  }
  return false
}

const fileExists = (
  fs: FileSystem.FileSystem,
  path: string,
): Effect.Effect<boolean, ConfigMigrationFailed> =>
  fs.stat(path).pipe(
    Effect.map(() => true),
    Effect.catchAll((err) =>
      isNotFound(err)
        ? Effect.succeed(false)
        : Effect.fail(
            new ConfigMigrationFailed({
              message: `failed to stat ${path}: ${String(err)}`,
              cause: err,
            }),
          ),
    ),
  )

const dirExists = (
  fs: FileSystem.FileSystem,
  path: string,
): Effect.Effect<boolean, ConfigMigrationFailed> =>
  fs.stat(path).pipe(
    Effect.map((info) => (info as FileSystem.File.Info).type === 'Directory'),
    Effect.catchAll((err) =>
      isNotFound(err)
        ? Effect.succeed(false)
        : Effect.fail(
            new ConfigMigrationFailed({
              message: `failed to stat ${path}: ${String(err)}`,
              cause: err,
            }),
          ),
    ),
  )

const tryUnlink = (
  fs: FileSystem.FileSystem,
  path: string,
  report: MigrationOptions['report'],
): Effect.Effect<void> =>
  fs.remove(path, { force: true }).pipe(
    Effect.catchAll((err) => {
      if (isNotFound(err)) return Effect.void
      emit(
        report,
        `mxs: warning: could not remove stale legacy file ${path}: ${
          (err as Error).message ?? String(err)
        }`,
      )
      return Effect.void
    }),
  )

// `@clack/prompts` exports a `cancel` symbol; matching by `typeof v === 'symbol'`
// covers both the real symbol and test fixtures. Inlined here so the migration
// service does not pull in `@clack/prompts` (the prompt callback is injected
// at the call site).
const isCancel = (v: unknown): boolean => typeof v === 'symbol'

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const make = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const config = yield* Config

  const runLegacyMigrationIfNeeded = (
    opts?: MigrationOptions,
  ): Effect.Effect<MigrationResult | null, ConfigMigrationFailed | Generic> =>
    Effect.gen(function* () {
      const report = opts?.report

      const legacyConfigPath = yield* config.getLegacyConfigPath
      const legacyCredentialsPath = yield* config.getLegacyCredentialsPath
      const profilesDir = yield* config.getProfilesDir

      const hasConfig = yield* fileExists(fs, legacyConfigPath)
      const hasCreds = yield* fileExists(fs, legacyCredentialsPath)

      // Fast path: nothing to migrate.
      if (!hasConfig && !hasCreds) return null

      const profilesExist = yield* dirExists(fs, profilesDir)

      // Stale-cleanup branch.
      if (profilesExist) {
        const toRemove: string[] = []
        if (hasConfig) toRemove.push(legacyConfigPath)
        if (hasCreds) toRemove.push(legacyCredentialsPath)
        for (const p of toRemove) {
          yield* tryUnlink(fs, p, report)
        }
        emit(
          report,
          `mxs: removed stale legacy config files at ${toRemove.join(', ')}`,
        )
        return {
          profile: null,
          production: false,
          cleanedStaleLegacy: true,
        } satisfies MigrationResult
      }

      // Full migration branch.
      let legacyConfig: Record<string, unknown> = {}
      if (hasConfig) {
        const raw = yield* fs.readFileString(legacyConfigPath).pipe(
          Effect.catchAll((err) =>
            Effect.fail(
              new ConfigMigrationFailed({
                message: `failed to read legacy config at ${legacyConfigPath}: ${String(err)}`,
                cause: err,
              }),
            ),
          ),
        )
        try {
          legacyConfig = JSON.parse(raw) as Record<string, unknown>
        } catch (err) {
          return yield* Effect.fail(
            new ConfigMigrationFailed({
              message: `failed to read legacy config at ${legacyConfigPath}: ${(err as Error).message}`,
              cause: err,
            }),
          )
        }
      }

      let legacyCredentials: Record<string, unknown> | null = null
      if (hasCreds) {
        const raw = yield* fs.readFileString(legacyCredentialsPath).pipe(
          Effect.catchAll((err) =>
            Effect.fail(
              new ConfigMigrationFailed({
                message: `failed to read legacy credentials at ${legacyCredentialsPath}: ${String(err)}`,
                cause: err,
              }),
            ),
          ),
        )
        try {
          legacyCredentials = JSON.parse(raw) as Record<string, unknown>
        } catch (err) {
          return yield* Effect.fail(
            new ConfigMigrationFailed({
              message: `failed to read legacy credentials at ${legacyCredentialsPath}: ${(err as Error).message}`,
              cause: err,
            }),
          )
        }
      }

      let production = false
      const tty =
        opts?.isTTY ?? Boolean(process.stdin.isTTY && process.stdout.isTTY)
      const apiUrl =
        typeof legacyConfig.api_url === 'string'
          ? legacyConfig.api_url
          : undefined

      if (tty && apiUrl && opts?.promptIsProduction) {
        const answer = yield* Effect.tryPromise({
          try: () => opts.promptIsProduction!(apiUrl),
          catch: (err) =>
            new ConfigMigrationFailed({
              message: `legacy migration prompt failed: ${String(err)}`,
              cause: err,
            }),
        })
        production = isCancel(answer) ? false : Boolean(answer)
      }

      // Strip legacy fields and apply production flag.
      const migratedConfig: Record<string, unknown> = {
        ...(stripLegacyConfigFields(legacyConfig) as Record<string, unknown>),
      }
      if (production) {
        migratedConfig.production = true
      } else {
        delete migratedConfig.production
      }

      yield* config.writeProfileConfig('default', migratedConfig as any).pipe(
        Effect.catchAll((err) =>
          Effect.fail(
            new ConfigMigrationFailed({
              message: `failed to write profile config during migration: ${String(err)}`,
              cause: err,
            }),
          ),
        ),
      )

      if (legacyCredentials !== null) {
        yield* config
          .writeProfileCredentials('default', legacyCredentials as any)
          .pipe(
            Effect.catchAll((err) =>
              Effect.fail(
                new ConfigMigrationFailed({
                  message: `failed to write profile credentials during migration: ${String(err)}`,
                  cause: err,
                }),
              ),
            ),
          )
      }

      // Point `current` at the new default profile before unlinking legacy
      // files, so a crash mid-migration leaves the user with a recoverable
      // state.
      yield* config.writeCurrent('default').pipe(
        Effect.catchAll((err) =>
          Effect.fail(
            new ConfigMigrationFailed({
              message: `failed to set current profile to default: ${String(err)}`,
              cause: err,
            }),
          ),
        ),
      )

      if (hasConfig) yield* tryUnlink(fs, legacyConfigPath, report)
      if (hasCreds) yield* tryUnlink(fs, legacyCredentialsPath, report)

      emit(report, `mxs: migrated single-profile config to profile 'default'.`)

      return {
        profile: 'default',
        production,
        cleanedStaleLegacy: false,
      } satisfies MigrationResult
    })

  const svc: MigrationService = { runLegacyMigrationIfNeeded }
  return svc
})

export class Migration extends Context.Tag('Migration')<
  Migration,
  MigrationService
>() {
  static Default: Layer.Layer<
    Migration,
    never,
    Config | FileSystem.FileSystem
  > = Layer.effect(Migration, make)
}
