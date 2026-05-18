import { Effect, Exit, Layer, Option } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { del as deleteNote } from '../../src/cli/note/delete'
import { get as getNote } from '../../src/cli/note/get'
import { update as updateNote } from '../../src/cli/note/update'
import { del as deletePage } from '../../src/cli/page/delete'
import { del as deletePost } from '../../src/cli/post/delete'
import { get as getPost } from '../../src/cli/post/get'
import { update as updatePost } from '../../src/cli/post/update'
import { del as deleteTopic } from '../../src/cli/topic/delete'
import { update as updateTopic } from '../../src/cli/topic/update'
import { Api, type ApiService } from '../../src/services/Api'
import { Lexical } from '../../src/services/Lexical'
import {
  Renderer,
  type OutputOptions,
} from '../../src/services/Renderer'
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

const makeResolver = (): ResolverService => ({
  resolveCategory: () => Effect.succeed('cat-id'),
  resolveTopic: () => Effect.succeed('topic-id'),
  resolveCategoryRefs: (refs) => Effect.succeed(refs),
  resolvePostId: () => Effect.succeed('123456789012345'),
  resolvePostReadPath: () => Effect.succeed('/posts/tech/hello'),
  resolveNoteId: () => Effect.succeed('123456789012346'),
  resolveCategoryId: () => Effect.succeed('cat-id'),
  invalidate: () => Effect.void,
})

const makeApi = (calls: Array<{ path: string; options: unknown }>): ApiService => ({
  request: (path, options) =>
    Effect.sync(() => {
      calls.push({ path, options })
      return { id: 'resource-id', ok: true, title: 'Title' } as never
    }),
  raw: (path, options) =>
    Effect.sync(() => {
      calls.push({ path, options })
      return { id: 'resource-id', ok: true }
    }),
})

const buildLayer = (calls: Array<{ path: string; options: unknown }>) =>
  Layer.mergeAll(
    TestFsLive(makeMemFs()),
    TestPathLive,
    Layer.succeed(Api, makeApi(calls)),
    Layer.succeed(Resolver, makeResolver()),
    Renderer.Default,
    Lexical.Default,
  )

afterEach(() => {
  vi.restoreAllMocks()
})

const none = <A>() => Option.none<A>()

describe('post command CRUD handlers', () => {
  it('gets a post through the resolved read path', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        getPost.handler({ slugOrId: 'hello' }).pipe(
          Effect.provide(buildLayer(calls)),
          Renderer.withOptions(rendererJson),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls[0]).toMatchObject({
        path: '/posts/tech/hello',
        options: { query: { prefer: 'lexical' } },
      })
      expect(stdout.data.join('')).toContain('Title')
    } finally {
      stdout.restore()
    }
  })

  it('deletes a post when --force is supplied', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        deletePost.handler({ slugOrId: 'hello', force: true }).pipe(
          Effect.provide(buildLayer(calls)),
          Renderer.withOptions(rendererJson),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls[0]).toMatchObject({
        path: '/posts/123456789012345',
        options: { method: 'DELETE' },
      })
      expect(stdout.data.join('')).toContain('123456789012345')
    } finally {
      stdout.restore()
    }
  })

  it('refuses post delete without --force in non-TTY mode', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: false,
    })
    try {
      const exit = await Effect.runPromiseExit(
        deletePost.handler({ slugOrId: 'hello', force: false }).pipe(
          Effect.provide(buildLayer([])),
        ),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    } finally {
      if (descriptor) Object.defineProperty(process.stdin, 'isTTY', descriptor)
    }
  })

  it('patches a post update payload', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const exit = await Effect.runPromiseExit(
      updatePost
        .handler({
          slugOrId: 'hello',
          title: Option.some('Updated'),
          slug: none(),
          category: Option.some('tech'),
          content: none(),
          format: none(),
          summary: none(),
          state: none(),
          tags: none(),
          copyright: none(),
          pin: none(),
          pinOrder: none(),
          related: none(),
          meta: none(),
          file: none(),
        })
        .pipe(
          Effect.provide(buildLayer(calls)),
          Renderer.withOptions(rendererJson),
        ),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(calls[0]).toMatchObject({
      path: '/posts/123456789012345',
      options: { method: 'PATCH' },
    })
    expect((calls[0]!.options as { body: Record<string, unknown> }).body).toMatchObject({
      title: 'Updated',
      categoryId: 'cat-id',
    })
  })
})

describe('note command CRUD handlers', () => {
  it('gets a note by resolved id', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        getNote.handler({ slugOrId: '42' }).pipe(
          Effect.provide(buildLayer(calls)),
          Renderer.withOptions(rendererJson),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls[0]).toMatchObject({
        path: '/notes/nid/42',
        options: { query: { single: '1', prefer: 'lexical' } },
      })
      expect(stdout.data.join('')).toContain('Title')
    } finally {
      stdout.restore()
    }
  })

  it('gets a note directly by snowflake id and rejects invalid references', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const success = await Effect.runPromiseExit(
        getNote.handler({ slugOrId: '123456789012346' }).pipe(
          Effect.provide(buildLayer(calls)),
          Renderer.withOptions(rendererJson),
        ),
      )
      expect(Exit.isSuccess(success)).toBe(true)
      expect(calls[0]).toMatchObject({
        path: '/notes/123456789012346',
        options: { query: { prefer: 'lexical' } },
      })
    } finally {
      stdout.restore()
    }

    const failure = await Effect.runPromiseExit(
      getNote.handler({ slugOrId: 'not-a-note' }).pipe(
        Effect.provide(buildLayer([])),
      ),
    )
    expect(Exit.isFailure(failure)).toBe(true)
  })

  it('deletes a note when --force is supplied', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        deleteNote.handler({ slugOrId: 'note', force: true }).pipe(
          Effect.provide(buildLayer(calls)),
          Renderer.withOptions(rendererJson),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls[0]).toMatchObject({
        path: '/notes/123456789012346',
        options: { method: 'DELETE' },
      })
      expect(stdout.data.join('')).toContain('123456789012346')
    } finally {
      stdout.restore()
    }
  })

  it('refuses note delete without --force in non-TTY mode', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: false,
    })
    try {
      const exit = await Effect.runPromiseExit(
        deleteNote.handler({ slugOrId: 'note', force: false }).pipe(
          Effect.provide(buildLayer([])),
        ),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    } finally {
      if (descriptor) Object.defineProperty(process.stdin, 'isTTY', descriptor)
    }
  })

  it('patches a note update payload', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const exit = await Effect.runPromiseExit(
      updateNote
        .handler({
          slugOrId: 'note',
          title: Option.some('Updated note'),
          slug: none(),
          topic: Option.some('life'),
          content: none(),
          format: none(),
          state: none(),
          mood: none(),
          weather: none(),
          publicAt: none(),
          password: none(),
          bookmark: none(),
          coords: none(),
          location: none(),
          images: none(),
          meta: none(),
          file: none(),
        })
        .pipe(
          Effect.provide(buildLayer(calls)),
          Renderer.withOptions(rendererJson),
        ),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(calls[0]).toMatchObject({
      path: '/notes/123456789012346',
      options: { method: 'PATCH' },
    })
    expect((calls[0]!.options as { body: Record<string, unknown> }).body).toMatchObject({
      title: 'Updated note',
      topicId: 'topic-id',
    })
  })
})

describe('page and topic command handlers', () => {
  it('deletes a page by slug after resolving its id', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        deletePage.handler({ slugOrId: 'about', force: true }).pipe(
          Effect.provide(buildLayer(calls)),
          Renderer.withOptions(rendererJson),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls).toEqual([
        { path: '/pages/slug/about', options: undefined },
        { path: '/pages/resource-id', options: { method: 'DELETE' } },
      ])
      expect(stdout.data.join('')).toContain('resource-id')
    } finally {
      stdout.restore()
    }
  })

  it('deletes a page directly by snowflake id', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        deletePage.handler({ slugOrId: '123456789012347', force: true }).pipe(
          Effect.provide(buildLayer(calls)),
          Renderer.withOptions(rendererJson),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls).toEqual([
        { path: '/pages/123456789012347', options: { method: 'DELETE' } },
      ])
    } finally {
      stdout.restore()
    }
  })

  it('refuses page delete without --force in non-TTY mode', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: false,
    })
    try {
      const exit = await Effect.runPromiseExit(
        deletePage.handler({ slugOrId: 'about', force: false }).pipe(
          Effect.provide(buildLayer([])),
        ),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    } finally {
      if (descriptor) Object.defineProperty(process.stdin, 'isTTY', descriptor)
    }
  })

  it('deletes a topic by slug after resolving its id', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        deleteTopic.handler({ slugOrId: 'life', force: true }).pipe(
          Effect.provide(buildLayer(calls)),
          Renderer.withOptions(rendererJson),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls).toEqual([
        { path: '/topics/slug/life', options: undefined },
        { path: '/topics/resource-id', options: { method: 'DELETE' } },
      ])
      expect(stdout.data.join('')).toContain('resource-id')
    } finally {
      stdout.restore()
    }
  })

  it('deletes a topic directly by snowflake id', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const stdout = captureStdout()
    try {
      const exit = await Effect.runPromiseExit(
        deleteTopic.handler({ slugOrId: '123456789012348', force: true }).pipe(
          Effect.provide(buildLayer(calls)),
          Renderer.withOptions(rendererJson),
        ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls).toEqual([
        { path: '/topics/123456789012348', options: { method: 'DELETE' } },
      ])
    } finally {
      stdout.restore()
    }
  })

  it('refuses topic delete without --force in non-TTY mode', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: false,
    })
    try {
      const exit = await Effect.runPromiseExit(
        deleteTopic.handler({ slugOrId: 'life', force: false }).pipe(
          Effect.provide(buildLayer([])),
        ),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    } finally {
      if (descriptor) Object.defineProperty(process.stdin, 'isTTY', descriptor)
    }
  })

  it('patches a topic update body', async () => {
    const calls: Array<{ path: string; options: unknown }> = []
    const exit = await Effect.runPromiseExit(
      updateTopic
        .handler({
          slugOrId: 'life',
          name: Option.some('Life'),
          slug: Option.some('life-new'),
          description: Option.some('desc'),
          icon: Option.some('sparkles'),
        })
        .pipe(
          Effect.provide(buildLayer(calls)),
          Renderer.withOptions(rendererJson),
        ),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(calls[0]).toEqual({ path: '/topics/slug/life', options: undefined })
    expect(calls[1]).toMatchObject({
      path: '/topics/resource-id',
      options: { method: 'PATCH' },
    })
    expect((calls[1]!.options as { body: Record<string, unknown> }).body).toEqual({
      name: 'Life',
      slug: 'life-new',
      description: 'desc',
      icon: 'sparkles',
    })
  })
})
