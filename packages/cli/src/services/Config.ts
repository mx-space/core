import { FileSystem, Path } from '@effect/platform'
import { Context, Effect, Layer } from 'effect'

import type { ConfigMigrationFailed } from '../domain/errors'
import { ConfigMissingApiUrl, Generic, ProfileNotFound } from '../domain/errors'

// ---------------------------------------------------------------------------
// Shapes — runtime structural types. Strict schema validation lives in
// `domain/schema/config.ts`; we keep the service contract loose so legacy
// fields can be passed through unchanged.
// ---------------------------------------------------------------------------

export interface ConfigShape {
  readonly api_url?: string
  readonly api_version?: number
  readonly production?: boolean
}

export interface CredentialsShape {
  readonly access_token: string
  readonly refresh_token?: string
  readonly expires_at: number
  readonly user?: {
    readonly id?: string
    readonly email?: string
    readonly name?: string
  }
}

export interface ResolvedConfig {
  readonly apiUrl: string
  readonly apiBase: string
  readonly authBase: string
  readonly apiVersion: number
  readonly clientId: string
  readonly token?: string
  readonly apiKey?: string
  readonly configPath: string
  readonly credentialsPath: string
  readonly profileName: string | null
  readonly isProduction: boolean
  readonly profileExplicit: boolean
  readonly urlOverridden: boolean
}

export interface StoreOverrides {
  readonly apiUrl?: string
  readonly token?: string
  readonly apiKey?: string
  readonly profile?: string
}

// ---------------------------------------------------------------------------
// Constants — keep wire-compatible with `src/core/config-store.ts`
// ---------------------------------------------------------------------------

export const DEFAULT_CLIENT_ID = 'mxs-cli'

export const LEGACY_CONFIG_FIELDS = [
  'api_base',
  'auth_base',
  'client_id',
] as const

export const LOCAL_DEV_ENV = 'MXS_CLI_LOCAL_DEV'
export const LOCAL_DEV_API_URL_ENV = 'MXS_CLI_LOCAL_DEV_API_URL'
export const LOCAL_DEV_PROFILE_NAME = 'local-dev'
export const LOCAL_DEV_API_URL_DEFAULT = 'http://localhost:2333'

export interface LocalDevProfileInput {
  readonly profileOverride?: string
  readonly envProfile?: string
  readonly apiUrlOverride?: string
  readonly envApiUrl?: string
  readonly currentProfile?: string | null
}

export const isLocalDevEnabled = (): boolean =>
  process.env[LOCAL_DEV_ENV] === '1'

export const getLocalDevApiUrl = (): string =>
  process.env[LOCAL_DEV_API_URL_ENV]?.trim() || LOCAL_DEV_API_URL_DEFAULT

export const shouldUseLocalDev = (input: LocalDevProfileInput): boolean =>
  isLocalDevEnabled() &&
  !input.profileOverride?.trim() &&
  !input.envProfile?.trim() &&
  !input.apiUrlOverride?.trim() &&
  !input.envApiUrl?.trim()

export const stripLegacyConfigFields = (
  cfg: Record<string, unknown>,
): ConfigShape => {
  const out: Record<string, unknown> = { ...cfg }
  for (const k of LEGACY_CONFIG_FIELDS) delete out[k]
  return out as ConfigShape
}

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

export interface ParsedApiUrl {
  readonly baseUrl: string
  readonly apiVersion?: number
}

export const parseApiUrl = (
  input: string,
): Effect.Effect<ParsedApiUrl, ConfigMissingApiUrl> =>
  Effect.gen(function* () {
    let url = input.trim()
    if (!url) {
      return yield* Effect.fail(
        new ConfigMissingApiUrl({ message: 'API URL is empty' }),
      )
    }
    if (!/^https?:\/\//i.test(url)) {
      const isLocal = /^(?:localhost|127\.0\.0\.1|::1)(?::\d+)?$/i.test(url)
      url = isLocal ? `http://${url}` : `https://${url}`
    }
    url = url.replace(/\/+$/, '')
    const match = url.match(/^(.*)\/api\/v(\d+)$/)
    if (match) {
      return { baseUrl: match[1], apiVersion: Number(match[2]) }
    }
    // Accept a bare `/api` suffix too — many users habitually paste the API
    // root rather than the site root. The probe lives at `/api/v{N}/auth/ok`,
    // so a leftover `/api` would yield a `/api/api/v{N}/...` URL and 404.
    const apiSuffix = url.match(/^(.*)\/api$/)
    if (apiSuffix) {
      return { baseUrl: apiSuffix[1] }
    }
    return { baseUrl: url }
  })

export const normalizeApiUrl = (
  input: string,
): Effect.Effect<string, ConfigMissingApiUrl> =>
  Effect.map(parseApiUrl(input), (p) => p.baseUrl)

// ---------------------------------------------------------------------------
// Service contract
// ---------------------------------------------------------------------------

export interface ConfigService {
  readonly getConfigDir: Effect.Effect<string>
  readonly getProfilesDir: Effect.Effect<string>
  readonly getProfileDir: (name: string) => Effect.Effect<string>
  readonly getProfileConfigPath: (name: string) => Effect.Effect<string>
  readonly getProfileCredentialsPath: (name: string) => Effect.Effect<string>
  readonly getCurrentPath: Effect.Effect<string>
  readonly getLegacyConfigPath: Effect.Effect<string>
  readonly getLegacyCredentialsPath: Effect.Effect<string>

  readonly readProfileConfig: (
    name: string,
  ) => Effect.Effect<ConfigShape, ProfileNotFound | Generic>
  readonly writeProfileConfig: (
    name: string,
    cfg: ConfigShape,
  ) => Effect.Effect<void, Generic>
  readonly updateProfileConfig: (
    name: string,
    update: (prev: ConfigShape) => ConfigShape,
  ) => Effect.Effect<ConfigShape, ProfileNotFound | Generic>

  readonly readProfileCredentials: (
    name: string,
  ) => Effect.Effect<CredentialsShape | null, Generic>
  readonly writeProfileCredentials: (
    name: string,
    creds: CredentialsShape,
  ) => Effect.Effect<void, Generic>
  readonly deleteProfileCredentials: (
    name: string,
  ) => Effect.Effect<void, Generic>

  readonly readLegacyConfig: Effect.Effect<ConfigShape, Generic>
  readonly readLegacyConfigRaw: Effect.Effect<
    Record<string, unknown> | null,
    Generic
  >
  readonly readLegacyCredentialsRaw: Effect.Effect<
    Record<string, unknown> | null,
    Generic
  >
  readonly deleteLegacyConfig: Effect.Effect<void, Generic>
  readonly deleteLegacyCredentials: Effect.Effect<void, Generic>

  readonly readCurrent: Effect.Effect<string | null, Generic>
  readonly writeCurrent: (name: string) => Effect.Effect<void, Generic>

  readonly listProfileDirs: Effect.Effect<readonly string[], Generic>
  readonly profileExists: (name: string) => Effect.Effect<boolean, Generic>
  readonly removeProfileDir: (name: string) => Effect.Effect<void, Generic>

  readonly resolve: (
    overrides?: StoreOverrides,
  ) => Effect.Effect<
    ResolvedConfig,
    ConfigMissingApiUrl | ProfileNotFound | ConfigMigrationFailed | Generic
  >
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const PROFILES_SUBDIR = 'profiles'

const getXdgConfigDir = (path: Path.Path): string => {
  const xdg = process.env.XDG_CONFIG_HOME
  const base =
    xdg && xdg.length > 0
      ? xdg
      : path.join(process.env.HOME || process.env.USERPROFILE || '~', '.config')
  return path.join(base, 'mxs')
}

const isNotFound = (err: unknown): boolean => {
  if (typeof err === 'object' && err !== null) {
    const e = err as { _tag?: string; reason?: string; code?: string }
    if (e._tag === 'SystemError' && e.reason === 'NotFound') return true
    if (e.code === 'ENOENT') return true
  }
  return false
}

const toGeneric = (err: unknown, message: string): Generic =>
  new Generic({ message, cause: err })

const readJsonIfExists = <T>(
  fs: FileSystem.FileSystem,
  filePath: string,
): Effect.Effect<T | null, Generic> =>
  Effect.gen(function* () {
    const raw: string | null = yield* fs.readFileString(filePath).pipe(
      Effect.map((s) => s as string | null),
      Effect.catchAll((err) =>
        isNotFound(err)
          ? Effect.succeed(null as string | null)
          : Effect.fail(
              toGeneric(err, `failed to read ${filePath}: ${String(err)}`),
            ),
      ),
    )
    if (raw === null) return null as T | null
    try {
      return JSON.parse(raw) as T
    } catch (err) {
      return yield* Effect.fail(
        new Generic({
          message: `failed to parse ${filePath}: ${(err as Error).message}`,
          cause: err,
        }),
      )
    }
  })

const writeJson = (
  fs: FileSystem.FileSystem,
  filePath: string,
  data: unknown,
  mode: number,
): Effect.Effect<void, Generic> =>
  Effect.gen(function* () {
    const text = `${JSON.stringify(data, null, 2)}`
    yield* fs
      .writeFileString(filePath, text, { mode })
      .pipe(
        Effect.catchAll((err) =>
          Effect.fail(toGeneric(err, `failed to write ${filePath}`)),
        ),
      )
    // Best-effort chmod — silently ignore failures (Windows / unsupported FS).
    yield* fs.chmod(filePath, mode).pipe(Effect.catchAll(() => Effect.void))
  })

const ensureProfileDir = (
  fs: FileSystem.FileSystem,
  dir: string,
): Effect.Effect<void, Generic> =>
  Effect.gen(function* () {
    yield* fs
      .makeDirectory(dir, { recursive: true, mode: 0o700 })
      .pipe(
        Effect.catchAll((err) =>
          Effect.fail(toGeneric(err, `failed to create ${dir}`)),
        ),
      )
    yield* fs.chmod(dir, 0o700).pipe(Effect.catchAll(() => Effect.void))
  })

const make = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  // Path helpers --------------------------------------------------------------

  const configDir = () => getXdgConfigDir(path)
  const profilesDir = () => path.join(configDir(), PROFILES_SUBDIR)
  const profileDir = (name: string) => path.join(profilesDir(), name)
  const profileConfigPath = (name: string) =>
    path.join(profileDir(name), 'config.json')
  const profileCredentialsPath = (name: string) =>
    path.join(profileDir(name), 'credentials.json')
  const legacyConfigPath = () => path.join(configDir(), 'config.json')
  const legacyCredentialsPath = () => path.join(configDir(), 'credentials.json')
  const currentPath = () => path.join(configDir(), 'current')

  // Profile config IO ---------------------------------------------------------

  const readProfileConfig = (
    name: string,
  ): Effect.Effect<ConfigShape, ProfileNotFound | Generic> =>
    Effect.gen(function* () {
      const raw = yield* readJsonIfExists<Record<string, unknown>>(
        fs,
        profileConfigPath(name),
      )
      return stripLegacyConfigFields(raw ?? {})
    })

  const writeProfileConfig = (
    name: string,
    cfg: ConfigShape,
  ): Effect.Effect<void, Generic> =>
    Effect.gen(function* () {
      yield* ensureProfileDir(fs, profileDir(name))
      yield* writeJson(fs, profileConfigPath(name), cfg, 0o644)
    })

  const updateProfileConfig = (
    name: string,
    update: (prev: ConfigShape) => ConfigShape,
  ): Effect.Effect<ConfigShape, ProfileNotFound | Generic> =>
    Effect.gen(function* () {
      const prev = yield* readProfileConfig(name)
      const next = update(prev)
      yield* writeProfileConfig(name, next)
      return next
    })

  // Credentials IO ------------------------------------------------------------

  const enforceCredsMode = (p: string): Effect.Effect<void, Generic> =>
    Effect.gen(function* () {
      const info = yield* fs.stat(p).pipe(
        Effect.map((i) => i as FileSystem.File.Info | null),
        Effect.catchAll((err) =>
          isNotFound(err)
            ? Effect.succeed(null as FileSystem.File.Info | null)
            : Effect.fail(toGeneric(err, `failed to stat ${p}`)),
        ),
      )
      if (info === null) return
      const mode = info.mode & 0o777
      if (mode !== 0o600) {
        process.stderr.write(
          `mxs: credentials file ${p} had mode ${mode.toString(8)}; chmod 600\n`,
        )
        yield* fs.chmod(p, 0o600).pipe(Effect.catchAll(() => Effect.void))
      }
    })

  const readProfileCredentials = (
    name: string,
  ): Effect.Effect<CredentialsShape | null, Generic> =>
    Effect.gen(function* () {
      const p = profileCredentialsPath(name)
      const data = yield* readJsonIfExists<CredentialsShape>(fs, p)
      if (data !== null) {
        yield* enforceCredsMode(p)
      }
      return data
    })

  const writeProfileCredentials = (
    name: string,
    creds: CredentialsShape,
  ): Effect.Effect<void, Generic> =>
    Effect.gen(function* () {
      yield* ensureProfileDir(fs, profileDir(name))
      yield* writeJson(fs, profileCredentialsPath(name), creds, 0o600)
    })

  const deleteProfileCredentials = (
    name: string,
  ): Effect.Effect<void, Generic> =>
    fs
      .remove(profileCredentialsPath(name), { force: true })
      .pipe(
        Effect.catchAll((err) =>
          isNotFound(err)
            ? Effect.void
            : Effect.fail(toGeneric(err, `failed to remove credentials`)),
        ),
      )

  // Legacy IO -----------------------------------------------------------------

  const readLegacyConfigRaw: Effect.Effect<
    Record<string, unknown> | null,
    Generic
  > = readJsonIfExists<Record<string, unknown>>(fs, legacyConfigPath())

  const readLegacyCredentialsRaw: Effect.Effect<
    Record<string, unknown> | null,
    Generic
  > = readJsonIfExists<Record<string, unknown>>(fs, legacyCredentialsPath())

  const readLegacyConfig: Effect.Effect<ConfigShape, Generic> = Effect.map(
    readLegacyConfigRaw,
    (raw) => (raw === null ? {} : stripLegacyConfigFields(raw)),
  )

  const deleteLegacyConfig: Effect.Effect<void, Generic> = fs
    .remove(legacyConfigPath(), { force: true })
    .pipe(
      Effect.catchAll((err) =>
        isNotFound(err)
          ? Effect.void
          : Effect.fail(toGeneric(err, 'failed to remove legacy config')),
      ),
    )

  const deleteLegacyCredentials: Effect.Effect<void, Generic> = fs
    .remove(legacyCredentialsPath(), { force: true })
    .pipe(
      Effect.catchAll((err) =>
        isNotFound(err)
          ? Effect.void
          : Effect.fail(toGeneric(err, 'failed to remove legacy credentials')),
      ),
    )

  // Current pointer -----------------------------------------------------------

  const readCurrent: Effect.Effect<string | null, Generic> = Effect.gen(
    function* () {
      const raw = yield* fs.readFileString(currentPath()).pipe(
        Effect.map((s) => s as string | null),
        Effect.catchAll((err) =>
          isNotFound(err)
            ? Effect.succeed(null as string | null)
            : Effect.fail(toGeneric(err, 'failed to read current pointer')),
        ),
      )
      if (raw === null) return null
      const name = raw.trim()
      return name.length > 0 ? name : null
    },
  )

  const writeCurrent = (name: string): Effect.Effect<void, Generic> =>
    Effect.gen(function* () {
      yield* fs
        .makeDirectory(configDir(), { recursive: true })
        .pipe(
          Effect.catchAll((err) =>
            Effect.fail(toGeneric(err, 'failed to create mxs config dir')),
          ),
        )
      yield* fs
        .writeFileString(currentPath(), `${name}\n`)
        .pipe(
          Effect.catchAll((err) =>
            Effect.fail(toGeneric(err, 'failed to write current pointer')),
          ),
        )
    })

  // Profile dir listing -------------------------------------------------------

  const listProfileDirs: Effect.Effect<readonly string[], Generic> = Effect.gen(
    function* () {
      const dir = profilesDir()
      const entries: readonly string[] | null = yield* fs
        .readDirectory(dir)
        .pipe(
          Effect.map((arr) => arr as readonly string[] | null),
          Effect.catchAll((err) =>
            isNotFound(err)
              ? Effect.succeed(null as readonly string[] | null)
              : Effect.fail(toGeneric(err, `failed to list ${dir}`)),
          ),
        )
      if (entries === null) return []
      const visible = entries.filter((name) => !name.startsWith('.'))
      // Filter out non-directory entries (files like `readme.txt`).
      const out: string[] = []
      for (const name of visible) {
        const info = yield* fs.stat(path.join(dir, name)).pipe(
          Effect.map((i) => i as FileSystem.File.Info | null),
          Effect.catchAll(() =>
            Effect.succeed(null as FileSystem.File.Info | null),
          ),
        )
        if (info && info.type === 'Directory') out.push(name)
      }
      return out.sort()
    },
  )

  const profileExists = (name: string): Effect.Effect<boolean, Generic> =>
    fs.stat(profileDir(name)).pipe(
      Effect.map((info) => (info as FileSystem.File.Info).type === 'Directory'),
      Effect.catchAll((err) =>
        isNotFound(err)
          ? Effect.succeed(false)
          : Effect.fail(toGeneric(err, `failed to stat profile ${name}`)),
      ),
    )

  const removeProfileDir = (name: string): Effect.Effect<void, Generic> =>
    fs
      .remove(profileDir(name), { recursive: true, force: true })
      .pipe(
        Effect.catchAll((err) =>
          Effect.fail(toGeneric(err, `failed to remove profile ${name}`)),
        ),
      )

  // Resolve ------------------------------------------------------------------

  const buildLocalDevProfileConfig = (): Effect.Effect<
    ConfigShape,
    ConfigMissingApiUrl
  > =>
    Effect.gen(function* () {
      const parsed = yield* parseApiUrl(getLocalDevApiUrl())
      return {
        api_url: parsed.baseUrl,
        api_version: 2,
        production: false,
      }
    })

  const resolve = (
    overrides: StoreOverrides = {},
  ): Effect.Effect<
    ResolvedConfig,
    ConfigMissingApiUrl | ProfileNotFound | ConfigMigrationFailed | Generic
  > =>
    Effect.gen(function* () {
      const envApiUrl = process.env.MXS_API_URL?.trim()
      const envToken = process.env.MXS_TOKEN?.trim()
      const envApiKey = process.env.MXS_API_KEY?.trim()
      const envProfile = process.env.MXS_PROFILE?.trim()

      const urlOverridden = Boolean(overrides.apiUrl || envApiUrl)
      const profileExplicit = Boolean(overrides.profile || envProfile)
      const currentProfile = yield* readCurrent
      const useLocalDev = shouldUseLocalDev({
        profileOverride: overrides.profile,
        envProfile,
        apiUrlOverride: overrides.apiUrl,
        envApiUrl,
        currentProfile,
      })

      const profileName: string | null =
        overrides.profile?.trim() ||
        envProfile ||
        (useLocalDev ? LOCAL_DEV_PROFILE_NAME : null) ||
        currentProfile ||
        null

      const useLocalDevEndpoint =
        isLocalDevEnabled() &&
        !urlOverridden &&
        profileName === LOCAL_DEV_PROFILE_NAME

      if (profileName && !urlOverridden && !useLocalDev) {
        const exists = yield* profileExists(profileName)
        if (!exists) {
          return yield* Effect.fail(
            new ProfileNotFound({
              name: profileName,
              message: `profile '${profileName}' does not exist`,
              hint: 'run `mxs profile ls` to see configured profiles, or `mxs auth login --profile <name>` to create one',
            }),
          )
        }
      }

      let profileConfig: ConfigShape = {}
      if (useLocalDev) {
        profileConfig = yield* buildLocalDevProfileConfig()
      } else if (profileName) {
        profileConfig = yield* readProfileConfig(profileName)
      }

      const rawApiUrl = overrides.apiUrl || envApiUrl || profileConfig.api_url
      if (!rawApiUrl) {
        return yield* Effect.fail(
          new ConfigMissingApiUrl({
            message: 'API URL is not configured',
            hint: 'set MXS_API_URL or pass --api-url <url>, or run `mxs auth login` in an interactive shell',
          }),
        )
      }
      const parsed = yield* parseApiUrl(rawApiUrl)
      const apiUrl = parsed.baseUrl
      const apiVersion = profileConfig.api_version ?? parsed.apiVersion ?? 2
      const apiBase = useLocalDevEndpoint
        ? apiUrl
        : `${apiUrl}/api/v${apiVersion}`
      const authBase = useLocalDevEndpoint
        ? `${apiUrl}/auth`
        : `${apiBase}/auth`

      let token: string | undefined
      if (urlOverridden) {
        token = overrides.token || envToken || undefined
      } else {
        let profileCreds: CredentialsShape | null = null
        // Read credentials for the resolved profile, including the synthetic
        // `local-dev` profile when auth login has written them. Skipping the
        // read when `useLocalDev` is true was a bug — login writes
        // credentials under `profiles/local-dev/`, so subsequent commands must
        // pick them up.
        if (profileName) {
          profileCreds = yield* readProfileCredentials(profileName)
        }
        token = overrides.token || envToken || profileCreds?.access_token
      }

      const apiKey = overrides.apiKey || envApiKey

      const isProduction = urlOverridden
        ? false
        : profileName
          ? Boolean(profileConfig.production)
          : false

      return {
        apiUrl,
        apiBase,
        authBase,
        apiVersion,
        clientId: DEFAULT_CLIENT_ID,
        token,
        apiKey,
        configPath: profileName
          ? profileConfigPath(profileName)
          : legacyConfigPath(),
        credentialsPath: profileName
          ? profileCredentialsPath(profileName)
          : legacyCredentialsPath(),
        profileName,
        isProduction,
        profileExplicit,
        urlOverridden,
      }
    })

  const svc: ConfigService = {
    getConfigDir: Effect.sync(configDir),
    getProfilesDir: Effect.sync(profilesDir),
    getProfileDir: (name: string) => Effect.sync(() => profileDir(name)),
    getProfileConfigPath: (name: string) =>
      Effect.sync(() => profileConfigPath(name)),
    getProfileCredentialsPath: (name: string) =>
      Effect.sync(() => profileCredentialsPath(name)),
    getCurrentPath: Effect.sync(currentPath),
    getLegacyConfigPath: Effect.sync(legacyConfigPath),
    getLegacyCredentialsPath: Effect.sync(legacyCredentialsPath),
    readProfileConfig,
    writeProfileConfig,
    updateProfileConfig,
    readProfileCredentials,
    writeProfileCredentials,
    deleteProfileCredentials,
    readLegacyConfig,
    readLegacyConfigRaw,
    readLegacyCredentialsRaw,
    deleteLegacyConfig,
    deleteLegacyCredentials,
    readCurrent,
    writeCurrent,
    listProfileDirs,
    profileExists,
    removeProfileDir,
    resolve,
  }
  return svc
})

export class Config extends Context.Tag('Config')<Config, ConfigService>() {
  static Default: Layer.Layer<
    Config,
    never,
    FileSystem.FileSystem | Path.Path
  > = Layer.effect(Config, make)
}
