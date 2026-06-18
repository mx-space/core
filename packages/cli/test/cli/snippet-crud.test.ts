import { Effect, Exit, Layer, Option } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { create as putSnippet } from '../../src/cli/snippet/create'
import { del as deleteSnippet } from '../../src/cli/snippet/delete'
import { edit as editSnippet } from '../../src/cli/snippet/edit'
import { get as getSnippet } from '../../src/cli/snippet/get'
import { list as listSnippet } from '../../src/cli/snippet/list'
import { update as moveSnippet } from '../../src/cli/snippet/update'
import { Api, type ApiService } from '../../src/services/Api'
import { Editor, type EditorService } from '../../src/services/Editor'
import { Renderer, type OutputOptions } from '../../src/services/Renderer'
import { makeMemFs, TestFsLive, TestPathLive } from '../helper/test-fs'

const rendererJson: OutputOptions = {
  json: true,
  output: 'json',
  quiet: false,
  verbose: false,
}

const captureStdout = (): { restore: () => void } => {
  const orig = process.stdout.write.bind(process.stdout)
  ;(process.stdout as any).write = () => true
  return {
    restore: () => {
      ;(process.stdout as any).write = orig
    },
  }
}

const SNIPPET_ID = '900000000000000001'

const fullSnippet = {
  id: SNIPPET_ID,
  path: 'root/config.json',
  type: 'json',
  raw: '{"a":1}',
  private: true,
  comment: 'old comment',
  metatype: null,
  schema: null,
  method: null,
  secret: null,
  enable: true,
}

const makeApi = (
  calls: Array<{ path: string; options: unknown }>,
  responses: Record<string, unknown> = {},
): ApiService => ({
  request: (path, options) =>
    Effect.sync(() => {
      calls.push({ path, options })
      return (responses[path] ?? { id: SNIPPET_ID }) as never
    }),
  raw: (path, options) =>
    Effect.sync(() => {
      calls.push({ path, options })
      return responses[path] ?? { ok: true }
    }),
})

const makeEditor = (
  overrides: Partial<EditorService> = {},
): EditorService => ({
  openEditor: (opts) => Effect.succeed(opts.initialContent),
  prompt: () => Effect.succeed(''),
  confirm: () => Effect.succeed(true),
  readFileOrStdin: () => Effect.succeed(''),
  ...overrides,
})

const buildLayer = (
  calls: Array<{ path: string; options: unknown }>,
  responses: Record<string, unknown> = {},
  editor?: EditorService,
) =>
  Layer.mergeAll(
    TestFsLive(makeMemFs()),
    TestPathLive,
    Layer.succeed(Api, makeApi(calls, responses)),
    Renderer.Default,
    Layer.succeed(Editor, editor ?? makeEditor()),
  )

const withStdinTty = (value: boolean): (() => void) => {
  const descriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
  Object.defineProperty(process.stdin, 'isTTY', {
    configurable: true,
    value,
  })
  return () => {
    if (descriptor) Object.defineProperty(process.stdin, 'isTTY', descriptor)
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

const none = <A>() => Option.none<A>()

const writeFlags = {
  type: Option.none(),
  file: none<string>(),
  raw: none<string>(),
  comment: none<string>(),
  method: Option.none(),
  metatype: none<string>(),
  schema: none<string>(),
  secret: none<string>(),
  private: false,
  noPrivate: false,
  enable: false,
  noEnable: false,
}

describe('snippet VFS command handlers', () => {
  it('lists snippet paths by prefix', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        listSnippet
          .handler({
            prefix: Option.some('sk/'),
            limit: Option.some(20),
            recursive: true,
          })
          .pipe(
            Effect.provide(buildLayer(calls)),
            Renderer.withOptions(rendererJson),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls[0]).toMatchObject({
        path: '/snippets',
        options: { query: { prefix: 'sk/', limit: 20, recursive: true } },
      })
    } finally {
      stdout.restore()
    }
  })

  it('gets a snippet by path', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        getSnippet.handler({ target: 'root/config.json' }).pipe(
          Effect.provide(buildLayer(calls)),
          Renderer.withOptions(rendererJson),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls[0]).toMatchObject({
        path: '/snippets/by-path',
        options: { query: { path: 'root/config.json' } },
      })
    } finally {
      stdout.restore()
    }
  })

  it('gets a snippet by snowflake id directly', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        getSnippet.handler({ target: SNIPPET_ID }).pipe(
          Effect.provide(buildLayer(calls)),
          Renderer.withOptions(rendererJson),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls[0]!.path).toBe(`/snippets/${SNIPPET_ID}`)
    } finally {
      stdout.restore()
    }
  })

  it('puts a snippet from --raw', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        putSnippet
          .handler({
            path: 'root/config.json',
            ...writeFlags,
            type: Option.some('json' as const),
            raw: Option.some('{"b":2}'),
            private: true,
          })
          .pipe(
            Effect.provide(buildLayer(calls)),
            Renderer.withOptions(rendererJson),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls[0]).toMatchObject({
        path: '/snippets/by-path',
        options: { method: 'PUT' },
      })
      const body = (calls[0]!.options as { body: Record<string, unknown> })
        .body
      expect(body).toEqual({
        path: 'root/config.json',
        type: 'json',
        raw: '{"b":2}',
        private: true,
      })
    } finally {
      stdout.restore()
    }
  })

  it('put falls back to piped stdin when no source flag is given', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const editor = makeEditor({
      readFileOrStdin: () => Effect.succeed('from stdin'),
    })
    const restoreTty = withStdinTty(false)
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        putSnippet.handler({ path: 'root/config.txt', ...writeFlags }).pipe(
          Effect.provide(buildLayer(calls, {}, editor)),
          Renderer.withOptions(rendererJson),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      const body = (calls[0]!.options as { body: Record<string, unknown> })
        .body
      expect(body.raw).toBe('from stdin')
    } finally {
      stdout.restore()
      restoreTty()
    }
  })

  it('moves a snippet path', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        moveSnippet
          .handler({
            from: 'sk/foo/',
            to: 'sk/bar/',
            recursive: true,
          })
          .pipe(
            Effect.provide(buildLayer(calls)),
            Renderer.withOptions(rendererJson),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls[0]).toMatchObject({
        path: '/snippets/move',
        options: {
          method: 'POST',
          body: { from: 'sk/foo/', to: 'sk/bar/', recursive: true },
        },
      })
    } finally {
      stdout.restore()
    }
  })

  it('edit: unchanged buffer exits without a PUT', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const responses = {
      [`/snippets/${SNIPPET_ID}`]: fullSnippet,
    }
    const filenames: string[] = []
    const editor = makeEditor({
      openEditor: (opts) =>
        Effect.sync(() => {
          filenames.push(opts.filename)
          return opts.initialContent
        }),
    })
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        editSnippet.handler({ target: SNIPPET_ID }).pipe(
          Effect.provide(buildLayer(calls, responses, editor)),
          Renderer.withOptions(rendererJson),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls).toHaveLength(1)
      expect(filenames).toEqual(['snippet.json'])
    } finally {
      stdout.restore()
    }
  })

  it('edit: changed path buffer PUTs by path', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const responses = {
      '/snippets/by-path': fullSnippet,
    }
    const editor = makeEditor({
      openEditor: () => Effect.succeed('{"a":3}'),
    })
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        editSnippet.handler({ target: 'root/config.json' }).pipe(
          Effect.provide(buildLayer(calls, responses, editor)),
          Renderer.withOptions(rendererJson),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls[1]).toMatchObject({
        path: '/snippets/by-path',
        options: { method: 'PUT' },
      })
      const body = (calls[1]!.options as { body: Record<string, unknown> })
        .body
      expect(body.raw).toBe('{"a":3}')
      expect(body.path).toBe('root/config.json')
    } finally {
      stdout.restore()
    }
  })

  it('deletes a snippet path when --force is supplied', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        deleteSnippet
          .handler({ target: 'sk/foo/', force: true, recursive: true })
          .pipe(
            Effect.provide(buildLayer(calls)),
            Renderer.withOptions(rendererJson),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls[0]).toMatchObject({
        path: '/snippets/by-path',
        options: {
          method: 'DELETE',
          query: { path: 'sk/foo/', recursive: true },
        },
      })
    } finally {
      stdout.restore()
    }
  })

  it('refuses snippet delete without --force in non-TTY', async () => {
    const restoreTty = withStdinTty(false)
    try {
      const exit = await Effect.runPromiseExit(
        deleteSnippet
          .handler({ target: SNIPPET_ID, force: false, recursive: false })
          .pipe(Effect.provide(buildLayer([]))),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    } finally {
      restoreTty()
    }
  })
})
