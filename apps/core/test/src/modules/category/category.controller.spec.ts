import { describe, expect, it, vi } from 'vitest'

import { CategoryController } from '~/modules/category/category.controller'

describe('CategoryController canonical id translation', () => {
  it('translates tag listings using canonical ids only', async () => {
    const created = new Date('2026-03-14T00:00:00.000Z')
    const modified = new Date('2026-03-15T00:00:00.000Z')
    const findArticleWithTag = vi.fn().mockResolvedValue([
      {
        id: 'post-1',
        title: '原始标题',
        slug: 'canonical-id',
        category: {
          id: 'cat-1',
          name: '前端',
        },
        created,
        modified,
      },
    ])
    const translateList = vi.fn(
      async ({ items, targetLang, getInput, applyResult }) => {
        expect(targetLang).toBe('en')
        expect(getInput(items[0])).toMatchObject({
          id: 'post-1',
          title: '原始标题',
          created,
          modified,
        })

        return items.map((item) =>
          applyResult(item, {
            isTranslated: true,
            title: 'Translated title',
            translationMeta: {
              sourceLang: 'zh',
              targetLang: 'en',
              translatedAt: new Date('2026-03-16T00:00:00.000Z'),
            },
          }),
        )
      },
    )

    const controller = new CategoryController(
      { findArticleWithTag } as any,
      {} as any,
      { translateList } as any,
    )

    const result = await controller.getCategoryById(
      { query: 'frontend' } as any,
      { tag: true } as any,
      'en',
    )

    expect(findArticleWithTag).toHaveBeenCalledWith('frontend')
    expect(translateList).toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      tag: 'frontend',
      data: [
        {
          id: 'post-1',
          title: 'Translated title',
          isTranslated: true,
        },
      ],
    })
    expect(result.data[0]).not.toHaveProperty('_id')
  })
})
