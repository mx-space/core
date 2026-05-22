import { describe, expect, it } from 'vitest'

import { metaFor } from '~/core/meta-for'
import type { ResponseMeta } from '~/models/base'

const item = { id: '123456789' }

describe('metaFor', () => {
  it('returns empty object when meta is undefined', () => {
    expect(metaFor(item, undefined)).toStrictEqual({})
  })

  it('returns empty object when meta has no translation or interaction', () => {
    const meta: ResponseMeta = {
      pagination: { page: 1, size: 10, total: 1, totalPages: 1 },
    }
    expect(metaFor(item, meta)).toStrictEqual({
      translation: undefined,
      interaction: undefined,
    })
  })

  it('returns single translation directly (detail shape)', () => {
    const meta: ResponseMeta = {
      translation: { article: { isTranslated: true, sourceLang: 'zh' } },
    }
    const result = metaFor(item, meta)
    expect(result.translation).toStrictEqual({
      article: { isTranslated: true, sourceLang: 'zh' },
    })
  })

  it('returns translation by id from record (list shape)', () => {
    const meta: ResponseMeta = {
      translation: {
        '123456789': { article: { isTranslated: false } },
        '987654321': { article: { isTranslated: true } },
      },
    }
    const result = metaFor(item, meta)
    expect(result.translation).toStrictEqual({
      article: { isTranslated: false },
    })
  })

  it('returns undefined translation when id is missing in record (list shape)', () => {
    const meta: ResponseMeta = {
      translation: {
        '987654321': { article: { isTranslated: true } },
      },
    }
    const result = metaFor(item, meta)
    expect(result.translation).toBeUndefined()
  })

  it('returns single interaction directly (detail shape)', () => {
    const meta: ResponseMeta = {
      interaction: { isLiked: true, likeCount: 5, readCount: 42 },
    }
    const result = metaFor(item, meta)
    expect(result.interaction).toStrictEqual({
      isLiked: true,
      likeCount: 5,
      readCount: 42,
    })
  })

  it('returns interaction by id from record (list shape)', () => {
    const meta: ResponseMeta = {
      interaction: {
        '123456789': { isLiked: false, likeCount: 1 },
        '987654321': { isLiked: true, likeCount: 9 },
      },
    }
    const result = metaFor(item, meta)
    expect(result.interaction).toStrictEqual({ isLiked: false, likeCount: 1 })
  })

  it('returns undefined interaction when id is missing in record (list shape)', () => {
    const meta: ResponseMeta = {
      interaction: {
        '987654321': { isLiked: true },
      },
    }
    const result = metaFor(item, meta)
    expect(result.interaction).toBeUndefined()
  })

  it('handles partial interaction single shape (only some keys present)', () => {
    const meta: ResponseMeta = {
      interaction: { likeCount: 10 },
    }
    const result = metaFor(item, meta)
    expect(result.interaction).toStrictEqual({ likeCount: 10 })
  })

  it('treats an empty translation object as undefined (neither single nor record)', () => {
    const meta: ResponseMeta = {
      translation: {},
    }
    const result = metaFor(item, meta)
    expect(result.translation).toBeUndefined()
  })
})
