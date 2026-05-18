import { Effect, Exit, Layer } from 'effect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { logout } from '../../../src/cli/auth/logout'
import { whoami } from '../../../src/cli/auth/whoami'
import { Auth, type AuthService } from '../../../src/services/Auth'
import { Config } from '../../../src/services/Config'
import { Profile } from '../../../src/services/Profile'
import {
  Renderer,
  type OutputOptions,
} from '../../../src/services/Renderer'
import { makeMemFs, TestFsLive, TestPathLive } from '../../helper/test-fs'

const XDG = '/xdg'
const mxsDir = `${XDG}/mxs`
const profileDir = (name: string) => `${mxsDir}/profiles/${name}`

const captureStdout = (): { restore: () => void; data: string[] } => {
  const data: string[] = []
  const orig = process.stdout.write.bind(process.stdout)
  ;(process.stdout as any).write = (s: any) => {
    data.push(typeof s === 'string' ? s : s.toString())
    return true
  }
  return {
    data,
    restore: () => {
      ;(process.stdout as any).write = orig
    },
  }
}

const makeAuthMock = (overrides: Partial<AuthService> = {}): AuthService => ({
  probe: () => Effect.die('probe not used'),
  requestDeviceCode: () => Effect.die('requestDeviceCode not used'),
  pollDeviceToken: () => Effect.die('pollDeviceToken not used'),
  refresh: () => Effect.succeed(null),
  login: () => Effect.die('login not used'),
  logout: () => Effect.void,
  whoami: Effect.die('whoami not used'),
  status: Effect.die('status not used'),
  ensureFresh: () =>
    Effect.die('ensureFresh not used') as ReturnType<
      AuthService['ensureFresh']
    >,
  enrichUser: (_profile, _authBase, cred) => Effect.succeed(cred),
  ...overrides,
})

const rendererJson: OutputOptions = {
  json: true,
  output: 'json',
  quiet: false,
  verbose: false,
}

const buildLayer = (authOverride: Partial<AuthService> = {}) => {
  const mem = makeMemFs()
  const base = Layer.merge(TestFsLive(mem), TestPathLive)
  const configLayer = Config.Default.pipe(Layer.provide(base))
  const profileLayer = Profile.Default.pipe(Layer.provide(configLayer))
  const authLayer = Layer.succeed(Auth, makeAuthMock(authOverride))
  return {
    mem,
    layer: Layer.mergeAll(
      base,
      configLayer,
      profileLayer,
      authLayer,
      Renderer.Default,
    ),
  }
}

beforeEach(() => {
  process.env.XDG_CONFIG_HOME = XDG
})

afterEach(() => {
  delete process.env.XDG_CONFIG_HOME
  vi.restoreAllMocks()
})

describe('auth logout command', () => {
  it('fails when no active profile exists', async () => {
    const { layer } = buildLayer()
    const exit = await Effect.runPromiseExit(
      logout.handler({}).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it('logs out the active profile and emits success', async () => {
    const logoutSpy = vi.fn(() => Effect.void)
    const { mem, layer } = buildLayer({ logout: logoutSpy })
    mem.seed(`${mxsDir}/current`, 'prod\n')
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        logout.handler({}).pipe(
          Effect.provide(layer),
          Renderer.withOptions(rendererJson),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(logoutSpy).toHaveBeenCalledWith('prod')
      expect(stdout.data.join('')).toContain('"ok":true')
    } finally {
      stdout.restore()
    }
  })
})

describe('auth whoami command', () => {
  it('fails when no credentials or override auth are available', async () => {
    const { mem, layer } = buildLayer()
    mem.mkdir(profileDir('prod'))
    mem.seed(
      `${profileDir('prod')}/config.json`,
      JSON.stringify({ api_url: 'https://blog.example.com' }),
    )
    mem.seed(`${mxsDir}/current`, 'prod\n')
    const exit = await Effect.runPromiseExit(
      whoami.handler({}).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it('emits refreshed user information for the active profile', async () => {
    const { mem, layer } = buildLayer({
      ensureFresh: () =>
        Effect.succeed({
          access_token: 'NEW',
          expires_at: Date.now() + 3600_000,
          user: { id: 'u2', email: 'fresh@example.com', name: 'Fresh' },
        }),
    })
    mem.mkdir(profileDir('prod'))
    mem.seed(
      `${profileDir('prod')}/config.json`,
      JSON.stringify({ api_url: 'https://blog.example.com' }),
    )
    mem.seed(
      `${profileDir('prod')}/credentials.json`,
      JSON.stringify({
        access_token: 'OLD',
        expires_at: Date.now() + 1_000,
        user: { id: 'u1', email: 'old@example.com' },
      }),
      0o600,
    )
    mem.seed(`${mxsDir}/current`, 'prod\n')
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        whoami.handler({}).pipe(
          Effect.provide(layer),
          Renderer.withOptions(rendererJson),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      const out = stdout.data.join('')
      expect(out).toContain('fresh@example.com')
      expect(out).toContain('https://blog.example.com')
    } finally {
      stdout.restore()
    }
  })
})
