import { Effect, Exit, Layer, Option } from 'effect'
import { describe, expect, it, vi } from 'vitest'

import { edit as editNote } from '../../src/cli/note/edit'
import { edit as editPage } from '../../src/cli/page/edit'
import { edit as editPost } from '../../src/cli/post/edit'
import { Api, type ApiService } from '../../src/services/Api'
import { Editor, type EditorService } from '../../src/services/Editor'
import { Lexical } from '../../src/services/Lexical'
import { Renderer } from '../../src/services/Renderer'
import { Resolver, type ResolverService } from '../../src/services/Resolver'
import { makeMemFs, TestFsLive, TestPathLive } from '../helper/test-fs'

const none = <A>() => Option.none<A>()

const makeApi = (calls: string[]): ApiService => ({
  request: (path) =>
    Effect.sync(() => {
      calls.push(path)
      if (path.startsWith('/notes/')) {
        return {
          id: '123456789012346',
          title: 'Note',
          slug: 'note',
          contentFormat: 'markdown',
          content: 'note body',
          isPublished: false,
          mood: 'calm',
          weather: 'clear',
        } as never
      }
      if (path.startsWith('/pages/')) {
        return {
          id: '123456789012347',
          title: 'Page',
          slug: 'page',
          contentFormat: 'markdown',
          content: 'page body',
        } as never
      }
      return {
        id: '123456789012345',
        title: 'Post',
        slug: 'post',
        contentFormat: 'markdown',
        content: 'post body',
        summary: 'summary',
        isPublished: true,
        tags: ['a', 'b'],
      } as never
    }),
  raw: (path) =>
    Effect.sync(() => {
      calls.push(path)
      return {}
    }),
})

const makeResolver = (): ResolverService => ({
  resolveCategory: () => Effect.succeed('cat-id'),
  resolveTopic: () => Effect.succeed('topic-id'),
  resolveCategoryRefs: (refs) => Effect.succeed(refs),
  resolvePostId: () => Effect.succeed('123456789012345'),
  resolvePostReadPath: () => Effect.succeed('/posts/post'),
  resolveNoteId: () => Effect.succeed('123456789012346'),
  resolveCategoryId: () => Effect.succeed('cat-id'),
  invalidate: () => Effect.void,
})

const makeEditor = (
  edit: (initial: string) => string = (initial) => initial,
): EditorService => ({
  openEditor: (opts) => Effect.succeed(edit(opts.initialContent)),
  prompt: () => Effect.succeed(''),
  confirm: () => Effect.succeed(true),
  readFileOrStdin: () => Effect.succeed(''),
})

const buildLayer = (
  calls: string[],
  edit?: (initial: string) => string,
) =>
  Layer.mergeAll(
    TestFsLive(makeMemFs()),
    TestPathLive,
    Layer.succeed(Api, makeApi(calls)),
    Layer.succeed(Resolver, makeResolver()),
    Layer.succeed(Editor, makeEditor(edit)),
    Renderer.Default,
    Lexical.Default,
  )

const commonPostOptions = {
  title: none<string>(),
  slug: none<string>(),
  category: none<string>(),
  content: none<string>(),
  format: none<'lexical' | 'markdown'>(),
  summary: none<string>(),
  state: none<'publish' | 'draft'>(),
  tags: none<string>(),
  copyright: none<string>(),
  pin: none<string>(),
  pinOrder: none<number>(),
  related: none<string>(),
  meta: none<string>(),
  file: none<string>(),
}

const commonNoteOptions = {
  title: none<string>(),
  slug: none<string>(),
  topic: none<string>(),
  content: none<string>(),
  format: none<'lexical' | 'markdown'>(),
  state: none<'publish' | 'draft'>(),
  mood: none<string>(),
  weather: none<string>(),
  publicAt: none<string>(),
  password: none<string>(),
  bookmark: none<string>(),
  coords: none<string>(),
  location: none<string>(),
  images: none<string>(),
  meta: none<string>(),
  file: none<string>(),
}

const commonPageOptions = {
  title: none<string>(),
  slug: none<string>(),
  subtitle: none<string>(),
  order: none<number>(),
  content: none<string>(),
  format: none<'lexical' | 'markdown'>(),
  meta: none<string>(),
  file: none<string>(),
}

describe('edit command no-change round trip', () => {
  it('post edit exits without update when editor content is unchanged', async () => {
    const calls: string[] = []
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      const exit = await Effect.runPromiseExit(
        editPost
          .handler({ slugOrId: 'post', ...commonPostOptions })
          .pipe(Effect.provide(buildLayer(calls))),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls).toEqual(['/posts/post'])
    } finally {
      stderr.mockRestore()
    }
  })

  it('note edit exits without update when editor content is unchanged', async () => {
    const calls: string[] = []
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      const exit = await Effect.runPromiseExit(
        editNote
          .handler({ slugOrId: 'note', ...commonNoteOptions })
          .pipe(Effect.provide(buildLayer(calls))),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls).toEqual(['/notes/123456789012346'])
    } finally {
      stderr.mockRestore()
    }
  })

  it('page edit exits without update when editor content is unchanged', async () => {
    const calls: string[] = []
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      const exit = await Effect.runPromiseExit(
        editPage
          .handler({ slugOrId: '123456789012347', ...commonPageOptions })
          .pipe(Effect.provide(buildLayer(calls))),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls).toEqual(['/pages/123456789012347'])
    } finally {
      stderr.mockRestore()
    }
  })

  it('post edit sends a PUT when edited envelope content changes', async () => {
    const calls: string[] = []
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    try {
      const exit = await Effect.runPromiseExit(
        editPost
          .handler({
            slugOrId: 'post',
            ...commonPostOptions,
            format: Option.some('markdown'),
          })
          .pipe(
            Effect.provide(
              buildLayer(calls, () =>
                `<mxpost>
  <meta>
    <title>Changed Post</title>
    <slug>changed-post</slug>
    <state>draft</state>
    <summary>changed summary</summary>
    <tags><tag>x</tag></tags>
  </meta>
  <content>
changed body
  </content>
</mxpost>`,
              ),
            ),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls).toEqual(['/posts/post', '/posts/123456789012345'])
    } finally {
      stdout.mockRestore()
    }
  })

  it('note edit sends a PUT when edited envelope content changes', async () => {
    const calls: string[] = []
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    try {
      const exit = await Effect.runPromiseExit(
        editNote
          .handler({
            slugOrId: 'note',
            ...commonNoteOptions,
            format: Option.some('markdown'),
          })
          .pipe(
            Effect.provide(
              buildLayer(calls, () =>
                `<mxnote>
  <meta>
    <title>Changed Note</title>
    <slug>changed-note</slug>
    <topic>life</topic>
    <state>publish</state>
    <mood>focused</mood>
    <weather>rain</weather>
    <bookmark>true</bookmark>
  </meta>
  <content>
changed note body
  </content>
</mxnote>`,
              ),
            ),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls).toEqual([
        '/notes/123456789012346',
        '/notes/123456789012346',
      ])
    } finally {
      stdout.mockRestore()
    }
  })

  it('page edit sends a PUT when edited envelope content changes', async () => {
    const calls: string[] = []
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    try {
      const exit = await Effect.runPromiseExit(
        editPage
          .handler({
            slugOrId: 'page',
            ...commonPageOptions,
            format: Option.some('markdown'),
          })
          .pipe(
            Effect.provide(
              buildLayer(calls, () =>
                `<mxpost>
  <meta>
    <title>Changed Page</title>
    <slug>changed-page</slug>
    <subtitle>Sub</subtitle>
    <order>2</order>
  </meta>
  <content>
changed page body
  </content>
</mxpost>`,
              ),
            ),
          ),
      )
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(calls).toEqual([
        '/pages/slug/page',
        '/pages/slug/page',
        '/pages/123456789012347',
      ])
    } finally {
      stdout.mockRestore()
    }
  })
})
