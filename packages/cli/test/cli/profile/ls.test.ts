import { Effect, Exit, Layer } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ls } from '../../../src/cli/profile/ls'
import { Config } from '../../../src/services/Config'
import { Profile } from '../../../src/services/Profile'
import { Renderer } from '../../../src/services/Renderer'
import { makeMemFs, type MemFs, TestFsLive, TestPathLive } from '../../helper/test-fs'

const XDG = '/xdg'
const mxsDir = `${XDG}/mxs`
const profileDir = (name: string) => `${mxsDir}/profiles/${name}`

const buildHarness = (): { mem: MemFs; layer: Layer.Layer<any> } => {
  const mem = makeMemFs()
  const base = Layer.merge(TestFsLive(mem), TestPathLive)
  const configLayer = Config.Default.pipe(Layer.provide(base))
  const profileLayer = Profile.Default.pipe(Layer.provide(configLayer))
  return {
    mem,
    layer: Layer.mergeAll(base, configLayer, profileLayer, Renderer.Default),
  }
}

const captureStdout = () => {
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
})

describe('profile ls command', () => {
  it('emits an empty list when no profiles exist', async () => {
    const { layer } = buildHarness()
    const cap = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        ls.handler({}).pipe(
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
      expect(stdout).toContain('"ok":true')
      expect(stdout).toContain('"data":[]')
    } finally {
      cap.restore()
    }
  })

  it('marks the active profile with a star', async () => {
    const { mem, layer } = buildHarness()
    mem.mkdir(profileDir('staging'))
    mem.seed(
      `${profileDir('staging')}/config.json`,
      JSON.stringify({ api_url: 'https://stg.example.com', production: false }),
    )
    mem.mkdir(profileDir('prod'))
    mem.seed(
      `${profileDir('prod')}/config.json`,
      JSON.stringify({ api_url: 'https://blog.example.com', production: true }),
    )
    mem.seed(`${mxsDir}/current`, 'prod\n', 0o644)

    const cap = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        ls.handler({}).pipe(
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
      const parsed = JSON.parse(stdout.trim())
      expect(parsed.ok).toBe(true)
      const rows = parsed.data as Array<{
        current: string
        name: string
        api_url: string
        production: string
      }>
      const byName = new Map(rows.map((r) => [r.name, r]))
      expect(byName.get('prod')?.current).toBe('*')
      expect(byName.get('staging')?.current).toBe('')
      expect(byName.get('prod')?.production).toBe('yes')
      expect(byName.get('staging')?.production).toBe('no')
    } finally {
      cap.restore()
    }
  })
})
