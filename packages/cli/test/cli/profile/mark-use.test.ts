import { Effect, Exit, Layer, Option } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { mark } from '../../../src/cli/profile/mark'
import { use } from '../../../src/cli/profile/use'
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

const tagOf = (cause: any): string | undefined => {
  const err = cause?.error ?? cause?.failure ?? cause
  return err?._tag ?? err?.error?._tag ?? err?.failure?._tag
}

beforeEach(() => {
  process.env.XDG_CONFIG_HOME = XDG
})

afterEach(() => {
  delete process.env.XDG_CONFIG_HOME
})

describe('profile use command', () => {
  it('fails ProfileNotFound when the profile does not exist', async () => {
    const { layer } = buildHarness()
    const exit = await Effect.runPromiseExit(
      use.handler({ name: 'ghost' }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(tagOf(exit.cause)).toBe('ProfileNotFound')
    }
  })

  it('writes the current pointer when the profile exists', async () => {
    const { mem, layer } = buildHarness()
    mem.mkdir(profileDir('staging'))
    mem.seed(`${profileDir('staging')}/config.json`, JSON.stringify({}))

    const exit = await Effect.runPromiseExit(
      use.handler({ name: 'staging' }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(mem.readFile(`${mxsDir}/current`)?.trim()).toBe('staging')
  })
})

describe('profile mark command', () => {
  it('fails ValidationFailed when neither --production nor --no-production is passed', async () => {
    const { mem, layer } = buildHarness()
    mem.mkdir(profileDir('staging'))
    mem.seed(`${profileDir('staging')}/config.json`, JSON.stringify({}))

    const exit = await Effect.runPromiseExit(
      mark
        .handler({ name: 'staging', production: Option.none() })
        .pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(tagOf(exit.cause)).toBe('ValidationFailed')
    }
  })

  it('flips production: true on the profile config', async () => {
    const { mem, layer } = buildHarness()
    mem.mkdir(profileDir('staging'))
    mem.seed(
      `${profileDir('staging')}/config.json`,
      JSON.stringify({ api_url: 'https://stg.example.com' }),
    )

    const exit = await Effect.runPromiseExit(
      mark
        .handler({ name: 'staging', production: Option.some(true) })
        .pipe(Effect.provide(layer)),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    const cfg = JSON.parse(
      mem.readFile(`${profileDir('staging')}/config.json`) ?? '{}',
    )
    expect(cfg.production).toBe(true)
    expect(cfg.api_url).toBe('https://stg.example.com')
  })

  it('strips production when --no-production is passed', async () => {
    const { mem, layer } = buildHarness()
    mem.mkdir(profileDir('staging'))
    mem.seed(
      `${profileDir('staging')}/config.json`,
      JSON.stringify({ api_url: 'https://stg.example.com', production: true }),
    )

    const exit = await Effect.runPromiseExit(
      mark
        .handler({ name: 'staging', production: Option.some(false) })
        .pipe(Effect.provide(layer)),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    const cfg = JSON.parse(
      mem.readFile(`${profileDir('staging')}/config.json`) ?? '{}',
    )
    expect(cfg.production).toBeUndefined()
  })
})
