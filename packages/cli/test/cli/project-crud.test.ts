import { Effect, Exit, Layer, Option } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { create as createProject } from '../../src/cli/project/create'
import { del as deleteProject } from '../../src/cli/project/delete'
import { edit as editProject } from '../../src/cli/project/edit'
import { get as getProject } from '../../src/cli/project/get'
import { list as listProject } from '../../src/cli/project/list'
import { update as updateProject } from '../../src/cli/project/update'
import { viewCmd as viewProject } from '../../src/cli/project/view-cmd'
import { Api, type ApiService } from '../../src/services/Api'
import { Editor, type EditorService } from '../../src/services/Editor'
import { Renderer, type OutputOptions } from '../../src/services/Renderer'
import { Resolver, type ResolverService } from '../../src/services/Resolver'
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

const makeResolver = (id = '900000000000000001'): ResolverService => ({
  resolveCategory: () => Effect.succeed('cat-id'),
  resolveTopic: () => Effect.succeed('topic-id'),
  resolveCategoryRefs: (refs) => Effect.succeed(refs),
  resolvePostId: () => Effect.succeed('123456789012345'),
  resolvePostReadPath: () => Effect.succeed('/posts/p/x'),
  resolveNoteId: () => Effect.succeed('123456789012346'),
  resolveCategoryId: () => Effect.succeed('cat-id'),
  resolveProjectId: () => Effect.succeed(id),
  invalidate: () => Effect.void,
})

const makeApi = (
  calls: Array<{ path: string; options: unknown }>,
  responses: Record<string, unknown> = {},
): ApiService => ({
  request: (path, options) =>
    Effect.sync(() => {
      calls.push({ path, options })
      return (responses[path] ?? {
        id: '900000000000000001',
        name: 'k',
        description: 'd',
      }) as never
    }),
  raw: (path, options) =>
    Effect.sync(() => {
      calls.push({ path, options })
      return responses[path] ?? { ok: true }
    }),
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
    Layer.succeed(Resolver, makeResolver()),
    Renderer.Default,
    ...(editor ? [Layer.succeed(Editor, editor)] : []),
  )

afterEach(() => {
  vi.restoreAllMocks()
})

const none = <A>() => Option.none<A>()

describe('project command handlers', () => {
  it('lists projects with pagination flags', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        listProject
          .handler({ page: Option.some(2), size: Option.some(20) })
          .pipe(
            Effect.provide(buildLayer(calls)),
            Renderer.withOptions(rendererJson),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls[0]).toMatchObject({
        path: '/projects',
        options: { query: { page: 2, size: 20 } },
      })
    } finally {
      stdout.restore()
    }
  })

  it('gets a project by resolved id', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        getProject.handler({ nameOrId: 'kami' }).pipe(
          Effect.provide(buildLayer(calls)),
          Renderer.withOptions(rendererJson),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls[0]).toMatchObject({
        path: '/projects/900000000000000001',
      })
    } finally {
      stdout.restore()
    }
  })

  it('renders a project view', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        viewProject.handler({ nameOrId: 'kami' }).pipe(
          Effect.provide(buildLayer(calls)),
          Renderer.withOptions(rendererJson),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
    } finally {
      stdout.restore()
    }
  })

  it('creates a project from flags', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        createProject
          .handler({
            name: Option.some('kami'),
            description: Option.some('a stack'),
            previewUrl: Option.some('https://kami.test'),
            docUrl: none(),
            projectUrl: none(),
            avatar: none(),
            images: Option.some('https://a, https://b'),
            text: none(),
            file: none(),
            open: false,
            silent: false,
          })
          .pipe(
            Effect.provide(buildLayer(calls)),
            Renderer.withOptions(rendererJson),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls[0]).toMatchObject({
        path: '/projects',
        options: { method: 'POST' },
      })
      const body = (
        calls[0]!.options as { body: Record<string, unknown> }
      ).body
      expect(body).toMatchObject({
        name: 'kami',
        description: 'a stack',
        previewUrl: 'https://kami.test',
        images: ['https://a', 'https://b'],
      })
      expect(body.docUrl).toBeUndefined()
    } finally {
      stdout.restore()
    }
  })

  it('PATCHes via update with only supplied fields', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const exit = await Effect.runPromiseExit(
      updateProject
        .handler({
          nameOrId: 'kami',
          name: none(),
          description: Option.some('updated'),
          previewUrl: none(),
          docUrl: none(),
          projectUrl: none(),
          avatar: none(),
          images: none(),
          text: none(),
          file: none(),
          open: false,
          silent: true,
        })
        .pipe(
          Effect.provide(buildLayer(calls)),
          Renderer.withOptions(rendererJson),
        ),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(calls[0]).toMatchObject({
      path: '/projects/900000000000000001',
      options: { method: 'PATCH' },
    })
    const body = (calls[0]!.options as { body: Record<string, unknown> }).body
    expect(body).toEqual({ description: 'updated' })
  })

  it('deletes a project when --force is supplied', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        deleteProject
          .handler({ nameOrId: 'kami', force: true })
          .pipe(
            Effect.provide(buildLayer(calls)),
            Renderer.withOptions(rendererJson),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls[0]).toMatchObject({
        path: '/projects/900000000000000001',
        options: { method: 'DELETE' },
      })
    } finally {
      stdout.restore()
    }
  })

  it('refuses project delete without --force in non-TTY', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: false,
    })
    try {
      const exit = await Effect.runPromiseExit(
        deleteProject
          .handler({ nameOrId: 'kami', force: false })
          .pipe(Effect.provide(buildLayer([]))),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    } finally {
      if (descriptor)
        Object.defineProperty(process.stdin, 'isTTY', descriptor)
    }
  })

  it('edit: no-change exits without a PATCH', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const responses = {
      '/projects/900000000000000001': {
        id: '900000000000000001',
        name: 'kami',
        description: 'k',
        previewUrl: null,
        docUrl: null,
        projectUrl: null,
        avatar: null,
        images: null,
        text: null,
      },
    }
    const editor: EditorService = {
      openEditor: (opts) => Effect.succeed(opts.initialContent),
      prompt: () => Effect.succeed(''),
      confirm: () => Effect.succeed(true),
      readFileOrStdin: () => Effect.succeed(''),
    }
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        editProject
          .handler({ nameOrId: 'kami', open: false, silent: false })
          .pipe(
            Effect.provide(buildLayer(calls, responses, editor)),
            Renderer.withOptions(rendererJson),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls).toHaveLength(1)
      expect(calls[0]!.path).toBe('/projects/900000000000000001')
    } finally {
      stdout.restore()
    }
  })

  it('edit: round-trip change PATCHes parsed JSON', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const responses = {
      '/projects/900000000000000001': {
        id: '900000000000000001',
        name: 'kami',
        description: 'k',
        previewUrl: null,
        docUrl: null,
        projectUrl: null,
        avatar: null,
        images: null,
        text: null,
      },
    }
    const editor: EditorService = {
      openEditor: () =>
        Effect.succeed(
          JSON.stringify(
            {
              name: 'kami',
              description: 'renamed',
              previewUrl: 'https://k.test',
              docUrl: null,
              projectUrl: null,
              avatar: null,
              images: null,
              text: null,
            },
            null,
            2,
          ),
        ),
      prompt: () => Effect.succeed(''),
      confirm: () => Effect.succeed(true),
      readFileOrStdin: () => Effect.succeed(''),
    }
    const exit = await Effect.runPromiseExit(
      editProject
        .handler({ nameOrId: 'kami', open: false, silent: true })
        .pipe(
          Effect.provide(buildLayer(calls, responses, editor)),
          Renderer.withOptions(rendererJson),
        ),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(calls).toHaveLength(2)
    expect(calls[1]).toMatchObject({
      path: '/projects/900000000000000001',
      options: { method: 'PATCH' },
    })
    const body = (calls[1]!.options as { body: Record<string, unknown> }).body
    expect(body).toMatchObject({
      description: 'renamed',
      previewUrl: 'https://k.test',
    })
  })

  it('edit: malformed JSON fails with ValidationJson', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const responses = {
      '/projects/900000000000000001': {
        id: '900000000000000001',
        name: 'kami',
        description: 'k',
        previewUrl: null,
        docUrl: null,
        projectUrl: null,
        avatar: null,
        images: null,
        text: null,
      },
    }
    const editor: EditorService = {
      openEditor: () => Effect.succeed('not json at all'),
      prompt: () => Effect.succeed(''),
      confirm: () => Effect.succeed(true),
      readFileOrStdin: () => Effect.succeed(''),
    }
    const exit = await Effect.runPromiseExit(
      editProject
        .handler({ nameOrId: 'kami', open: false, silent: false })
        .pipe(Effect.provide(buildLayer(calls, responses, editor))),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const failure = exit.cause.toString()
      expect(failure).toContain('ValidationJson')
    }
  })
})
