import { Effect, Exit, Layer, Option } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { create as createSnippet } from '../../src/cli/snippet/create'
import { del as deleteSnippet } from '../../src/cli/snippet/delete'
import { edit as editSnippet } from '../../src/cli/snippet/edit'
import { get as getSnippet } from '../../src/cli/snippet/get'
import { list as listSnippet } from '../../src/cli/snippet/list'
import { update as updateSnippet } from '../../src/cli/snippet/update'
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

const SNIPPET_ID = '900000000000000001'

const fullSnippet = {
  id: SNIPPET_ID,
  name: 'config',
  reference: 'root',
  type: 'json',
  raw: '{"a":1}',
  private: true,
  comment: 'old comment',
  metatype: null,
  schema: null,
  method: 'GET',
  customPath: null,
  secret: null,
  enable: true,
  created: '2026-01-01T00:00:00.000Z',
  modified: '2026-01-02T00:00:00.000Z',
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
  reference: none<string>(),
  type: Option.none(),
  file: none<string>(),
  raw: none<string>(),
  comment: none<string>(),
  method: Option.none(),
  metatype: none<string>(),
  schema: none<string>(),
  customPath: none<string>(),
  secret: none<string>(),
  private: false,
  noPrivate: false,
  enable: false,
  noEnable: false,
}

describe('snippet command handlers', () => {
  it('lists snippets with pagination flags', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        listSnippet
          .handler({ page: Option.some(2), size: Option.some(20), grouped: false })
          .pipe(
            Effect.provide(buildLayer(calls)),
            Renderer.withOptions(rendererJson),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls[0]).toMatchObject({
        path: '/snippets',
        options: { query: { page: 2, size: 20 } },
      })
    } finally {
      stdout.restore()
    }
  })

  it('lists grouped snippets via /snippets/group', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        listSnippet
          .handler({ page: none(), size: none(), grouped: true })
          .pipe(
            Effect.provide(buildLayer(calls)),
            Renderer.withOptions(rendererJson),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls[0]!.path).toBe('/snippets/group')
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
      expect(calls).toHaveLength(1)
      expect(calls[0]!.path).toBe(`/snippets/${SNIPPET_ID}`)
    } finally {
      stdout.restore()
    }
  })

  it('resolves ref/name through the group listing', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const responses = {
      '/snippets/group/web': {
        data: [{ id: SNIPPET_ID, name: 'config' }],
      },
    }
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        getSnippet.handler({ target: 'web/config' }).pipe(
          Effect.provide(buildLayer(calls, responses)),
          Renderer.withOptions(rendererJson),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls[0]!.path).toBe('/snippets/group/web')
      expect(calls[1]!.path).toBe(`/snippets/${SNIPPET_ID}`)
    } finally {
      stdout.restore()
    }
  })

  it('treats a bare non-snowflake token as root/<name>', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const responses = {
      '/snippets/group/root': [{ id: SNIPPET_ID, name: 'config' }],
    }
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        getSnippet.handler({ target: 'config' }).pipe(
          Effect.provide(buildLayer(calls, responses)),
          Renderer.withOptions(rendererJson),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls[0]!.path).toBe('/snippets/group/root')
      expect(calls[1]!.path).toBe(`/snippets/${SNIPPET_ID}`)
    } finally {
      stdout.restore()
    }
  })

  it('fails with ResourceNotFound when no name matches', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const responses = {
      '/snippets/group/root': [{ id: SNIPPET_ID, name: 'other' }],
    }
    const exit = await Effect.runPromiseExit(
      getSnippet
        .handler({ target: 'missing' })
        .pipe(Effect.provide(buildLayer(calls, responses))),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(exit.cause.toString()).toContain('ResourceNotFound')
    }
  })

  it('creates a snippet from --raw', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        createSnippet
          .handler({
            name: 'config',
            ...writeFlags,
            reference: Option.some('web'),
            type: Option.some('json' as const),
            raw: Option.some('{"b":2}'),
            private: true,
            enable: true,
          })
          .pipe(
            Effect.provide(buildLayer(calls)),
            Renderer.withOptions(rendererJson),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls[0]).toMatchObject({
        path: '/snippets',
        options: { method: 'POST' },
      })
      const body = (calls[0]!.options as { body: Record<string, unknown> })
        .body
      expect(body).toEqual({
        name: 'config',
        reference: 'web',
        type: 'json',
        raw: '{"b":2}',
        private: true,
        enable: true,
      })
    } finally {
      stdout.restore()
    }
  })

  it('prefers --file over --raw and stdin', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const reads: Array<string | undefined> = []
    const editor = makeEditor({
      readFileOrStdin: (p) =>
        Effect.sync(() => {
          reads.push(p)
          return 'from file'
        }),
    })
    const restoreTty = withStdinTty(false)
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        createSnippet
          .handler({
            name: 'config',
            ...writeFlags,
            file: Option.some('/tmp/snippet.json'),
            raw: Option.some('from raw'),
          })
          .pipe(
            Effect.provide(buildLayer(calls, {}, editor)),
            Renderer.withOptions(rendererJson),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(reads).toEqual(['/tmp/snippet.json'])
      const body = (calls[0]!.options as { body: Record<string, unknown> })
        .body
      expect(body.raw).toBe('from file')
    } finally {
      stdout.restore()
      restoreTty()
    }
  })

  it('prefers --raw over stdin', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const editor = makeEditor({
      readFileOrStdin: () => Effect.succeed('from stdin'),
    })
    const restoreTty = withStdinTty(false)
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        createSnippet
          .handler({
            name: 'config',
            ...writeFlags,
            raw: Option.some('from raw'),
          })
          .pipe(
            Effect.provide(buildLayer(calls, {}, editor)),
            Renderer.withOptions(rendererJson),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      const body = (calls[0]!.options as { body: Record<string, unknown> })
        .body
      expect(body.raw).toBe('from raw')
    } finally {
      stdout.restore()
      restoreTty()
    }
  })

  it('falls back to piped stdin when no flag source is given', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const editor = makeEditor({
      readFileOrStdin: () => Effect.succeed('from stdin'),
    })
    const restoreTty = withStdinTty(false)
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        createSnippet
          .handler({ name: 'config', ...writeFlags })
          .pipe(
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

  it('create fails with ValidationFailed when non-interactive and no source', async () => {
    const restoreTty = withStdinTty(false)
    try {
      const exit = await Effect.runPromiseExit(
        createSnippet
          .handler({ name: 'config', ...writeFlags })
          .pipe(Effect.provide(buildLayer([]))),
      )
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(exit.cause.toString()).toContain('ValidationFailed')
      }
    } finally {
      restoreTty()
    }
  })

  it('create opens $EDITOR when interactive and no source', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const editor = makeEditor({
      openEditor: () => Effect.succeed('typed in editor'),
    })
    const restoreTty = withStdinTty(true)
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        createSnippet
          .handler({ name: 'config', ...writeFlags })
          .pipe(
            Effect.provide(buildLayer(calls, {}, editor)),
            Renderer.withOptions(rendererJson),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      const body = (calls[0]!.options as { body: Record<string, unknown> })
        .body
      expect(body.raw).toBe('typed in editor')
    } finally {
      stdout.restore()
      restoreTty()
    }
  })

  it('update merges changed fields onto the full snippet and PUTs', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const responses = {
      '/snippets/group/root': [{ id: SNIPPET_ID, name: 'config' }],
      [`/snippets/${SNIPPET_ID}`]: fullSnippet,
    }
    const restoreTty = withStdinTty(true)
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        updateSnippet
          .handler({
            target: 'config',
            name: none<string>(),
            ...writeFlags,
            comment: Option.some('new comment'),
            noEnable: true,
          })
          .pipe(
            Effect.provide(buildLayer(calls, responses)),
            Renderer.withOptions(rendererJson),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls[2]).toMatchObject({
        path: `/snippets/${SNIPPET_ID}`,
        options: { method: 'PUT' },
      })
      const body = (calls[2]!.options as { body: Record<string, unknown> })
        .body
      expect(body).toEqual({
        name: 'config',
        reference: 'root',
        type: 'json',
        raw: '{"a":1}',
        private: true,
        comment: 'new comment',
        metatype: null,
        schema: null,
        method: 'GET',
        customPath: null,
        secret: null,
        enable: false,
      })
      expect(body.id).toBeUndefined()
      expect(body.created).toBeUndefined()
      expect(body.modified).toBeUndefined()
    } finally {
      stdout.restore()
      restoreTty()
    }
  })

  it('update replaces raw from --raw', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const responses = {
      [`/snippets/${SNIPPET_ID}`]: fullSnippet,
    }
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        updateSnippet
          .handler({
            target: SNIPPET_ID,
            name: none<string>(),
            ...writeFlags,
            raw: Option.some('{"a":2}'),
          })
          .pipe(
            Effect.provide(buildLayer(calls, responses)),
            Renderer.withOptions(rendererJson),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      const body = (calls[1]!.options as { body: Record<string, unknown> })
        .body
      expect(body.raw).toBe('{"a":2}')
      expect(body.name).toBe('config')
    } finally {
      stdout.restore()
    }
  })

  it('update ignores piped stdin without explicit flags', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const responses = {
      [`/snippets/${SNIPPET_ID}`]: fullSnippet,
    }
    const reads: Array<string | undefined> = []
    const editor = makeEditor({
      readFileOrStdin: (p) =>
        Effect.sync(() => {
          reads.push(p)
          return 'ambient stdin'
        }),
    })
    const restoreTty = withStdinTty(false)
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        updateSnippet
          .handler({
            target: SNIPPET_ID,
            name: none<string>(),
            ...writeFlags,
            comment: Option.some('only metadata'),
          })
          .pipe(
            Effect.provide(buildLayer(calls, responses, editor)),
            Renderer.withOptions(rendererJson),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(reads).toEqual([])
      const body = (calls[1]!.options as { body: Record<string, unknown> })
        .body
      expect(body.raw).toBe('{"a":1}')
      expect(body.comment).toBe('only metadata')
    } finally {
      stdout.restore()
      restoreTty()
    }
  })

  it('update reads stdin via explicit --file -', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const responses = {
      [`/snippets/${SNIPPET_ID}`]: fullSnippet,
    }
    const reads: Array<string | undefined> = []
    const editor = makeEditor({
      readFileOrStdin: (p) =>
        Effect.sync(() => {
          reads.push(p)
          return 'from stdin'
        }),
    })
    const restoreTty = withStdinTty(false)
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        updateSnippet
          .handler({
            target: SNIPPET_ID,
            name: none<string>(),
            ...writeFlags,
            file: Option.some('-'),
          })
          .pipe(
            Effect.provide(buildLayer(calls, responses, editor)),
            Renderer.withOptions(rendererJson),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(reads).toEqual(['-'])
      const body = (calls[1]!.options as { body: Record<string, unknown> })
        .body
      expect(body.raw).toBe('from stdin')
    } finally {
      stdout.restore()
      restoreTty()
    }
  })

  it('update flips private to false via --no-private', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const responses = {
      [`/snippets/${SNIPPET_ID}`]: fullSnippet,
    }
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        updateSnippet
          .handler({
            target: SNIPPET_ID,
            name: none<string>(),
            ...writeFlags,
            noPrivate: true,
          })
          .pipe(
            Effect.provide(buildLayer(calls, responses)),
            Renderer.withOptions(rendererJson),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      const body = (calls[1]!.options as { body: Record<string, unknown> })
        .body
      expect(body.private).toBe(false)
      expect(body.raw).toBe('{"a":1}')
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
      expect(filenames).toEqual([`snippet-${SNIPPET_ID}.json`])
    } finally {
      stdout.restore()
    }
  })

  it('edit: changed buffer PUTs the full body with new raw', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const responses = {
      [`/snippets/${SNIPPET_ID}`]: fullSnippet,
    }
    const editor = makeEditor({
      openEditor: () => Effect.succeed('{"a":3}'),
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
      expect(calls[1]).toMatchObject({
        path: `/snippets/${SNIPPET_ID}`,
        options: { method: 'PUT' },
      })
      const body = (calls[1]!.options as { body: Record<string, unknown> })
        .body
      expect(body.raw).toBe('{"a":3}')
      expect(body.name).toBe('config')
      expect(body.id).toBeUndefined()
    } finally {
      stdout.restore()
    }
  })

  it('deletes a snippet when --force is supplied', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        deleteSnippet
          .handler({ target: SNIPPET_ID, force: true })
          .pipe(
            Effect.provide(buildLayer(calls)),
            Renderer.withOptions(rendererJson),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls[0]).toMatchObject({
        path: `/snippets/${SNIPPET_ID}`,
        options: { method: 'DELETE' },
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
          .handler({ target: SNIPPET_ID, force: false })
          .pipe(Effect.provide(buildLayer([]))),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    } finally {
      restoreTty()
    }
  })
})
