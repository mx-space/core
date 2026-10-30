import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'

import { Api } from '../../src/services/Api'
import { Auth, type AuthService } from '../../src/services/Auth'
import {
  Config,
  type ConfigService,
  type CredentialsShape,
  type ResolvedConfig,
} from '../../src/services/Config'
import { testHttpLayer } from '../helper/test-http'

const baseResolved: ResolvedConfig = {
  apiUrl: 'https://blog.example.com',
  apiBase: 'https://blog.example.com/api/v2',
  authBase: 'https://blog.example.com/api/v2/auth',
  apiVersion: 2,
  clientId: 'mxs-cli',
  configPath: '/tmp/config.json',
  credentialsPath: '/tmp/credentials.json',
  profileName: 'prod',
  isProduction: false,
  profileExplicit: false,
  urlOverridden: false,
}

const makeMockConfigLayer = (
  resolved: ResolvedConfig,
  creds: CredentialsShape | null,
  writes: { last: CredentialsShape | null } = { last: null },
) => {
  const service: ConfigService = {
    getConfigDir: Effect.succeed('/tmp'),
    getProfilesDir: Effect.succeed('/tmp/profiles'),
    getProfileDir: (name) => Effect.succeed(`/tmp/profiles/${name}`),
    getProfileConfigPath: (name) =>
      Effect.succeed(`/tmp/profiles/${name}/config.json`),
    getProfileCredentialsPath: (name) =>
      Effect.succeed(`/tmp/profiles/${name}/credentials.json`),
    getCurrentPath: Effect.succeed('/tmp/current'),
    getLegacyConfigPath: Effect.succeed('/tmp/config.json'),
    getLegacyCredentialsPath: Effect.succeed('/tmp/credentials.json'),
    readProfileConfig: () => Effect.succeed({}),
    writeProfileConfig: () => Effect.void,
    updateProfileConfig: () => Effect.succeed({}),
    readProfileCredentials: () => Effect.succeed(creds),
    writeProfileCredentials: (_name, cred) =>
      Effect.sync(() => {
        writes.last = cred
      }),
    deleteProfileCredentials: () => Effect.void,
    readLegacyConfig: Effect.succeed({}),
    readLegacyConfigRaw: Effect.succeed(null),
    readLegacyCredentialsRaw: Effect.succeed(null),
    deleteLegacyConfig: Effect.void,
    deleteLegacyCredentials: Effect.void,
    readCurrent: Effect.succeed(resolved.profileName),
    writeCurrent: () => Effect.void,
    listProfileDirs: Effect.succeed([]),
    profileExists: () => Effect.succeed(true),
    removeProfileDir: () => Effect.void,
    resolve: () => Effect.succeed(resolved),
  }
  return Layer.succeed(Config, service)
}

const makeMockAuthLayer = (overrides: Partial<AuthService> = {}) => {
  const noop: AuthService = {
    probe: () => Effect.die('probe not used'),
    requestDeviceCode: () => Effect.die('requestDeviceCode not used'),
    pollDeviceToken: () => Effect.die('pollDeviceToken not used'),
    refresh: () => Effect.succeed(null),
    login: () => Effect.die('login not used'),
    logout: () => Effect.void,
    whoami: Effect.die('whoami not used'),
    status: Effect.die('status not used'),
    ensureFresh: (r) =>
      Effect.succeed({
        access_token: r.token ?? '',
        expires_at: Date.now() + 3600_000,
      }),
    enrichUser: (_profile, _authBase, cred) => Effect.succeed(cred),
    ...overrides,
  }
  return Layer.succeed(Auth, noop)
}


describe('Api.connection', () => {
  it('returns the api base and the same auth headers requests use', async () => {
    const layer = Api.Default.pipe(
      Layer.provide(
        makeMockConfigLayer({ ...baseResolved, token: 'tok', apiKey: 'txo-secret' }, null),
      ),
      Layer.provide(makeMockAuthLayer()),
      Layer.provide(testHttpLayer({}).layer),
    )
    const program = Effect.gen(function* () {
      const api = yield* Api
      return yield* api.connection('GET')
    })
    const result = await Effect.runPromise(Effect.provide(program, layer))
    expect(result.apiBase).toBe('https://blog.example.com/api/v2')
    expect(result.headers.authorization).toBe('Bearer tok')
    expect(result.headers['x-api-key']).toBe('txo-secret')
  })

  it('applies the production write gate to writes', async () => {
    const layer = Api.Default.pipe(
      Layer.provide(makeMockConfigLayer({ ...baseResolved, isProduction: true }, null)),
      Layer.provide(makeMockAuthLayer()),
      Layer.provide(testHttpLayer({}).layer),
    )
    const program = Effect.gen(function* () {
      const api = yield* Api
      return yield* api.connection('POST')
    }).pipe(Effect.flip)
    const err = await Effect.runPromise(Effect.provide(program, layer))
    expect(err._tag).toBe('WriteRequiresExplicit')
  })
})
