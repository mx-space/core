import { describe, expect, it } from 'vitest'

import { matchUrlToRef } from '~/modules/enrichment/url-match.util'

/**
 * Locks the URL → enrichment ref behavior so the DI-free matcher used by
 * release-phase migrations stays in sync with the live ProviderRegistry. If
 * a provider's matchUrl logic changes, update both the provider and the
 * util, and extend this spec.
 */
describe('matchUrlToRef', () => {
  it('returns null for invalid URLs', () => {
    expect(matchUrlToRef('not a url')).toBeNull()
    expect(matchUrlToRef('')).toBeNull()
  })

  it('matches GitHub repo / pr / issue / commit / discussion', () => {
    expect(matchUrlToRef('https://github.com/mx-space/core')).toEqual({
      provider: 'gh-repo',
      externalId: 'mx-space/core',
    })
    expect(matchUrlToRef('https://github.com/mx-space/core/pull/123')).toEqual({
      provider: 'gh-pr',
      externalId: 'mx-space/core/pulls/123',
    })
    expect(matchUrlToRef('https://github.com/mx-space/core/issues/42')).toEqual(
      { provider: 'gh-issue', externalId: 'mx-space/core/issues/42' },
    )
    expect(
      matchUrlToRef('https://github.com/mx-space/core/commit/abc123'),
    ).toEqual({
      provider: 'gh-commit',
      externalId: 'mx-space/core/commits/abc123',
    })
    expect(
      matchUrlToRef('https://github.com/mx-space/core/discussions/9'),
    ).toEqual({
      provider: 'gh-discussion',
      externalId: 'mx-space/core/discussions/9',
    })
  })

  it('matches TMDB movies and tv', () => {
    expect(
      matchUrlToRef('https://www.themoviedb.org/movie/872585-oppenheimer'),
    ).toEqual({ provider: 'tmdb', externalId: 'movie/872585' })
    expect(
      matchUrlToRef('https://themoviedb.org/tv/1396-breaking-bad'),
    ).toEqual({ provider: 'tmdb', externalId: 'tv/1396' })
  })

  it('matches Bangumi subjects', () => {
    expect(matchUrlToRef('https://bgm.tv/subject/12345')).toEqual({
      provider: 'bangumi',
      externalId: '12345',
    })
    expect(matchUrlToRef('https://bangumi.tv/subject/67890/extra')).toEqual({
      provider: 'bangumi',
      externalId: '67890',
    })
  })

  it('matches NeoDB books (douban + neodb.social)', () => {
    expect(matchUrlToRef('https://book.douban.com/subject/12345/')).toEqual({
      provider: 'neodb-book',
      externalId: 'douban-book:12345',
    })
    expect(matchUrlToRef('https://neodb.social/book/abcdef')).toEqual({
      provider: 'neodb-book',
      externalId: 'book/abcdef',
    })
  })

  it('matches Arxiv abs/pdf', () => {
    expect(matchUrlToRef('https://arxiv.org/abs/2401.12345')).toEqual({
      provider: 'arxiv',
      externalId: '2401.12345',
    })
    expect(matchUrlToRef('https://arxiv.org/pdf/2401.12345v2')).toEqual({
      provider: 'arxiv',
      externalId: '2401.12345v2',
    })
  })

  it('matches Leetcode problems', () => {
    expect(matchUrlToRef('https://leetcode.com/problems/two-sum/')).toEqual({
      provider: 'leetcode',
      externalId: 'two-sum',
    })
    expect(matchUrlToRef('https://leetcode.cn/problems/two-sum/')).toEqual({
      provider: 'leetcode',
      externalId: 'two-sum',
    })
  })

  it('matches NetEase Music via id query', () => {
    expect(matchUrlToRef('https://music.163.com/song?id=123456')).toEqual({
      provider: 'netease-music',
      externalId: '123456',
    })
    // Without `id`, NetEase declines and the catchall open-graph claims it.
    expect(matchUrlToRef('https://music.163.com/song')?.provider).toBe(
      'open-graph',
    )
  })

  it('matches QQ Music songDetail path', () => {
    expect(
      matchUrlToRef('https://y.qq.com/n/ryqq/songDetail/00abcd1234'),
    ).toEqual({ provider: 'qq-music', externalId: '00abcd1234' })
  })

  it('falls back to open-graph for any other http(s) URL', () => {
    const ref = matchUrlToRef('https://example.com/some/page?foo=bar#hash')
    expect(ref).toEqual({
      provider: 'open-graph',
      externalId: expect.stringMatching(/^[\da-f]{32}$/),
    })
  })

  it('rejects non-http(s) for open-graph fallback', () => {
    expect(matchUrlToRef('ftp://example.com/file')).toBeNull()
    expect(matchUrlToRef('file:///etc/passwd')).toBeNull()
  })

  it('open-graph hash drops the fragment but keeps query', () => {
    const a = matchUrlToRef('https://example.com/p?x=1#a')
    const b = matchUrlToRef('https://example.com/p?x=1#b')
    expect(a?.externalId).toBe(b?.externalId)
    const c = matchUrlToRef('https://example.com/p?x=2')
    expect(a?.externalId).not.toBe(c?.externalId)
  })
})
