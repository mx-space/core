import { describe, expect, it } from 'vitest'

import {
  ARTICLE_BODY_BATCH_LIMIT,
  ArticleBodiesSchema,
} from '~/modules/article-body/article-body.schema'

const id = '7000000000000000060'

describe('ArticleBodiesSchema', () => {
  it('accepts a mixed batch', () => {
    const parsed = ArticleBodiesSchema.parse({
      items: [
        { id, kind: 'post' },
        { bodyVersion: 1, id, kind: 'note' },
      ],
    })
    expect(parsed.items).toHaveLength(2)
  })

  it('rejects an empty batch', () => {
    expect(() => ArticleBodiesSchema.parse({ items: [] })).toThrow()
  })

  it('rejects more than the visible-window cap', () => {
    expect(() =>
      ArticleBodiesSchema.parse({
        items: Array.from({ length: ARTICLE_BODY_BATCH_LIMIT + 1 }, () => ({
          id,
          kind: 'post' as const,
        })),
      }),
    ).toThrow()
  })
})
