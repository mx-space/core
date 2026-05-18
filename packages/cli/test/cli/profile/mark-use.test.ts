import { Effect, Exit, Layer, Option } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { mark } from '../../../src/cli/profile/mark'
import { rm } from '../../../src/cli/profile/rm'
import { show } from '../../../src/cli/profile/show'
import { use } from '../../../src/cli/profile/use'
import { Editor, type EditorService } from '../../../src/services/Editor'
import { Config } from '../../../src/services/Config'
import { Profile } from '../../../src/services/Profile'
import { Renderer } from '../../../src/services/Renderer'
import { makeMemFs, type MemFs, TestFsLive, TestPathLive } from '../../helper/test-fs'

const XDG = '/xdg'
const mxsDir = `${XDG}/mxs`
const profileDir = (name: string) => `${mxsDir}/profiles/${name}`

const makeEditorMock = (
  overrides: Partial<EditorService> = {},
): EditorService => ({
  openEditor: () => Effect.succeed(''),
  prompt: () => Effect.succeed(''),
  confirm: () => Effect.succeed(true),
  readFileOrStdin: () => Effect.succeed(''),
  ...overrides,
})

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

const rendererJson = {
  json: true,
  output: 'json' as const,
  quiet: false,
  verbose: false,
}

const buildHarness = (
  editorOverride: Partial<EditorService> = {},
): { mem: MemFs; layer: Layer.Layer<any> } => {
  const mem = makeMemFs()
  const base = Layer.merge(TestFsLive(mem), TestPathLive)
  const configLayer = Config.Default.pipe(Layer.provide(base))
  const profileLayer = Profile.Default.pipe(Layer.provide(configLayer))
  const editorLayer = Layer.succeed(Editor, makeEditorMock(editorOverride))
  return {
    mem,
    layer: Layer.mergeAll(
      base,
      configLayer,
      profileLayer,
      editorLayer,
      Renderer.Default,
    ),
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

describe('profile show command', () => {
  it('fails when no profile name and no active profile exist', async () => {
    const { layer } = buildHarness()
    const exit = await Effect.runPromiseExit(
      show.handler({ name: Option.none() }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(tagOf(exit.cause)).toBe('ProfileNoneActive')
    }
  })

  it('shows the active profile with credential metadata', async () => {
    const { mem, layer } = buildHarness()
    mem.mkdir(profileDir('prod'))
    mem.seed(
      `${profileDir('prod')}/config.json`,
      JSON.stringify({ api_url: 'https://blog.example.com', production: true }),
    )
    mem.seed(
      `${profileDir('prod')}/credentials.json`,
      JSON.stringify({
        access_token: 'TOK',
        expires_at: 1_800_000_000_000,
        user: { id: 'u1', email: 'owner@example.com' },
      }),
      0o600,
    )
    mem.seed(`${mxsDir}/current`, 'prod\n')
    const cap = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        show.handler({ name: Option.none() }).pipe(
          Effect.provide(layer),
          Renderer.withOptions(rendererJson),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      const out = cap.data.join('')
      expect(out).toContain('"name":"prod"')
      expect(out).toContain('"authenticated":true')
      expect(out).toContain('owner@example.com')
    } finally {
      cap.restore()
    }
  })
})

describe('profile rm command', () => {
  it('refuses to remove the active profile without --force', async () => {
    const { mem, layer } = buildHarness()
    mem.mkdir(profileDir('prod'))
    mem.seed(`${profileDir('prod')}/config.json`, JSON.stringify({}))
    mem.seed(`${mxsDir}/current`, 'prod\n')
    const exit = await Effect.runPromiseExit(
      rm.handler({ name: 'prod', force: Option.none() }).pipe(
        Effect.provide(layer),
      ),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(tagOf(exit.cause)).toBe('ValidationFailed')
    }
  })

  it('removes the active profile with --force and clears current pointer', async () => {
    const { mem, layer } = buildHarness()
    mem.mkdir(profileDir('prod'))
    mem.seed(`${profileDir('prod')}/config.json`, JSON.stringify({}))
    mem.seed(`${mxsDir}/current`, 'prod\n')
    const exit = await Effect.runPromiseExit(
      rm.handler({ name: 'prod', force: Option.some(true) }).pipe(
        Effect.provide(layer),
        Renderer.withOptions(rendererJson),
      ),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(mem.has(profileDir('prod'))).toBe(false)
    expect(mem.has(`${mxsDir}/current`)).toBe(false)
  })

  it('returns without removal when interactive confirmation is declined', async () => {
    const { mem, layer } = buildHarness({
      confirm: () => Effect.succeed(false),
    })
    mem.mkdir(profileDir('staging'))
    mem.seed(`${profileDir('staging')}/config.json`, JSON.stringify({}))
    const descriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: true,
    })
    try {
      const exit = await Effect.runPromiseExit(
        rm.handler({ name: 'staging', force: Option.none() }).pipe(
          Effect.provide(layer),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(mem.has(profileDir('staging'))).toBe(true)
    } finally {
      if (descriptor) Object.defineProperty(process.stdin, 'isTTY', descriptor)
    }
  })

  it('refuses non-active removal without --force in non-TTY mode', async () => {
    const { mem, layer } = buildHarness()
    mem.mkdir(profileDir('staging'))
    mem.seed(`${profileDir('staging')}/config.json`, JSON.stringify({}))
    const descriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: false,
    })
    try {
      const exit = await Effect.runPromiseExit(
        rm.handler({ name: 'staging', force: Option.none() }).pipe(
          Effect.provide(layer),
        ),
      )
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(tagOf(exit.cause)).toBe('ValidationFailed')
      }
    } finally {
      if (descriptor) Object.defineProperty(process.stdin, 'isTTY', descriptor)
    }
  })
})
