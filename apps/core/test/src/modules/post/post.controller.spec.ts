import { describe, expect, it, vi } from 'vitest'

import { PostController } from '~/modules/post/post.controller'

const lexicalContent = JSON.stringify({ root: { children: [] } })

const createController = (posts: Record<string, unknown>[]) => {
  const postService = {
    listPaginated: vi.fn(async () => ({
      data: posts,
      pagination: {
        total: posts.length,
        currentPage: 1,
        totalPage: 1,
        size: 10,
      },
    })),
  }
  const translationService = {
    async collectArticleTranslations() {
      return new Map()
    },
  }
  const controller = new PostController(
    postService as any,
    {} as any,
    translationService as any,
    {} as any,
    {} as any,
  )
  return { controller }
}

describe('PostController.getPaginate', () => {
  it('drops lexical content and truncates text when truncate is set', async () => {
    const { controller } = createController([
      {
        id: '7000000000000000060',
        title: 'P',
        text: 'x'.repeat(500),
        content: lexicalContent,
        contentFormat: 'lexical',
      },
    ])

    const res = await controller.getPaginate({ truncate: 150 } as any, false)

    expect(res.data[0].text).toHaveLength(150)
    expect(res.data[0].content).toBeNull()
  })

  it('keeps content intact when truncate is absent', async () => {
    const { controller } = createController([
      {
        id: '7000000000000000060',
        title: 'P',
        text: 'short body',
        content: lexicalContent,
        contentFormat: 'lexical',
      },
    ])

    const res = await controller.getPaginate({} as any, false)

    expect(res.data[0].text).toBe('short body')
    expect(res.data[0].content).toBe(lexicalContent)
  })
})
