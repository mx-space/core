import { describe, expect, it, vi } from 'vitest'

import { MarkdownService } from '~/modules/markdown/markdown.service'
import { ContentFormat } from '~/shared/types/content-format.type'

const createService = () => {
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
  const databaseService = {}
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
