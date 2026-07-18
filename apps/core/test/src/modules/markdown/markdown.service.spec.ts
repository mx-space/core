import { describe, expect, it, vi } from 'vitest'

import { CollectionRefTypes } from '~/constants/db.constant'
import { MarkdownService } from '~/modules/markdown/markdown.service'
import { ContentFormat } from '~/shared/types/content-format.type'

const premiumContent = JSON.stringify({
  root: {
    children: [
      {
        type: 'paragraph',
        children: [],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
      {
        type: 'paragraph',
        children: [],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
      {
        type: 'paragraph',
        children: [],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
})

const createService = ({ findGlobalById }: { findGlobalById?: any } = {}) => {
  const assetService = {}
  const categoryService = {
    findAllCategory: vi
      .fn()
      .mockResolvedValue([{ id: 'cat-1', name: 'Default', slug: 'default' }]),
    create: vi.fn(),
  }
  const postService = {
    create: vi.fn(async (post) => ({ id: 'post-1', ...post })),
  }
  const noteService = {
    create: vi.fn(async (note) => ({ id: 'note-1', ...note })),
  }
  const pageService = {}
  const databaseService = { findGlobalById }
  const service = new MarkdownService(
    assetService as any,
    categoryService as any,
    postService as any,
    noteService as any,
    pageService as any,
    databaseService as any,
  )
  return { categoryService, noteService, postService, service }
}

describe('MarkdownService', () => {
  it('imports markdown posts through PostService with PG category ids', async () => {
    const { postService, service } = createService()

    await service.insertPostsToDb([
      {
        text: '# Hello',
        meta: { title: 'Hello', slug: 'hello', categories: ['Default'] },
      } as any,
    ])

    expect(postService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Hello',
        slug: 'hello',
        categoryId: 'cat-1',
        contentFormat: ContentFormat.Markdown,
      }),
    )
  })

  it('imports markdown notes through NoteService without direct model access', async () => {
    const { noteService, service } = createService()

    await service.insertNotesToDb([
      { text: 'note body', meta: { title: 'Imported Note' } } as any,
    ])

    expect(noteService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Imported Note',
        text: 'note body',
      }),
    )
  })
})

describe('MarkdownService.renderArticle', () => {
  const premiumPost = {
    id: 'post-1',
    title: 'Premium Post',
    isPremium: true,
    text: 'full premium body',
    content: premiumContent,
  }
  const freePost = {
    id: 'post-2',
    title: 'Free Post',
    isPremium: false,
    text: 'full free body',
    content: premiumContent,
  }

  it('renders only the teaser for a premium post by default', async () => {
    const findGlobalById = vi.fn(async () => ({
      document: premiumPost,
      type: CollectionRefTypes.Post,
    }))
    const { service } = createService({ findGlobalById })

    const { html } = await service.renderArticle('post-1')

    expect(html).not.toContain('full premium body')
  })

  it('renders the full body for a premium post when asOwner is true', async () => {
    const findGlobalById = vi.fn(async () => ({
      document: premiumPost,
      type: CollectionRefTypes.Post,
    }))
    const { service } = createService({ findGlobalById })

    const { html } = await service.renderArticle('post-1', { asOwner: true })

    expect(html).toContain('full premium body')
  })

  it('renders the full body for a free post regardless of asOwner', async () => {
    const findGlobalById = vi.fn(async () => ({
      document: freePost,
      type: CollectionRefTypes.Post,
    }))
    const { service } = createService({ findGlobalById })

    const { html: teaserHtml } = await service.renderArticle('post-2')
    const { html: ownerHtml } = await service.renderArticle('post-2', {
      asOwner: true,
    })

    expect(teaserHtml).toContain('full free body')
    expect(ownerHtml).toContain('full free body')
  })
})
