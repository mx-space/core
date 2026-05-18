import { Effect, Exit, Layer } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { Config } from '../../src/services/Config'
import { Profile } from '../../src/services/Profile'
import { makeMemFs, TestFsLive, TestPathLive } from '../helper/test-fs'

const makeLayer = () => {
  const mem = makeMemFs()
  const fsLayer = TestFsLive(mem)
  const baseLayer = Layer.merge(fsLayer, TestPathLive)
  const configLayer = Config.Default.pipe(Layer.provide(baseLayer))
  const profileLayer = Profile.Default.pipe(Layer.provide(configLayer))
  return {
    mem,
    layer: Layer.mergeAll(baseLayer, configLayer, profileLayer),
  }
}

const tagOf = (cause: any): string | undefined => {
  const err = cause?.error ?? cause?.failure ?? cause
  return err?._tag ?? err?.error?._tag ?? err?.failure?._tag
}

beforeEach(() => {
  process.env.XDG_CONFIG_HOME = '/xdg'
  delete process.env.MXS_PROFILE
})

afterEach(() => {
  delete process.env.XDG_CONFIG_HOME
  delete process.env.MXS_PROFILE
})

describe('Profile.validateName', () => {
  const cases: Array<[string, boolean, string]> = [
    ['default', true, 'common'],
    ['dev', true, 'common'],
    ['my-blog', true, 'hyphen'],
    ['my_blog', true, 'underscore'],
    ['a', true, 'single char'],
    ['a'.repeat(32), true, '32 chars'],
    ['', false, 'empty'],
    ['current', false, 'reserved'],
    ['Current', false, 'uppercase'],
    ['PROD', false, 'uppercase letters'],
    ['my blog', false, 'space'],
    ['my/blog', false, 'slash'],
    ['a'.repeat(33), false, 'too long'],
    ['a.b', false, 'dot'],
  ]
  for (const [name, ok, why] of cases) {
    it(`${ok ? 'accepts' : 'rejects'} ${JSON.stringify(name)} (${why})`, async () => {
      const { layer } = makeLayer()
      const exit = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const profile = yield* Profile
          yield* profile.validateName(name)
        }).pipe(Effect.provide(layer)),
      )
      if (ok) {
        expect(Exit.isSuccess(exit)).toBe(true)
      } else {
        expect(Exit.isFailure(exit)).toBe(true)
        if (Exit.isFailure(exit)) {
          expect(tagOf(exit.cause)).toBe('ProfileInvalidName')
        }
      }
    })
  }
})

describe('Profile.list', () => {
  it('returns empty when profiles dir absent', async () => {
    const { layer } = makeLayer()
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const profile = yield* Profile
        return yield* profile.list
      }).pipe(Effect.provide(layer)),
    )
    expect(result).toEqual([])
  })

  it('lists profile directories sorted', async () => {
    const { mem, layer } = makeLayer()
    mem.mkdir('/xdg/mxs/profiles/dev')
    mem.mkdir('/xdg/mxs/profiles/prod')
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const profile = yield* Profile
        return yield* profile.list
      }).pipe(Effect.provide(layer)),
    )
    expect(result).toEqual(['dev', 'prod'])
  })

  it('ignores hidden directories', async () => {
    const { mem, layer } = makeLayer()
    mem.mkdir('/xdg/mxs/profiles/dev')
    mem.mkdir('/xdg/mxs/profiles/.hidden')
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const profile = yield* Profile
        return yield* profile.list
      }).pipe(Effect.provide(layer)),
    )
    expect(result).toEqual(['dev'])
  })

  it('ignores file entries', async () => {
    const { mem, layer } = makeLayer()
    mem.mkdir('/xdg/mxs/profiles')
    mem.mkdir('/xdg/mxs/profiles/dev')
    mem.seed('/xdg/mxs/profiles/readme.txt', 'hello')
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const profile = yield* Profile
        return yield* profile.list
      }).pipe(Effect.provide(layer)),
    )
    expect(result).toEqual(['dev'])
  })
})

describe('Profile.current', () => {
  it('returns null when current pointer absent', async () => {
    const { layer } = makeLayer()
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const profile = yield* Profile
        return yield* profile.current
      }).pipe(Effect.provide(layer)),
    )
    expect(result).toBeNull()
  })

  it('returns trimmed pointer', async () => {
    const { mem, layer } = makeLayer()
    mem.seed('/xdg/mxs/current', 'prod\n')
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const profile = yield* Profile
        return yield* profile.current
      }).pipe(Effect.provide(layer)),
    )
    expect(result).toBe('prod')
  })

  it('returns null when pointer is whitespace only', async () => {
    const { mem, layer } = makeLayer()
    mem.seed('/xdg/mxs/current', '  \n')
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const profile = yield* Profile
        return yield* profile.current
      }).pipe(Effect.provide(layer)),
    )
    expect(result).toBeNull()
  })
})

describe('Profile.use', () => {
  it('writes the current pointer when profile exists', async () => {
    const { mem, layer } = makeLayer()
    mem.mkdir('/xdg/mxs/profiles/dev')
    await Effect.runPromise(
      Effect.gen(function* () {
        const profile = yield* Profile
        yield* profile.use('dev')
      }).pipe(Effect.provide(layer)),
    )
    expect(mem.readFile('/xdg/mxs/current')?.trim()).toBe('dev')
  })

  it('rejects unknown profile with ProfileNotFound', async () => {
    const { layer } = makeLayer()
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const profile = yield* Profile
        yield* profile.use('ghost')
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) expect(tagOf(exit.cause)).toBe('ProfileNotFound')
  })

  it('rejects reserved name with ProfileInvalidName', async () => {
    const { layer } = makeLayer()
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const profile = yield* Profile
        yield* profile.use('current')
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit))
      expect(tagOf(exit.cause)).toBe('ProfileInvalidName')
  })
})

describe('Profile.mark', () => {
  it('sets production=true when requested', async () => {
    const { layer } = makeLayer()
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        yield* config.writeProfileConfig('dev', {
          api_url: 'https://dev.example.com',
        })
        const profile = yield* Profile
        return yield* profile.mark('dev', { production: true })
      }).pipe(Effect.provide(layer)),
    )
    expect(result.production).toBe(true)
  })

  it('removes production flag when set to false', async () => {
    const { layer } = makeLayer()
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        yield* config.writeProfileConfig('prod', {
          api_url: 'https://prod.example.com',
          production: true,
        })
        const profile = yield* Profile
        return yield* profile.mark('prod', { production: false })
      }).pipe(Effect.provide(layer)),
    )
    expect(result.production).toBeUndefined()
  })

  it('fails on missing profile', async () => {
    const { layer } = makeLayer()
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const profile = yield* Profile
        return yield* profile.mark('ghost', { production: true })
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) expect(tagOf(exit.cause)).toBe('ProfileNotFound')
  })
})

describe('Profile.rm', () => {
  it('removes an existing profile directory', async () => {
    const { mem, layer } = makeLayer()
    await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        yield* config.writeProfileConfig('dev', {
          api_url: 'https://dev.example.com',
        })
        const profile = yield* Profile
        yield* profile.rm('dev')
      }).pipe(Effect.provide(layer)),
    )
    expect(mem.has('/xdg/mxs/profiles/dev')).toBe(false)
  })

  it('fails with ResourceNotFound when profile absent', async () => {
    const { layer } = makeLayer()
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const profile = yield* Profile
        yield* profile.rm('ghost')
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) expect(tagOf(exit.cause)).toBe('ResourceNotFound')
  })
})

describe('Profile.show', () => {
  it('returns summary with auth + active flags', async () => {
    const { mem, layer } = makeLayer()
    mem.seed('/xdg/mxs/current', 'dev\n')
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        yield* config.writeProfileConfig('dev', {
          api_url: 'https://dev.example.com',
          production: false,
        })
        yield* config.writeProfileCredentials('dev', {
          access_token: 'tok',
          expires_at: 100,
        })
        const profile = yield* Profile
        return yield* profile.show('dev')
      }).pipe(Effect.provide(layer)),
    )
    expect(result).toEqual({
      name: 'dev',
      apiUrl: 'https://dev.example.com',
      production: false,
      authenticated: true,
      active: true,
    })
  })

  it('fails with ProfileNotFound when absent', async () => {
    const { layer } = makeLayer()
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const profile = yield* Profile
        return yield* profile.show('ghost')
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) expect(tagOf(exit.cause)).toBe('ProfileNotFound')
  })
})

describe('Profile.resolve', () => {
  it('proxies through Config.resolve and yields ResolvedConfig', async () => {
    const { layer } = makeLayer()
    process.env.MXS_PROFILE = 'dev'
    const r = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config
        yield* config.writeProfileConfig('dev', {
          api_url: 'https://dev.example.com',
        })
        const profile = yield* Profile
        return yield* profile.resolve()
      }).pipe(Effect.provide(layer)),
    )
    expect(r.apiUrl).toBe('https://dev.example.com')
    expect(r.profileName).toBe('dev')
  })
})
