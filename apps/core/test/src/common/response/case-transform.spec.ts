import { transformResponseCase } from '~/common/response/case-transform'

describe('transformResponseCase', () => {
  it('converts camelCase object keys to snake_case', () => {
    expect(transformResponseCase({ createdAt: 1, isPublished: true })).toEqual({
      created_at: 1,
      is_published: true,
    })
  })

  it('recurses into nested objects and arrays', () => {
    expect(
      transformResponseCase({
        categoryId: '1',
        relatedPosts: [{ postId: 'a' }, { postId: 'b' }],
      }),
    ).toEqual({
      category_id: '1',
      related_posts: [{ post_id: 'a' }, { post_id: 'b' }],
    })
  })

  it('leaves Date instances intact', () => {
    const date = new Date('2026-05-16T00:00:00.000Z')
    const result = transformResponseCase({ createdAt: date }) as {
      created_at: Date
    }
    expect(result.created_at).toBe(date)
  })

  it('leaves primitives and null untouched', () => {
    expect(transformResponseCase(null)).toBe(null)
    expect(transformResponseCase(42)).toBe(42)
    expect(transformResponseCase('camelCase')).toBe('camelCase')
  })

  it('does not convert non-identifier keys (urls, ids, dotted paths)', () => {
    expect(
      transformResponseCase({
        'https://Example.com/Path': { likeCount: 1 },
        '1024': { readCount: 2 },
        'category.name': 'x',
      }),
    ).toEqual({
      'https://Example.com/Path': { like_count: 1 },
      '1024': { read_count: 2 },
      'category.name': 'x',
    })
  })

  it('emits a bypassed subtree verbatim', () => {
    expect(
      transformResponseCase(
        { metaInfo: { userKey: { NestedKey: 1 } }, otherField: { aB: 2 } },
        ['metaInfo'],
      ),
    ).toEqual({
      meta_info: { userKey: { NestedKey: 1 } },
      other_field: { a_b: 2 },
    })
  })

  it('emits the response root verbatim when explicitly bypassed', () => {
    const input = {
      minimumClientVersion: '1.7.3',
      limits: { presencePayloadBytes: 32_768 },
    }

    expect(transformResponseCase(input, ['$'])).toBe(input)
  })

  it('matches bypass paths through array segments', () => {
    expect(
      transformResponseCase(
        { dataList: [{ rawMeta: { keepMe: 1 } }, { rawMeta: { keepMe: 2 } }] },
        ['dataList[].rawMeta'],
      ),
    ).toEqual({
      data_list: [{ raw_meta: { keepMe: 1 } }, { raw_meta: { keepMe: 2 } }],
    })
  })

  it('preserves acronym boundaries on consecutive uppercase letters', () => {
    expect(
      transformResponseCase({
        articleURL: 'a',
        htmlContent: 'b',
        ioError: 'c',
        userIDList: 'd',
      }),
    ).toEqual({
      article_url: 'a',
      html_content: 'b',
      io_error: 'c',
      user_id_list: 'd',
    })
  })

  it('preserves mixed-case id record keys under bypass (activity presence)', () => {
    const readerId = 'wKpLmN3qRsTuVwXyZ0'
    const input = {
      presence: { owner_123: { readerId } },
      readers: { [readerId]: { emailVerified: true } },
    }
    expect(transformResponseCase(input, ['presence', 'readers'])).toEqual(input)
    expect(transformResponseCase(input)).not.toHaveProperty([
      'readers',
      readerId,
    ])
  })

  it('only bypasses an exact path, not its prefixes', () => {
    expect(
      transformResponseCase({ outerField: { innerField: { deepKey: 1 } } }, [
        'outerField.innerField',
      ]),
    ).toEqual({
      outer_field: { inner_field: { deepKey: 1 } },
    })
  })
})
