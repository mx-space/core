import { Effect, Exit, Layer, Option } from 'effect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { updateCmd as update } from '../../src/cli/update'
import { UpdatePmUnknown } from '../../src/domain/errors'
import { Editor, type EditorService } from '../../src/services/Editor'
import { Renderer } from '../../src/services/Renderer'
import * as UpdaterMod from '../../src/services/UpdateNotifier'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const tagOf = (cause: any): string | undefined => {
  const err = cause?.error ?? cause?.failure ?? cause
  return err?._tag ?? err?.error?._tag ?? err?.failure?._tag
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

const captureStderr = () => {
  const data: string[] = []
  const orig = process.stderr.write.bind(process.stderr)
  ;(process.stderr as any).write = (s: any) => {
    data.push(typeof s === 'string' ? s : s.toString())
    return true
  }
  return {
    data,
    restore: () => {
      ;(process.stderr as any).write = orig
    },
  }
}

const makeEditor = (overrides: Partial<EditorService> = {}): EditorService => ({
  openEditor: () => Effect.succeed(''),
  prompt: () => Effect.succeed(''),
  confirm: () => Effect.succeed(true),
  readFileOrStdin: () => Effect.succeed(''),
  ...overrides,
})

const buildLayer = (
  editorOverride: Partial<EditorService> = {},
): Layer.Layer<Renderer | Editor> =>
  Layer.mergeAll(
    Renderer.Default,
    Layer.succeed(Editor, makeEditor(editorOverride)),
  )

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('update command', () => {
  it('emits up_to_date envelope when local >= registry latest', async () => {
    vi.spyOn(UpdaterMod, 'make').mockReturnValue({
      maybeNotify: () => Effect.void,
      runUpdate: () =>
        Effect.succeed({
          fromVersion: '0.3.0',
          toVersion: '0.3.0',
          pm: 'pnpm',
          channel: 'stable',
          status: 0,
          upgraded: false,
          dryRun: true,
          upToDate: true,
        }),
    })

    const cap = captureStdout()
    const errCap = captureStderr()
    try {
      const exit = await Effect.runPromiseExit(
        update
          .handler({
            check: Option.none(),
            prerelease: Option.none(),
            pm: Option.none(),
            force: Option.none(),
            yes: Option.some(true),
          })
          .pipe(
            Effect.provide(buildLayer()),
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
      expect(stdout).toContain('"up_to_date":true')
    } finally {
      cap.restore()
      errCap.restore()
    }
  })

  it('emits dry_run envelope when --check is set', async () => {
    vi.spyOn(UpdaterMod, 'make').mockReturnValue({
      maybeNotify: () => Effect.void,
      runUpdate: (opts: any) =>
        Effect.succeed({
          fromVersion: opts.currentVersion,
          toVersion: '0.4.0',
          pm: 'npm',
          channel: 'stable',
          status: 0,
          upgraded: false,
          dryRun: true,
          upToDate: false,
        }),
    })

    const cap = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        update
          .handler({
            check: Option.some(true),
            prerelease: Option.none(),
            pm: Option.none(),
            force: Option.none(),
            yes: Option.none(),
          })
          .pipe(
            Effect.provide(buildLayer()),
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
      expect(parsed.data.latest).toBe('0.4.0')
      expect(parsed.data.up_to_date).toBe(false)
    } finally {
      cap.restore()
    }
  })

  it('emits upgraded envelope when runUpdate succeeds and an install ran', async () => {
    vi.spyOn(UpdaterMod, 'make').mockReturnValue({
      maybeNotify: () => Effect.void,
      runUpdate: () =>
        Effect.succeed({
          fromVersion: '0.3.0',
          toVersion: '0.4.0',
          pm: 'pnpm',
          channel: 'stable',
          status: 0,
          upgraded: true,
          dryRun: false,
          upToDate: false,
          command: 'pnpm add -g @mx-space/cli@latest',
        }),
    })

    const cap = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        update
          .handler({
            check: Option.none(),
            prerelease: Option.none(),
            pm: Option.none(),
            force: Option.none(),
            yes: Option.some(true),
          })
          .pipe(
            Effect.provide(buildLayer()),
            Renderer.withOptions({
              json: true,
              output: 'json',
              quiet: false,
              verbose: false,
            }),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      const parsed = JSON.parse(cap.data.join('').trim())
      expect(parsed.data.upgraded).toBe(true)
      expect(parsed.data.latest).toBe('0.4.0')
    } finally {
      cap.restore()
    }
  })

  it('passes option flags through and emits cancelled envelope', async () => {
    const runUpdate = vi.fn((opts: any) => {
      const channel: 'stable' | 'next' = opts.prerelease ? 'next' : 'stable'
      return Effect.succeed({
        fromVersion: opts.currentVersion,
        toVersion: '0.4.0',
        pm: opts.pm,
        channel,
        status: 0,
        upgraded: false,
        dryRun: true,
        upToDate: false,
        command: 'pnpm add -g @mx-space/cli@next',
        cancelled: true,
      })
    })
    vi.spyOn(UpdaterMod, 'make').mockReturnValue({
      maybeNotify: () => Effect.void,
      runUpdate,
    })

    const cap = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        update
          .handler({
            check: Option.none(),
            prerelease: Option.some(true),
            pm: Option.some('pnpm'),
            force: Option.some(true),
            yes: Option.some(false),
          })
          .pipe(
            Effect.provide(buildLayer()),
            Renderer.withOptions({
              json: true,
              output: 'json',
              quiet: false,
              verbose: false,
            }),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(runUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          prerelease: true,
          pm: 'pnpm',
          force: true,
          yes: false,
          json: true,
        }),
      )
      const parsed = JSON.parse(cap.data.join('').trim())
      expect(parsed.data).toMatchObject({
        latest: '0.4.0',
        pm: 'pnpm',
        cancelled: true,
      })
    } finally {
      cap.restore()
    }
  })

  it('emits dry_run command envelope when no install ran outside --check', async () => {
    vi.spyOn(UpdaterMod, 'make').mockReturnValue({
      maybeNotify: () => Effect.void,
      runUpdate: () =>
        Effect.succeed({
          fromVersion: '0.3.0',
          toVersion: '0.4.0',
          pm: 'npm',
          channel: 'stable',
          status: 0,
          upgraded: false,
          dryRun: true,
          upToDate: false,
          command: 'npm install -g @mx-space/cli@latest',
        }),
    })

    const cap = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        update
          .handler({
            check: Option.none(),
            prerelease: Option.none(),
            pm: Option.none(),
            force: Option.none(),
            yes: Option.none(),
          })
          .pipe(
            Effect.provide(buildLayer()),
            Renderer.withOptions({
              json: true,
              output: 'json',
              quiet: false,
              verbose: false,
            }),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      const parsed = JSON.parse(cap.data.join('').trim())
      expect(parsed.data).toMatchObject({
        command: 'npm install -g @mx-space/cli@latest',
        dry_run: true,
      })
    } finally {
      cap.restore()
    }
  })

  it('surfaces UpdatePmUnknown when the underlying service fails', async () => {
    vi.spyOn(UpdaterMod, 'make').mockReturnValue({
      maybeNotify: () => Effect.void,
      runUpdate: () =>
        Effect.fail(
          new UpdatePmUnknown({
            message: "unknown package manager 'foo'",
            hint: 'supported values: npm | pnpm | yarn | bun',
          }),
        ),
    })

    const exit = await Effect.runPromiseExit(
      update
        .handler({
          check: Option.none(),
          prerelease: Option.none(),
          pm: Option.some('npm'),
          force: Option.none(),
          yes: Option.some(true),
        })
        .pipe(
          Effect.provide(buildLayer()),
          Renderer.withOptions({
            json: true,
            output: 'json',
            quiet: false,
            verbose: false,
          }),
        ),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(tagOf(exit.cause)).toBe('UpdatePmUnknown')
    }
  })
})
