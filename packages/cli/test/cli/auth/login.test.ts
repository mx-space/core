import { Effect, Exit, Layer, Option } from 'effect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { login } from '../../../src/cli/auth/login'
import { Auth, type AuthService } from '../../../src/services/Auth'
import { Config } from '../../../src/services/Config'
import { Editor, type EditorService } from '../../../src/services/Editor'
import { Profile } from '../../../src/services/Profile'
import {
  currentOutputOptions,
  defaultOutputOptions,
  Renderer,
} from '../../../src/services/Renderer'
import { makeMemFs, type MemFs, TestFsLive, TestPathLive } from '../../helper/test-fs'

vi.mock('open', () => ({ default: vi.fn().mockResolvedValue(undefined) }))

// ---------------------------------------------------------------------------
// Layer builders
// ---------------------------------------------------------------------------

const mxsDir = (xdg: string) => `${xdg}/mxs`
const profileDir = (xdg: string, name: string) =>
  `${mxsDir(xdg)}/profiles/${name}`

const makeAuthMock = (overrides: Partial<AuthService> = {}): AuthService => ({
  probe: () =>
    Effect.succeed({
      apiUrl: 'https://blog.example.com',
      apiBase: 'https://blog.example.com/api/v2',
      authBase: 'https://blog.example.com/api/v2/auth',
      apiVersion: 2,
    }),
  requestDeviceCode: () =>
    Effect.succeed({
      device_code: 'dcode',
      user_code: 'ABCD-1234',
      verification_uri: 'https://blog.example.com/api/v2/auth/device',
      verification_uri_complete:
        'https://blog.example.com/api/v2/auth/device?code=ABCD-1234',
      expires_in: 300,
      interval: 1,
    }),
  pollDeviceToken: () =>
    Effect.succeed({
      access_token: 'new-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
      user: { id: 'u1', email: 'owner@example.com', name: 'Owner' },
    }),
  refresh: () => Effect.succeed(null),
  login: () => Effect.never as any,
  logout: () => Effect.void,
  whoami: Effect.never as any,
  status: Effect.never as any,
  ensureFresh: () => Effect.never as any,
  enrichUser: (_profile, _authBase, cred) => Effect.succeed(cred),
  ...overrides,
})

const makeEditorMock = (
  overrides: Partial<EditorService> = {},
): EditorService => ({
  openEditor: () => Effect.succeed(''),
  prompt: () => Effect.succeed('https://blog.example.com'),
  confirm: () => Effect.succeed(true),
  readFileOrStdin: () => Effect.succeed(''),
  ...overrides,
})

interface Harness {
  readonly mem: MemFs
  readonly layer: Layer.Layer<Config | Profile | Renderer | Auth | Editor>
}

const buildHarness = (
  authOverride: Partial<AuthService> = {},
  editorOverride: Partial<EditorService> = {},
): Harness => {
  const mem = makeMemFs()
  const fsLayer = TestFsLive(mem)
  const base = Layer.merge(fsLayer, TestPathLive)
  const configLayer = Config.Default.pipe(Layer.provide(base))
  const profileLayer = Profile.Default.pipe(Layer.provide(configLayer))
  const authLayer = Layer.succeed(Auth, makeAuthMock(authOverride))
  const editorLayer = Layer.succeed(Editor, makeEditorMock(editorOverride))
  const rendererLayer = Renderer.Default

  const layer = Layer.mergeAll(
    base,
    configLayer,
    profileLayer,
    authLayer,
    editorLayer,
    rendererLayer,
  )
  return { mem, layer }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const XDG = '/xdg'

beforeEach(() => {
  process.env.XDG_CONFIG_HOME = XDG
  delete process.env.MXS_PROFILE
  delete process.env.MXS_API_URL
  delete process.env.MXS_CLI_LOCAL_DEV
})

afterEach(() => {
  delete process.env.XDG_CONFIG_HOME
})

describe('auth login command', () => {
  it('writes credentials to the default profile on a fresh install', async () => {
    const promptSpy = vi.fn(() => Effect.succeed('https://blog.example.com'))
    const { mem, layer } = buildHarness({}, { prompt: promptSpy as any })

    const exit = await Effect.runPromiseExit(
      login.handler({ production: Option.none() }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isSuccess(exit)).toBe(true)

    // Prompted because no profile pointer and no apiUrl.
    expect(promptSpy).toHaveBeenCalledTimes(1)

    const credsPath = `${profileDir(XDG, 'default')}/credentials.json`
    const cfgPath = `${profileDir(XDG, 'default')}/config.json`
    const creds = JSON.parse(mem.readFile(credsPath) ?? '{}')
    const cfg = JSON.parse(mem.readFile(cfgPath) ?? '{}')
    expect(creds.access_token).toBe('new-access-token')
    expect(cfg.api_url).toBe('https://blog.example.com')
    expect(cfg.production).toBeUndefined()

    const current = mem.readFile(`${mxsDir(XDG)}/current`)?.trim()
    expect(current).toBe('default')
  })

  it('honours --production and writes the profile production flag', async () => {
    const { mem, layer } = buildHarness()

    const exit = await Effect.runPromiseExit(
      login
        .handler({ production: Option.some(true) })
        .pipe(Effect.provide(layer)),
    )
    expect(Exit.isSuccess(exit)).toBe(true)

    const cfg = JSON.parse(
      mem.readFile(`${profileDir(XDG, 'default')}/config.json`) ?? '{}',
    )
    expect(cfg.production).toBe(true)
  })

  it('reuses the active profile when one exists', async () => {
    const mem = makeMemFs()
    const profDir = profileDir(XDG, 'staging')
    mem.mkdir(profDir)
    mem.seed(`${profDir}/config.json`, JSON.stringify({}), 0o644)
    mem.seed(`${mxsDir(XDG)}/current`, 'staging\n', 0o644)

    const fsLayer = TestFsLive(mem)
    const base = Layer.merge(fsLayer, TestPathLive)
    const configLayer = Config.Default.pipe(Layer.provide(base))
    const profileLayer = Profile.Default.pipe(Layer.provide(configLayer))
    const authLayer = Layer.succeed(Auth, makeAuthMock())
    const editorLayer = Layer.succeed(Editor, makeEditorMock())
    const layer = Layer.mergeAll(
      base,
      configLayer,
      profileLayer,
      authLayer,
      editorLayer,
      Renderer.Default,
    )

    // Pre-seed the profile config with api_url so Profile.resolve succeeds
    // without prompting.
    mem.seed(
      `${profDir}/config.json`,
      JSON.stringify({ api_url: 'https://blog.example.com' }),
      0o644,
    )

    const exit = await Effect.runPromiseExit(
      login.handler({ production: Option.none() }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isSuccess(exit)).toBe(true)

    const creds = JSON.parse(
      mem.readFile(`${profDir}/credentials.json`) ?? '{}',
    )
    expect(creds.access_token).toBe('new-access-token')
    expect(mem.readFile(`${mxsDir(XDG)}/current`)?.trim()).toBe('staging')
  })

  it('fails when the fresh-install API URL prompt is blank', async () => {
    const { layer } = buildHarness(
      {},
      { prompt: () => Effect.succeed('   ') },
    )
    const exit = await Effect.runPromiseExit(
      login.handler({ production: Option.none() }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it('emits the device-code response in JSON mode before polling', async () => {
    const stdout: string[] = []
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: any) => {
        stdout.push(String(chunk))
        return true
      })
    const { mem, layer } = buildHarness()
    try {
      const exit = await Effect.runPromiseExit(
        Effect.locally(
          login.handler({ production: Option.some(false) }),
          currentOutputOptions,
          { ...defaultOutputOptions, json: true },
        ).pipe(Effect.provide(layer)),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      const first = JSON.parse(stdout[0]!)
      expect(first.data).toMatchObject({
        verification_uri: 'https://blog.example.com/api/v2/auth/device',
        user_code: 'ABCD-1234',
        expires_in: 300,
      })
      const cfg = JSON.parse(
        mem.readFile(`${profileDir(XDG, 'default')}/config.json`) ?? '{}',
      )
      expect(cfg.production).toBe(false)
    } finally {
      writeSpy.mockRestore()
    }
  })

  it('prints slow_down ticks in interactive non-json mode', async () => {
    const stderr: string[] = []
    const writeSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk: any) => {
        stderr.push(String(chunk))
        return true
      })
    const { layer } = buildHarness({
      pollDeviceToken: (_authBase, _clientId, _deviceCode, opts) =>
        Effect.sync(() => {
          opts.onTick?.('slow_down')
          return {
            access_token: 'new-access-token',
            token_type: 'Bearer',
            expires_in: 3600,
          }
        }),
    })
    try {
      const exit = await Effect.runPromiseExit(
        login.handler({ production: Option.none() }).pipe(Effect.provide(layer)),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(stderr.join('')).toContain('slow_down')
    } finally {
      writeSpy.mockRestore()
    }
  })
})
