import { FileSystem } from '@effect/platform'
import { it } from '@effect/vitest'
import { Effect, Exit, Layer } from 'effect'
import { afterEach, beforeEach, describe, expect } from 'vitest'

import {
  Config,
  LOCAL_DEV_ENV,
  LOCAL_DEV_PROFILE_NAME,
  normalizeApiUrl,
  parseApiUrl,
  shouldUseLocalDev,
  stripLegacyConfigFields,
} from '../../src/services/Config'
import { makeMemFs, TestFsLive, TestPathLive } from '../helper/test-fs'

// Each test gets its own in-memory FS + Config layer.
const makeLayer = () => {
  const mem = makeMemFs()
  const fsLayer = TestFsLive(mem)
  const baseLayer = Layer.merge(fsLayer, TestPathLive)
  const configLayer = Config.Default.pipe(Layer.provide(baseLayer))
  return { mem, layer: Layer.merge(baseLayer, configLayer) }
}

const makeLayerWithFs = (
  overrides: Parameters<typeof FileSystem.layerNoop>[0],
) => {
  const fsLayer = FileSystem.layerNoop(overrides)
  const baseLayer = Layer.merge(fsLayer, TestPathLive)
  const configLayer = Config.Default.pipe(Layer.provide(baseLayer))
  return Layer.merge(baseLayer, configLayer)
}

const expectConfigFailure = async (
  effect: Effect.Effect<unknown, unknown, never>,
) => {
  const exit = await Effect.runPromiseExit(effect)
  expect(Exit.isFailure(exit)).toBe(true)
}

const failFs = (message: string) => Effect.fail(new Error(message) as never)

beforeEach(() => {
  process.env.XDG_CONFIG_HOME = '/xdg'
  delete process.env.MXS_API_URL
  delete process.env.MXS_TOKEN
  delete process.env.MXS_API_KEY
  delete process.env.MXS_PROFILE
  delete process.env.MXS_CLI_LOCAL_DEV
  delete process.env.MXS_CLI_LOCAL_DEV_API_URL
})

afterEach(() => {
  delete process.env.XDG_CONFIG_HOME
  delete process.env.MXS_API_URL
  delete process.env.MXS_TOKEN
  delete process.env.MXS_API_KEY
  delete process.env.MXS_PROFILE
  delete process.env.MXS_CLI_LOCAL_DEV
  delete process.env.MXS_CLI_LOCAL_DEV_API_URL
})

describe('pure helpers', () => {
  it.effect('normalizeApiUrl strips trailing slash', () =>
    Effect.gen(function* () {
      const out = yield* normalizeApiUrl('https://blog.example.com/')
      expect(out).toBe('https://blog.example.com')
    }),
  )

  it.effect('normalizeApiUrl adds https for remote hosts', () =>
    Effect.gen(function* () {
      const out = yield* normalizeApiUrl('blog.example.com')
      expect(out).toBe('https://blog.example.com')
    }),
  )

  it.effect('normalizeApiUrl adds http for localhost', () =>
    Effect.gen(function* () {
      const out = yield* normalizeApiUrl('localhost:3000')
      expect(out).toBe('http://localhost:3000')
    }),
  )

  it.effect('parseApiUrl rejects blank input and supports 127.0.0.1', () =>
    Effect.gen(function* () {
      const err = yield* Effect.flip(parseApiUrl('   '))
      expect(err._tag).toBe('ConfigMissingApiUrl')
      const local = yield* normalizeApiUrl('127.0.0.1:2333')
      expect(local).toBe('http://127.0.0.1:2333')
    }),
  )

  it.effect('parseApiUrl extracts api version from path', () =>
    Effect.gen(function* () {
      const out = yield* parseApiUrl('https://x.example.com/api/v3')
      expect(out.baseUrl).toBe('https://x.example.com')
      expect(out.apiVersion).toBe(3)
    }),
  )

  it('stripLegacyConfigFields removes legacy keys', () => {
    expect(
      stripLegacyConfigFields({
        api_url: 'x',
        api_base: 'y',
        auth_base: 'z',
        client_id: 'c',
      } as any),
    ).toEqual({ api_url: 'x' })
  })

  it('shouldUseLocalDev requires the env flag', () => {
    expect(shouldUseLocalDev({})).toBe(false)
    process.env[LOCAL_DEV_ENV] = '1'
    expect(shouldUseLocalDev({})).toBe(true)
    expect(shouldUseLocalDev({ envProfile: 'dev' })).toBe(false)
    expect(shouldUseLocalDev({ profileOverride: 'dev' })).toBe(false)
    expect(shouldUseLocalDev({ envApiUrl: 'http://x' })).toBe(false)
    expect(shouldUseLocalDev({ apiUrlOverride: 'http://x' })).toBe(
      false,
    )
  })

  it('reads the local-dev API URL override from env', async () => {
    process.env.MXS_CLI_LOCAL_DEV_API_URL = 'http://localhost:4000'
    const { getLocalDevApiUrl } = await import('../../src/services/Config')
    expect(getLocalDevApiUrl()).toBe('http://localhost:4000')
  })
})

describe('Config — profile config IO', () => {
  it('round-trips profile config', async () => {
    const { mem, layer } = makeLayer()
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        yield* config.writeProfileConfig('dev', {
          api_url: 'https://dev.example.com',
          api_version: 2,
        })
        return yield* config.readProfileConfig('dev')
      }).pipe(Effect.provide(layer)),
    )
    expect(result.api_url).toBe('https://dev.example.com')
    expect(result.api_version).toBe(2)
    expect(mem.mode('/xdg/mxs/profiles/dev/config.json')).toBe(0o644)
    expect(mem.mode('/xdg/mxs/profiles/dev')).toBe(0o700)
  })

  it('returns empty object when config absent', async () => {
    const { layer } = makeLayer()
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        return yield* config.readProfileConfig('ghost')
      }).pipe(Effect.provide(layer)),
    )
    expect(result).toEqual({})
  })

  it('strips legacy config fields on read', async () => {
    const { mem, layer } = makeLayer()
    mem.seed(
      '/xdg/mxs/profiles/old/config.json',
      JSON.stringify({
        api_url: 'https://x.example.com',
        api_base: 'should-be-stripped',
        client_id: 'old',
      }),
    )
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        return yield* config.readProfileConfig('old')
      }).pipe(Effect.provide(layer)),
    )
    expect(result).toEqual({ api_url: 'https://x.example.com' })
  })

  it('updates profile config and reports malformed JSON', async () => {
    const { mem, layer } = makeLayer()
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        yield* config.writeProfileConfig('dev', {
          api_url: 'https://dev.example.com',
        })
        return yield* config.updateProfileConfig('dev', (prev) => ({
          ...prev,
          production: true,
        }))
      }).pipe(Effect.provide(layer)),
    )
    expect(result.production).toBe(true)

    mem.seed('/xdg/mxs/profiles/bad/config.json', '{')
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const config = yield* Config
        return yield* config.readProfileConfig('bad')
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it('maps profile config filesystem failures to Generic', async () => {
    await expectConfigFailure(
      Effect.gen(function* () {
        const config = yield* Config
        return yield* config.readProfileConfig('dev')
      }).pipe(
        Effect.provide(
          makeLayerWithFs({
            readFileString: () => failFs('read failed'),
          }),
        ),
      ),
    )

    await expectConfigFailure(
      Effect.gen(function* () {
        const config = yield* Config
        return yield* config.writeProfileConfig('dev', {})
      }).pipe(
        Effect.provide(
          makeLayerWithFs({
            makeDirectory: () => failFs('mkdir failed'),
          }),
        ),
      ),
    )

    await expectConfigFailure(
      Effect.gen(function* () {
        const config = yield* Config
        return yield* config.writeProfileConfig('dev', {})
      }).pipe(
        Effect.provide(
          makeLayerWithFs({
            makeDirectory: () => Effect.void,
            writeFileString: () => failFs('write failed'),
          }),
        ),
      ),
    )
  })
})

describe('Config — credentials IO', () => {
  it('round-trips credentials with mode 0600', async () => {
    const { mem, layer } = makeLayer()
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        yield* config.writeProfileCredentials('dev', {
          access_token: 'tok-abc',
          expires_at: 100,
        })
        return yield* config.readProfileCredentials('dev')
      }).pipe(Effect.provide(layer)),
    )
    expect(result?.access_token).toBe('tok-abc')
    expect(mem.mode('/xdg/mxs/profiles/dev/credentials.json')).toBe(0o600)
  })

  it('returns null when credentials missing', async () => {
    const { layer } = makeLayer()
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        return yield* config.readProfileCredentials('ghost')
      }).pipe(Effect.provide(layer)),
    )
    expect(result).toBeNull()
  })

  it('deleteProfileCredentials is idempotent when absent', async () => {
    const { layer } = makeLayer()
    await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        yield* config.deleteProfileCredentials('ghost')
      }).pipe(Effect.provide(layer)),
    )
  })

  it('fixes loose credentials file mode on read and deletes present credentials', async () => {
    const { mem, layer } = makeLayer()
    mem.seed(
      '/xdg/mxs/profiles/dev/credentials.json',
      JSON.stringify({ access_token: 'tok', expires_at: 1 }),
      0o644,
    )
    const stderr: string[] = []
    const descriptor = process.stderr.write
    ;(process.stderr.write as any) = (chunk: any) => {
      stderr.push(String(chunk))
      return true
    }
    try {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const config = yield* Config
          const creds = yield* config.readProfileCredentials('dev')
          yield* config.deleteProfileCredentials('dev')
          return creds
        }).pipe(Effect.provide(layer)),
      )
      expect(result?.access_token).toBe('tok')
      expect(mem.mode('/xdg/mxs/profiles/dev/credentials.json')).toBeNull()
      expect(stderr.join('')).toContain('chmod 600')
    } finally {
      process.stderr.write = descriptor
    }
  })

  it('maps credential removal failures to Generic', async () => {
    await expectConfigFailure(
      Effect.gen(function* () {
        const config = yield* Config
        return yield* config.deleteProfileCredentials('dev')
      }).pipe(
        Effect.provide(
          makeLayerWithFs({
            remove: () => failFs('remove failed'),
          }),
        ),
      ),
    )
  })
})

describe('Config — pointers, legacy files, and profile listing', () => {
  it('exposes derived paths, current pointer, legacy files, and profile listing', async () => {
    const { mem, layer } = makeLayer()
    mem.seed('/xdg/mxs/config.json', '{"api_url":"https://legacy.example.com","api_base":"old"}')
    mem.seed('/xdg/mxs/credentials.json', '{"access_token":"legacy","expires_at":1}')
    mem.seed('/xdg/mxs/profiles/.hidden/config.json', '{}')
    mem.seed('/xdg/mxs/profiles/file.txt', 'not a directory')
    await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        expect(yield* config.getConfigDir).toBe('/xdg/mxs')
        expect(yield* config.getProfilesDir).toBe('/xdg/mxs/profiles')
        expect(yield* config.getProfileDir('dev')).toBe('/xdg/mxs/profiles/dev')
        expect(yield* config.getProfileConfigPath('dev')).toBe(
          '/xdg/mxs/profiles/dev/config.json',
        )
        expect(yield* config.getProfileCredentialsPath('dev')).toBe(
          '/xdg/mxs/profiles/dev/credentials.json',
        )
        expect(yield* config.getCurrentPath).toBe('/xdg/mxs/current')
        expect(yield* config.getLegacyConfigPath).toBe('/xdg/mxs/config.json')
        expect(yield* config.getLegacyCredentialsPath).toBe(
          '/xdg/mxs/credentials.json',
        )

        yield* config.writeProfileConfig('dev', { api_url: 'https://dev.example.com' })
        yield* config.writeProfileConfig('prod', { api_url: 'https://prod.example.com' })
        expect(yield* config.listProfileDirs).toEqual(['dev', 'prod'])
        expect(yield* config.profileExists('dev')).toBe(true)
        expect(yield* config.profileExists('ghost')).toBe(false)

        yield* config.writeCurrent('prod')
        expect(yield* config.readCurrent).toBe('prod')
        mem.seed('/xdg/mxs/current', '   \n')
        expect(yield* config.readCurrent).toBeNull()

        expect(yield* config.readLegacyConfig).toEqual({
          api_url: 'https://legacy.example.com',
        })
        expect(yield* config.readLegacyConfigRaw).toMatchObject({
          api_url: 'https://legacy.example.com',
        })
        expect(yield* config.readLegacyCredentialsRaw).toMatchObject({
          access_token: 'legacy',
        })
        yield* config.deleteLegacyConfig
        yield* config.deleteLegacyCredentials
        yield* config.removeProfileDir('prod')
        expect(yield* config.profileExists('prod')).toBe(false)
      }).pipe(Effect.provide(layer)),
    )
  })

  it('maps pointer and profile-listing filesystem failures to Generic', async () => {
    await expectConfigFailure(
      Effect.gen(function* () {
        const config = yield* Config
        return yield* config.writeCurrent('dev')
      }).pipe(
        Effect.provide(
          makeLayerWithFs({
            makeDirectory: () => failFs('mkdir failed'),
          }),
        ),
      ),
    )

    await expectConfigFailure(
      Effect.gen(function* () {
        const config = yield* Config
        return yield* config.writeCurrent('dev')
      }).pipe(
        Effect.provide(
          makeLayerWithFs({
            makeDirectory: () => Effect.void,
            writeFileString: () => failFs('write failed'),
          }),
        ),
      ),
    )

    await expectConfigFailure(
      Effect.gen(function* () {
        const config = yield* Config
        return yield* config.listProfileDirs
      }).pipe(
        Effect.provide(
          makeLayerWithFs({
            readDirectory: () => failFs('list failed'),
          }),
        ),
      ),
    )

    await expectConfigFailure(
      Effect.gen(function* () {
        const config = yield* Config
        return yield* config.profileExists('dev')
      }).pipe(
        Effect.provide(
          makeLayerWithFs({
            stat: () => failFs('stat failed'),
          }),
        ),
      ),
    )

    await expectConfigFailure(
      Effect.gen(function* () {
        const config = yield* Config
        return yield* config.removeProfileDir('dev')
      }).pipe(
        Effect.provide(
          makeLayerWithFs({
            remove: () => failFs('remove failed'),
          }),
        ),
      ),
    )
  })
})

describe('Config.resolve — no profile configured', () => {
  it('fails when api_url missing and no profile', async () => {
    const { layer } = makeLayer()
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const config = yield* Config
        return yield* config.resolve()
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const err: any = (exit.cause as any).error ?? exit.cause
      const tag = (err && err._tag) || (err && err.failure && err.failure._tag)
      expect(['ConfigMissingApiUrl']).toContain(
        tag ?? err.error?._tag ?? 'unknown',
      )
    }
  })

  it('uses the virtual local-dev profile when dev default is enabled', async () => {
    process.env[LOCAL_DEV_ENV] = '1'
    const { layer } = makeLayer()
    const r = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        return yield* config.resolve()
      }).pipe(Effect.provide(layer)),
    )
    expect(r.apiUrl).toBe('http://localhost:2333')
    expect(r.apiBase).toBe('http://localhost:2333')
    expect(r.authBase).toBe('http://localhost:2333/auth')
    expect(r.profileName).toBe(LOCAL_DEV_PROFILE_NAME)
    expect(r.isProduction).toBe(false)
    expect(r.urlOverridden).toBe(false)
  })

  it('lets explicit URLs override the virtual local-dev profile', async () => {
    process.env[LOCAL_DEV_ENV] = '1'
    process.env.MXS_API_URL = 'https://x.example.com'
    const { layer } = makeLayer()
    const r = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        return yield* config.resolve()
      }).pipe(Effect.provide(layer)),
    )
    expect(r.apiUrl).toBe('https://x.example.com')
    expect(r.apiBase).toBe('https://x.example.com/api/v2')
    expect(r.profileName).toBeNull()
    expect(r.urlOverridden).toBe(true)
  })

  it('reads MXS_API_URL env', async () => {
    process.env.MXS_API_URL = 'https://x.example.com'
    const { layer } = makeLayer()
    const r = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        return yield* config.resolve()
      }).pipe(Effect.provide(layer)),
    )
    expect(r.apiUrl).toBe('https://x.example.com')
    expect(r.apiBase).toBe('https://x.example.com/api/v2')
    expect(r.urlOverridden).toBe(true)
    expect(r.profileExplicit).toBe(false)
  })

  it('respects --api-url flag override over env', async () => {
    process.env.MXS_API_URL = 'https://env.example.com'
    const { layer } = makeLayer()
    const r = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        return yield* config.resolve({ apiUrl: 'https://flag.example.com' })
      }).pipe(Effect.provide(layer)),
    )
    expect(r.apiUrl).toBe('https://flag.example.com')
    expect(r.urlOverridden).toBe(true)
  })

  it('reads token from MXS_TOKEN env', async () => {
    process.env.MXS_API_URL = 'https://x.example.com'
    process.env.MXS_TOKEN = 'abc'
    const { layer } = makeLayer()
    const r = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        return yield* config.resolve()
      }).pipe(Effect.provide(layer)),
    )
    expect(r.token).toBe('abc')
  })

  it('reads api key from MXS_API_KEY env, with flag override', async () => {
    process.env.MXS_API_URL = 'https://x.example.com'
    process.env.MXS_API_KEY = 'txo-env'
    const { layer } = makeLayer()
    const r = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        return yield* config.resolve({ apiKey: 'txo-flag' })
      }).pipe(Effect.provide(layer)),
    )
    expect(r.apiKey).toBe('txo-flag')
  })
})

describe('Config.resolve — profile-aware resolution', () => {
  it('reads api_url from active profile via MXS_PROFILE', async () => {
    const { layer } = makeLayer()
    const r = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        yield* config.writeProfileConfig('dev', {
          api_url: 'https://dev.example.com',
        })
        process.env.MXS_PROFILE = 'dev'
        return yield* config.resolve()
      }).pipe(Effect.provide(layer)),
    )
    expect(r.apiUrl).toBe('https://dev.example.com')
    expect(r.profileName).toBe('dev')
    expect(r.profileExplicit).toBe(true)
    expect(r.urlOverridden).toBe(false)
  })

  it('reads api_url from current pointer', async () => {
    const { mem, layer } = makeLayer()
    mem.seed('/xdg/mxs/current', 'prod\n')
    const r = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        yield* config.writeProfileConfig('prod', {
          api_url: 'https://prod.example.com',
          production: true,
        })
        return yield* config.resolve()
      }).pipe(Effect.provide(layer)),
    )
    expect(r.profileName).toBe('prod')
    expect(r.apiUrl).toBe('https://prod.example.com')
    expect(r.isProduction).toBe(true)
    expect(r.profileExplicit).toBe(false)
  })

  it('flag override > env > current pointer', async () => {
    const { mem, layer } = makeLayer()
    mem.seed('/xdg/mxs/current', 'file-profile\n')
    process.env.MXS_PROFILE = 'env-profile'
    const r = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        yield* config.writeProfileConfig('flag-profile', {
          api_url: 'https://flag.example.com',
        })
        yield* config.writeProfileConfig('env-profile', {
          api_url: 'https://env.example.com',
        })
        yield* config.writeProfileConfig('file-profile', {
          api_url: 'https://file.example.com',
        })
        return yield* config.resolve({ profile: 'flag-profile' })
      }).pipe(Effect.provide(layer)),
    )
    expect(r.profileName).toBe('flag-profile')
    expect(r.apiUrl).toBe('https://flag.example.com')
  })

  it('token comes from profile credentials when no url override', async () => {
    const { layer } = makeLayer()
    process.env.MXS_PROFILE = 'dev'
    const r = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        yield* config.writeProfileConfig('dev', {
          api_url: 'https://dev.example.com',
        })
        yield* config.writeProfileCredentials('dev', {
          access_token: 'profile-token-xyz',
          expires_at: 99999,
        })
        return yield* config.resolve()
      }).pipe(Effect.provide(layer)),
    )
    expect(r.token).toBe('profile-token-xyz')
  })

  it('does NOT read profile credentials when --api-url overrides', async () => {
    const { layer } = makeLayer()
    process.env.MXS_PROFILE = 'prod'
    const r = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        yield* config.writeProfileConfig('prod', {
          api_url: 'https://prod.example.com',
          production: true,
        })
        yield* config.writeProfileCredentials('prod', {
          access_token: 'fixture',
          expires_at: 99999,
        })
        return yield* config.resolve({ apiUrl: 'https://custom.example.com' })
      }).pipe(Effect.provide(layer)),
    )
    expect(r.urlOverridden).toBe(true)
    expect(r.token).toBeUndefined()
    expect(r.isProduction).toBe(false)
  })

  it('throws ProfileNotFound when current points to a missing dir', async () => {
    const { mem, layer } = makeLayer()
    mem.seed('/xdg/mxs/current', 'ghost\n')
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const config = yield* Config
        return yield* config.resolve()
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const cause: any = exit.cause
      const err = cause.error ?? cause.failure ?? cause
      const tag = err?._tag ?? err?.error?._tag ?? err?.failure?._tag
      expect(tag).toBe('ProfileNotFound')
    }
  })

  it('does NOT throw ProfileNotFound in url-override mode even with stale current', async () => {
    const { mem, layer } = makeLayer()
    mem.seed('/xdg/mxs/current', 'ghost\n')
    const r = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        return yield* config.resolve({ apiUrl: 'https://custom.example.com' })
      }).pipe(Effect.provide(layer)),
    )
    expect(r.urlOverridden).toBe(true)
    expect(r.apiUrl).toBe('https://custom.example.com')
  })
})
