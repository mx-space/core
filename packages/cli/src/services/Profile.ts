import { Context, Effect, Layer } from 'effect'

import {
  Generic,
  ProfileInvalidName,
  ProfileNotFound,
  ResourceNotFound,
} from '../domain/errors'
import {
  Config,
  type ConfigShape,
  type ResolvedConfig,
  type StoreOverrides,
} from './Config'

// ---------------------------------------------------------------------------
// Name validation
// ---------------------------------------------------------------------------

export const PROFILE_NAME_RE = /^[\d_a-z-]{1,32}$/
export const RESERVED_PROFILE_NAMES = new Set(['current'])

// ---------------------------------------------------------------------------
// Service contract
// ---------------------------------------------------------------------------

export interface ProfileSummary {
  readonly name: string
  readonly apiUrl?: string
  readonly production: boolean
  readonly authenticated: boolean
  readonly active: boolean
}

export interface ProfileService {
  readonly validateName: (
    name: string,
  ) => Effect.Effect<void, ProfileInvalidName>
  readonly list: Effect.Effect<readonly string[], Generic>
  readonly current: Effect.Effect<string | null, Generic>
  readonly use: (
    name: string,
  ) => Effect.Effect<void, ProfileInvalidName | ProfileNotFound | Generic>
  readonly mark: (
    name: string,
    update: { readonly production?: boolean },
  ) => Effect.Effect<ConfigShape, ProfileNotFound | Generic>
  readonly rm: (name: string) => Effect.Effect<void, ResourceNotFound | Generic>
  readonly show: (
    name: string,
  ) => Effect.Effect<ProfileSummary, ProfileNotFound | Generic>
  readonly resolve: (
    overrides?: StoreOverrides,
  ) => Effect.Effect<ResolvedConfig, ProfileNotFound | Generic>
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const make = Effect.gen(function* () {
  const config = yield* Config

  const validateName = (
    name: string,
  ): Effect.Effect<void, ProfileInvalidName> =>
    Effect.gen(function* () {
      if (!name || name.length === 0) {
        return yield* Effect.fail(
          new ProfileInvalidName({
            name,
            message: 'profile name must not be empty',
          }),
        )
      }
      if (RESERVED_PROFILE_NAMES.has(name)) {
        return yield* Effect.fail(
          new ProfileInvalidName({
            name,
            message: `profile name '${name}' is reserved`,
          }),
        )
      }
      if (!PROFILE_NAME_RE.test(name)) {
        return yield* Effect.fail(
          new ProfileInvalidName({
            name,
            message: `profile name '${name}' is invalid; must match ^[a-z0-9_-]{1,32}$`,
          }),
        )
      }
    })

  const list = config.listProfileDirs
  const current = config.readCurrent

  const use = (
    name: string,
  ): Effect.Effect<void, ProfileInvalidName | ProfileNotFound | Generic> =>
    Effect.gen(function* () {
      yield* validateName(name)
      const exists = yield* config.profileExists(name)
      if (!exists) {
        return yield* Effect.fail(
          new ProfileNotFound({
            name,
            message: `profile '${name}' does not exist`,
          }),
        )
      }
      yield* config.writeCurrent(name)
    })

  const mark = (
    name: string,
    update: { readonly production?: boolean },
  ): Effect.Effect<ConfigShape, ProfileNotFound | Generic> =>
    Effect.gen(function* () {
      const exists = yield* config.profileExists(name)
      if (!exists) {
        return yield* Effect.fail(
          new ProfileNotFound({
            name,
            message: `profile '${name}' does not exist`,
          }),
        )
      }
      return yield* config.updateProfileConfig(name, (prev) => {
        const next: ConfigShape = { ...prev }
        if (update.production === undefined) return next
        if (update.production) {
          return { ...next, production: true }
        }
        const stripped: Record<string, unknown> = { ...next }
        delete stripped.production
        return stripped as ConfigShape
      })
    })

  const rm = (name: string): Effect.Effect<void, ResourceNotFound | Generic> =>
    Effect.gen(function* () {
      const exists = yield* config.profileExists(name)
      if (!exists) {
        return yield* Effect.fail(
          new ResourceNotFound({
            kind: 'profile',
            ref: name,
            message: `profile '${name}' does not exist`,
          }),
        )
      }
      yield* config.removeProfileDir(name)
    })

  const show = (
    name: string,
  ): Effect.Effect<ProfileSummary, ProfileNotFound | Generic> =>
    Effect.gen(function* () {
      const exists = yield* config.profileExists(name)
      if (!exists) {
        return yield* Effect.fail(
          new ProfileNotFound({
            name,
            message: `profile '${name}' does not exist`,
          }),
        )
      }
      const cfg = yield* config.readProfileConfig(name)
      const creds = yield* config.readProfileCredentials(name)
      const active = (yield* config.readCurrent) === name
      return {
        name,
        apiUrl: cfg.api_url,
        production: Boolean(cfg.production),
        authenticated: creds !== null,
        active,
      }
    })

  const resolve = (
    overrides?: StoreOverrides,
  ): Effect.Effect<ResolvedConfig, ProfileNotFound | Generic> =>
    config.resolve(overrides).pipe(
      Effect.catchTags({
        ConfigMissingApiUrl: (e) =>
          Effect.fail(new Generic({ message: e.message, cause: e })),
        ConfigMigrationFailed: (e) =>
          Effect.fail(new Generic({ message: e.message, cause: e })),
      }),
    )

  const svc: ProfileService = {
    validateName,
    list,
    current,
    use,
    mark,
    rm,
    show,
    resolve,
  }
  return svc
})

export class Profile extends Context.Tag('Profile')<Profile, ProfileService>() {
  static Default: Layer.Layer<Profile, never, Config> = Layer.effect(
    Profile,
    make,
  )
}
