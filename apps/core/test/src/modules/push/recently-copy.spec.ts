import { describe, expect, it } from 'vitest'

import { projectThinkingCopy } from '~/modules/push/recently-copy'

const eva = {
  title: '新世紀エヴァンゲリオン',
  url: 'https://www.themoviedb.org/tv/285838',
  category: 'media',
  subtype: 'tv',
  publishedAt: '1995-10-04',
  fetchedAt: '2026-08-25T00:00:00.000Z',
}

describe('projectThinkingCopy', () => {
  it('projects an enriched TMDB link with the owner description', () => {
    const url = 'https://www.themoviedb.org/tv/285838'
    expect(
      projectThinkingCopy(`今晚重看了一遍，还是会被 ED 干掉。\n\n${url}`, {
        [url]: eva,
      }),
    ).toEqual({
      kind: 'enriched',
      verb: 'watched',
      work_title: '新世紀エヴァンゲリオン',
      description: '今晚重看了一遍，还是会被 ED 干掉。',
      fact_type: 'tv',
      fact_year: '1995',
    })
  })

  it('projects a book with author before type', () => {
    const url = 'https://book.douban.com/subject/26887161'
    expect(
      projectThinkingCopy(url, {
        [url]: {
          title: '一百年，许多人，许多事',
          url,
          category: 'media',
          subtype: 'book',
          publishedAt: '2021-09-01',
          fetchedAt: '2026-08-25T00:00:00.000Z',
          attributes: [{ key: 'author', value: '杨苡 口述' }],
        },
      }),
    ).toEqual({
      kind: 'enriched',
      verb: 'read',
      work_title: '一百年，许多人，许多事',
      fact_creator: '杨苡 口述',
      fact_year: '2021',
    })
  })

  it('skips a bare unresolved URL', () => {
    expect(projectThinkingCopy('https://example.com/x')).toEqual({
      kind: 'skip',
    })
  })

  it('projects plain text with later paragraphs as summary', () => {
    expect(
      projectThinkingCopy('下午的光把桌面切成两半。\n\n键盘声比想法先到。'),
    ).toEqual({
      kind: 'plain',
      text: '下午的光把桌面切成两半。',
      summary: '键盘声比想法先到。',
    })
  })

  it('links GitHub without a fact line', () => {
    const url = 'https://github.com/facebook/react'
    expect(
      projectThinkingCopy(url, {
        [url]: {
          title: 'facebook/react',
          url,
          category: 'github',
          subtype: 'repo',
          fetchedAt: '2026-08-25T00:00:00.000Z',
        },
      }),
    ).toEqual({
      kind: 'enriched',
      verb: 'linked',
      work_title: 'facebook/react',
    })
  })
})
