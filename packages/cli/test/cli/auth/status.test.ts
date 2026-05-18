import { Effect, Exit, Layer } from 'effect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { status } from '../../../src/cli/auth/status'
import { Config } from '../../../src/services/Config'
import { Renderer } from '../../../src/services/Renderer'
import { makeMemFs, TestFsLive, TestPathLive } from '../../helper/test-fs'

const XDG = '/xdg'

const mxsDir = `${XDG}/mxs`
const profileDir = (name: string) => `${mxsDir}/profiles/${name}`

const buildLayer = () => {
  const mem = makeMemFs()
  const base = Layer.merge(TestFsLive(mem), TestPathLive)
  const configLayer = Config.Default.pipe(Layer.provide(base))
  return {
    mem,
    layer: Layer.mergeAll(base, configLayer, Renderer.Default),
  }
}

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

beforeEach(() => {
  process.env.XDG_CONFIG_HOME = XDG
  delete process.env.MXS_PROFILE
})

afterEach(() => {
  delete process.env.XDG_CONFIG_HOME
  delete process.env.MXS_PROFILE
  vi.restoreAllMocks()
})

describe('auth status command', () => {
  it('emits authenticated: false when no credentials are stored', async () => {
    const { layer } = buildLayer()
    const cap = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        status.handler({}).pipe(
          Effect.provide(layer),
          Renderer.withOptions({
            json: true,
            output: 'json',
            quiet: false,
            verbose: false,
          }),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      const stdout = cap.data.join('')
      expect(stdout).toContain('"authenticated":false')
    } finally {
      cap.restore()
    }
  })

  it('emits authenticated: true and expiring_soon when token is near expiry', async () => {
    const { mem, layer } = buildLayer()
    mem.mkdir(profileDir('prod'))
    mem.seed(
      `${profileDir('prod')}/credentials.json`,
      JSON.stringify({
        access_token: 'TOK',
        refresh_token: 'rt',
        expires_at: Date.now() + 5_000,
        user: { id: 'u1', email: 'owner@example.com' },
      }),
      0o600,
    )
    mem.seed(`${mxsDir}/current`, 'prod\n', 0o644)

    const cap = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        status.handler({}).pipe(
          Effect.provide(layer),
          Renderer.withOptions({
            json: true,
            output: 'json',
            quiet: false,
            verbose: false,
          }),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      const stdout = cap.data.join('')
      expect(stdout).toContain('"authenticated":true')
      expect(stdout).toContain('"expiring_soon":true')
      expect(stdout).toContain('"has_refresh":true')
    } finally {
      cap.restore()
    }
  })
})
