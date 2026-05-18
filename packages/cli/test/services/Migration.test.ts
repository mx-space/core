import { Effect, Exit, Layer } from 'effect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Config } from '../../src/services/Config'
import { Migration } from '../../src/services/Migration'
import { makeMemFs, TestFsLive, TestPathLive } from '../helper/test-fs'

const makeLayer = () => {
  const mem = makeMemFs()
  const fsLayer = TestFsLive(mem)
  const baseLayer = Layer.merge(fsLayer, TestPathLive)
  const configLayer = Config.Default.pipe(Layer.provide(baseLayer))
  const migLayer = Migration.Default.pipe(
    Layer.provide(Layer.merge(baseLayer, configLayer)),
  )
  return {
    mem,
    layer: Layer.mergeAll(baseLayer, configLayer, migLayer),
  }
}

const tagOf = (cause: any): string | undefined => {
  const err = cause?.error ?? cause?.failure ?? cause
  return err?._tag ?? err?.error?._tag ?? err?.failure?._tag
}

beforeEach(() => {
  process.env.XDG_CONFIG_HOME = '/xdg'
})

afterEach(() => {
  delete process.env.XDG_CONFIG_HOME
})

describe('no-op when no legacy files', () => {
  it('returns null and touches nothing', async () => {
    const { mem, layer } = makeLayer()
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const mig = yield* Migration
        return yield* mig.runLegacyMigrationIfNeeded({
          isTTY: false,
          report: null,
        })
      }).pipe(Effect.provide(layer)),
    )
    expect(result).toBeNull()
    expect([...mem.nodes.keys()]).toHaveLength(0)
  })

  it('returns null when only mxs dir exists', async () => {
    const { mem, layer } = makeLayer()
    mem.mkdir('/xdg/mxs')
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const mig = yield* Migration
        return yield* mig.runLegacyMigrationIfNeeded({
          isTTY: false,
          report: null,
        })
      }).pipe(Effect.provide(layer)),
    )
    expect(result).toBeNull()
  })
})

describe('full migration — TTY says production=true', () => {
  it('migrates and marks production=true', async () => {
    const { mem, layer } = makeLayer()
    mem.seed(
      '/xdg/mxs/config.json',
      JSON.stringify({ api_url: 'https://blog.example.com' }),
    )
    mem.seed(
      '/xdg/mxs/credentials.json',
      JSON.stringify({ access_token: 'tok-abc', expires_at: 9999 }),
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const mig = yield* Migration
        return yield* mig.runLegacyMigrationIfNeeded({
          isTTY: true,
          promptIsProduction: async () => true,
          report: null,
        })
      }).pipe(Effect.provide(layer)),
    )

    expect(result).toMatchObject({
      profile: 'default',
      production: true,
      cleanedStaleLegacy: false,
    })
    const cfg = JSON.parse(
      mem.readFile('/xdg/mxs/profiles/default/config.json') ?? '{}',
    )
    expect(cfg.api_url).toBe('https://blog.example.com')
    expect(cfg.production).toBe(true)
    const creds = JSON.parse(
      mem.readFile('/xdg/mxs/profiles/default/credentials.json') ?? '{}',
    )
    expect(creds.access_token).toBe('tok-abc')
    expect(mem.has('/xdg/mxs/config.json')).toBe(false)
    expect(mem.has('/xdg/mxs/credentials.json')).toBe(false)
    expect(mem.readFile('/xdg/mxs/current')?.trim()).toBe('default')
  })
})

describe('full migration — TTY says production=false', () => {
  it('omits production flag', async () => {
    const { mem, layer } = makeLayer()
    mem.seed(
      '/xdg/mxs/config.json',
      JSON.stringify({ api_url: 'https://blog.example.com' }),
    )
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const mig = yield* Migration
        return yield* mig.runLegacyMigrationIfNeeded({
          isTTY: true,
          promptIsProduction: async () => false,
          report: null,
        })
      }).pipe(Effect.provide(layer)),
    )
    expect(result?.production).toBe(false)
    const cfg = JSON.parse(
      mem.readFile('/xdg/mxs/profiles/default/config.json') ?? '{}',
    )
    expect(cfg.production).not.toBe(true)
  })
})

describe('full migration — non-TTY', () => {
  it('skips prompt and migrates silently', async () => {
    const { mem, layer } = makeLayer()
    mem.seed(
      '/xdg/mxs/config.json',
      JSON.stringify({ api_url: 'https://blog.example.com' }),
    )
    mem.seed(
      '/xdg/mxs/credentials.json',
      JSON.stringify({ access_token: 'tok', expires_at: 1 }),
    )
    const promptSpy = vi.fn()
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const mig = yield* Migration
        return yield* mig.runLegacyMigrationIfNeeded({
          isTTY: false,
          promptIsProduction: promptSpy as any,
          report: null,
        })
      }).pipe(Effect.provide(layer)),
    )
    expect(promptSpy).not.toHaveBeenCalled()
    expect(result?.profile).toBe('default')
    expect(result?.production).toBe(false)
    expect(mem.has('/xdg/mxs/config.json')).toBe(false)
    expect(mem.has('/xdg/mxs/credentials.json')).toBe(false)
  })
})

describe('full migration — partial inputs', () => {
  it('handles only config.json', async () => {
    const { mem, layer } = makeLayer()
    mem.seed(
      '/xdg/mxs/config.json',
      JSON.stringify({ api_url: 'https://blog.example.com' }),
    )
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const mig = yield* Migration
        return yield* mig.runLegacyMigrationIfNeeded({
          isTTY: false,
          report: null,
        })
      }).pipe(Effect.provide(layer)),
    )
    expect(result?.profile).toBe('default')
    expect(mem.has('/xdg/mxs/profiles/default/credentials.json')).toBe(false)
  })

  it('writes empty config when only credentials present', async () => {
    const { mem, layer } = makeLayer()
    mem.seed(
      '/xdg/mxs/credentials.json',
      JSON.stringify({ access_token: 'tok', expires_at: 1 }),
    )
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const mig = yield* Migration
        return yield* mig.runLegacyMigrationIfNeeded({
          isTTY: false,
          report: null,
        })
      }).pipe(Effect.provide(layer)),
    )
    expect(result?.profile).toBe('default')
    expect(mem.has('/xdg/mxs/profiles/default/config.json')).toBe(true)
    expect(mem.has('/xdg/mxs/profiles/default/credentials.json')).toBe(true)
  })
})

describe('stale-legacy cleanup', () => {
  it('removes legacy files when profiles/ exists', async () => {
    const { mem, layer } = makeLayer()
    mem.mkdir('/xdg/mxs/profiles/some-existing')
    mem.seed(
      '/xdg/mxs/profiles/some-existing/config.json',
      JSON.stringify({ api_url: 'https://existing.example.com' }),
    )
    mem.seed(
      '/xdg/mxs/config.json',
      JSON.stringify({ api_url: 'https://stale.example.com' }),
    )
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const mig = yield* Migration
        return yield* mig.runLegacyMigrationIfNeeded({
          isTTY: false,
          report: null,
        })
      }).pipe(Effect.provide(layer)),
    )
    expect(result).toMatchObject({
      profile: null,
      production: false,
      cleanedStaleLegacy: true,
    })
    expect(mem.has('/xdg/mxs/config.json')).toBe(false)
    expect(mem.has('/xdg/mxs/profiles/some-existing/config.json')).toBe(true)
    expect(mem.has('/xdg/mxs/current')).toBe(false)
  })

  it('removes both legacy files when stale', async () => {
    const { mem, layer } = makeLayer()
    mem.mkdir('/xdg/mxs/profiles/dev')
    mem.seed('/xdg/mxs/config.json', '{}')
    mem.seed('/xdg/mxs/credentials.json', '{}')
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const mig = yield* Migration
        return yield* mig.runLegacyMigrationIfNeeded({
          isTTY: false,
          report: null,
        })
      }).pipe(Effect.provide(layer)),
    )
    expect(result?.cleanedStaleLegacy).toBe(true)
    expect(mem.has('/xdg/mxs/config.json')).toBe(false)
    expect(mem.has('/xdg/mxs/credentials.json')).toBe(false)
  })
})

describe('idempotency', () => {
  it('second call returns null after successful migration', async () => {
    const { mem, layer } = makeLayer()
    mem.seed(
      '/xdg/mxs/config.json',
      JSON.stringify({ api_url: 'https://blog.example.com' }),
    )
    const program = Effect.gen(function* () {
      const mig = yield* Migration
      const first = yield* mig.runLegacyMigrationIfNeeded({
        isTTY: false,
        report: null,
      })
      const second = yield* mig.runLegacyMigrationIfNeeded({
        isTTY: false,
        report: null,
      })
      return { first, second }
    })
    const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
    expect(result.first?.profile).toBe('default')
    expect(result.second).toBeNull()
  })
})

describe('report suppression', () => {
  it('report callback receives status line on migrate', async () => {
    const { mem, layer } = makeLayer()
    mem.seed(
      '/xdg/mxs/config.json',
      JSON.stringify({ api_url: 'https://blog.example.com' }),
    )
    const lines: string[] = []
    await Effect.runPromise(
      Effect.gen(function* () {
        const mig = yield* Migration
        yield* mig.runLegacyMigrationIfNeeded({
          isTTY: false,
          report: (line) => lines.push(line),
        })
      }).pipe(Effect.provide(layer)),
    )
    expect(
      lines.some((l) =>
        l.includes("migrated single-profile config to profile 'default'"),
      ),
    ).toBe(true)
  })

  it('stale-cleanup emits a warning line', async () => {
    const { mem, layer } = makeLayer()
    mem.mkdir('/xdg/mxs/profiles/dev')
    mem.seed('/xdg/mxs/config.json', '{}')
    const lines: string[] = []
    await Effect.runPromise(
      Effect.gen(function* () {
        const mig = yield* Migration
        yield* mig.runLegacyMigrationIfNeeded({
          isTTY: false,
          report: (line) => lines.push(line),
        })
      }).pipe(Effect.provide(layer)),
    )
    expect(lines.some((l) => l.includes('stale legacy config files'))).toBe(
      true,
    )
  })

  it('report=null suppresses all output', async () => {
    const { mem, layer } = makeLayer()
    mem.seed(
      '/xdg/mxs/config.json',
      JSON.stringify({ api_url: 'https://blog.example.com' }),
    )
    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)
    try {
      await Effect.runPromise(
        Effect.gen(function* () {
          const mig = yield* Migration
          yield* mig.runLegacyMigrationIfNeeded({
            isTTY: false,
            report: null,
          })
        }).pipe(Effect.provide(layer)),
      )
    } finally {
      stderrSpy.mockRestore()
    }
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  it('uses process.stderr when no report callback is supplied', async () => {
    const { mem, layer } = makeLayer()
    mem.seed(
      '/xdg/mxs/config.json',
      JSON.stringify({ api_url: 'https://blog.example.com' }),
    )
    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)
    try {
      await Effect.runPromise(
        Effect.gen(function* () {
          const mig = yield* Migration
          yield* mig.runLegacyMigrationIfNeeded({ isTTY: false })
        }).pipe(Effect.provide(layer)),
      )
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "migrated single-profile config to profile 'default'",
        ),
      )
    } finally {
      stderrSpy.mockRestore()
    }
  })
})

describe('promptIsProduction cancellation', () => {
  it('treats symbol return as production=false', async () => {
    const { mem, layer } = makeLayer()
    mem.seed(
      '/xdg/mxs/config.json',
      JSON.stringify({ api_url: 'https://blog.example.com' }),
    )
    const cancelSymbol = Symbol('test-cancel')
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const mig = yield* Migration
        return yield* mig.runLegacyMigrationIfNeeded({
          isTTY: true,
          promptIsProduction: async () => cancelSymbol,
          report: null,
        })
      }).pipe(Effect.provide(layer)),
    )
    expect(result?.production).toBe(false)
    expect(result?.profile).toBe('default')
    expect(mem.readFile('/xdg/mxs/current')?.trim()).toBe('default')
  })
})

describe('failure modes', () => {
  it('rejects with ConfigMigrationFailed on corrupt config json', async () => {
    const { mem, layer } = makeLayer()
    mem.seed('/xdg/mxs/config.json', 'this is not json{')
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const mig = yield* Migration
        return yield* mig.runLegacyMigrationIfNeeded({
          isTTY: false,
          report: null,
        })
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(tagOf(exit.cause)).toBe('ConfigMigrationFailed')
    }
    // Legacy file must NOT be deleted — rejection happened during read.
    expect(mem.has('/xdg/mxs/config.json')).toBe(true)
  })

  it('rejects with ConfigMigrationFailed on corrupt credentials json', async () => {
    const { mem, layer } = makeLayer()
    mem.seed(
      '/xdg/mxs/config.json',
      JSON.stringify({ api_url: 'https://blog.example.com' }),
    )
    mem.seed('/xdg/mxs/credentials.json', '{')
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const mig = yield* Migration
        return yield* mig.runLegacyMigrationIfNeeded({
          isTTY: false,
          report: null,
        })
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(tagOf(exit.cause)).toBe('ConfigMigrationFailed')
    }
    expect(mem.has('/xdg/mxs/credentials.json')).toBe(true)
  })

  it('rejects with ConfigMigrationFailed when the production prompt fails', async () => {
    const { mem, layer } = makeLayer()
    mem.seed(
      '/xdg/mxs/config.json',
      JSON.stringify({ api_url: 'https://blog.example.com' }),
    )
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const mig = yield* Migration
        return yield* mig.runLegacyMigrationIfNeeded({
          isTTY: true,
          promptIsProduction: async () => {
            throw new Error('prompt unavailable')
          },
          report: null,
        })
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(tagOf(exit.cause)).toBe('ConfigMigrationFailed')
    }
    expect(mem.has('/xdg/mxs/config.json')).toBe(true)
  })
})

describe('file mode preservation', () => {
  it('profile dir has mode 0700', async () => {
    const { mem, layer } = makeLayer()
    mem.seed(
      '/xdg/mxs/config.json',
      JSON.stringify({ api_url: 'https://blog.example.com' }),
    )
    await Effect.runPromise(
      Effect.gen(function* () {
        const mig = yield* Migration
        yield* mig.runLegacyMigrationIfNeeded({ isTTY: false, report: null })
      }).pipe(Effect.provide(layer)),
    )
    expect(mem.mode('/xdg/mxs/profiles/default')).toBe(0o700)
  })

  it('credentials.json has mode 0600', async () => {
    const { mem, layer } = makeLayer()
    mem.seed(
      '/xdg/mxs/config.json',
      JSON.stringify({ api_url: 'https://blog.example.com' }),
    )
    mem.seed(
      '/xdg/mxs/credentials.json',
      JSON.stringify({ access_token: 't', expires_at: 0 }),
    )
    await Effect.runPromise(
      Effect.gen(function* () {
        const mig = yield* Migration
        yield* mig.runLegacyMigrationIfNeeded({ isTTY: false, report: null })
      }).pipe(Effect.provide(layer)),
    )
    expect(mem.mode('/xdg/mxs/profiles/default/credentials.json')).toBe(0o600)
  })

  it('config.json has mode 0644', async () => {
    const { mem, layer } = makeLayer()
    mem.seed(
      '/xdg/mxs/config.json',
      JSON.stringify({ api_url: 'https://blog.example.com' }),
    )
    await Effect.runPromise(
      Effect.gen(function* () {
        const mig = yield* Migration
        yield* mig.runLegacyMigrationIfNeeded({ isTTY: false, report: null })
      }).pipe(Effect.provide(layer)),
    )
    expect(mem.mode('/xdg/mxs/profiles/default/config.json')).toBe(0o644)
  })
})
