import { firstValueFrom, toArray } from 'rxjs'
import { describe, expect, it, vi } from 'vitest'

import { ArticleBodyService } from '~/modules/article-body/article-body.service'

const created = new Date('2026-08-01T00:00:00.000Z')
const modified = new Date('2026-08-05T00:00:00.000Z')
const lexical = JSON.stringify({ root: { children: [] } })

const postId = '7000000000000000060'
const noteId = '7000000000000000061'

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: postId,
    title: 'Post',
    text: 'full post',
    content: lexical,
    contentFormat: 'lexical',
    meta: null,
    isPublished: true,
    isPremium: false,
    createdAt: created,
    modifiedAt: modified,
    ...overrides,
  }
}

function makeNote(overrides: Record<string, unknown> = {}) {
  return {
    id: noteId,
    title: 'Note',
    text: 'full note',
    content: lexical,
    contentFormat: 'lexical',
    meta: null,
    isPublished: true,
    hasPassword: false,
    publicAt: null,
    createdAt: created,
    modifiedAt: modified,
    ...overrides,
  }
}

function createService(
  opts: {
    posts?: ReturnType<typeof makePost>[]
    notes?: ReturnType<typeof makeNote>[]
    entitled?: boolean
    translation?: { content: string; text: string }
  } = {},
) {
  const postService = {
    findManyByIds: vi.fn(async () => opts.posts ?? [makePost()]),
  }
  const noteService = {
    findManyByIds: vi.fn(async () => opts.notes ?? [makeNote()]),
  }
  const translationService = {
    collectArticleTranslations: vi.fn(async () => {
      if (!opts.translation) {
        return { results: new Map(), meta: new Map() }
      }
      return {
        results: new Map([
          [
            postId,
            {
              isTranslated: true,
              content: opts.translation.content,
              text: opts.translation.text,
              title: 'Translated',
              contentFormat: 'lexical',
            },
          ],
        ]),
        meta: new Map(),
      }
    }),
  }
  const entitlementService = {
    isPremiumLocked: vi.fn(async () => opts.entitled === false),
  }

  const service = new ArticleBodyService(
    postService as any,
    noteService as any,
    translationService as any,
    entitlementService as any,
  )

  return {
    entitlementService,
    noteService,
    postService,
    service,
    translationService,
  }
}

async function collect(
  service: ArticleBodyService,
  items: Parameters<ArticleBodyService['streamBodies']>[0],
  context: Parameters<ArticleBodyService['streamBodies']>[1] = {
    isOwner: false,
  },
) {
  return firstValueFrom(service.streamBodies(items, context).pipe(toArray()))
}

describe('ArticleBodyService.streamBodies', () => {
  it('emits a full post body in request order', async () => {
    const { service } = createService()
    const lines = await collect(service, [{ id: postId, kind: 'post' }])
    expect(lines).toEqual([
      {
        content: lexical,
        contentFormat: 'lexical',
        createdAt: created.toISOString(),
        id: postId,
        kind: 'post',
        modifiedAt: modified.toISOString(),
        text: 'full post',
      },
    ])
  })

  it('hides unpublished posts from the public', async () => {
    const { service } = createService({
      posts: [makePost({ isPublished: false })],
    })
    const lines = await collect(service, [{ id: postId, kind: 'post' }])
    expect(lines).toEqual([{ id: postId, kind: 'post', missing: true }])
  })

  it('lets the owner read unpublished posts', async () => {
    const { service } = createService({
      posts: [makePost({ isPublished: false })],
    })
    const lines = await collect(service, [{ id: postId, kind: 'post' }], {
      isOwner: true,
    })
    expect(lines[0]).toMatchObject({
      id: postId,
      kind: 'post',
      text: 'full post',
    })
  })

  it('omits password-protected note bodies for the public', async () => {
    const { service } = createService({
      notes: [makeNote({ hasPassword: true })],
    })
    const lines = await collect(service, [{ id: noteId, kind: 'note' }])
    expect(lines).toEqual([{ hasPassword: true, id: noteId, kind: 'note' }])
  })

  it('skips a body the client already has', async () => {
    const { service } = createService()
    const lines = await collect(service, [
      { bodyVersion: modified.getTime(), id: postId, kind: 'post' },
    ])
    expect(lines).toEqual([{ id: postId, kind: 'post', unchanged: true }])
  })

  it('teases premium posts when the reader is not entitled', async () => {
    const { entitlementService, service } = createService({
      entitled: false,
      posts: [makePost({ isPremium: true })],
    })
    const lines = await collect(service, [{ id: postId, kind: 'post' }])
    expect(entitlementService.isPremiumLocked).toHaveBeenCalled()
    expect(lines[0]).toMatchObject({
      id: postId,
      isPremium: true,
      kind: 'post',
      locked: true,
    })
  })

  it('returns the full premium body when the reader is entitled', async () => {
    const { service } = createService({
      entitled: true,
      posts: [makePost({ isPremium: true, text: 'members only' })],
    })
    const lines = await collect(service, [{ id: postId, kind: 'post' }])
    expect(lines[0]).toMatchObject({
      isPremium: true,
      locked: false,
      text: 'members only',
    })
  })

  it('applies translations before emitting', async () => {
    const { service } = createService({
      translation: { content: '{"t":1}', text: '訳文' },
    })
    const lines = await collect(service, [{ id: postId, kind: 'post' }], {
      isOwner: false,
      lang: 'ja',
    })
    expect(lines[0]).toMatchObject({ content: '{"t":1}', text: '訳文' })
  })

  it('emits skip lines before bodies and keeps request order', async () => {
    const { service } = createService({
      notes: [makeNote({ hasPassword: true })],
      posts: [makePost()],
    })
    const lines = await collect(service, [
      { id: noteId, kind: 'note' },
      { id: postId, kind: 'post' },
    ])
    expect(lines.map((line) => line.id)).toEqual([noteId, postId])
    expect(lines[0]).toMatchObject({ hasPassword: true })
    expect(lines[1]).toMatchObject({ kind: 'post', text: 'full post' })
  })
})
