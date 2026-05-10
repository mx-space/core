import camelcaseKeys from 'camelcase-keys'

import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { SearchController } from '~/controllers'

describe('test search client, /search', () => {
  const client = mockRequestInstance(SearchController)

  test('GET /search/post', async () => {
    const mocked = mockResponse('/search/post?keyword=1', {
      data: [
        {
          modified: '2020-11-14T16:15:36.162Z',
          id: '5eb2c62a613a5ab0642f1f80',
          title: '打印沙漏(C#实现)',
          highlight: {
            keywords: ['c#'],
            snippet: '...打印沙漏(c#实现)...',
          },
          slug: 'acm-test',
          created: '2019-01-31T13:02:00.000Z',
          category: {
            type: 0,
            id: '5eb2c62a613a5ab0642f1f7a',
            count: 56,
            name: '编程',
            slug: 'programming',
            created: '2020-05-06T14:14:02.339Z',
          },
        },
      ],
      pagination: {
        total: 86,
        current_page: 1,
        total_page: 9,
        size: 10,
        has_next_page: true,
        has_prev_page: false,
      },
    })

    const data = await client.search.search('post', '1')
    expect(data).toEqual(camelcaseKeys(mocked, { deep: true }))
    expect(data.data[0].id).toEqual('5eb2c62a613a5ab0642f1f80')
    expect(data.data[0].highlight.keywords).toEqual(['c#'])
  })

  test('GET /search/note', async () => {
    const mocked = mockResponse('/search/note?keyword=1', {
      data: [
        {
          modified: '2020-11-15T09:43:33.199Z',
          id: '5eb35d6f5ae43bbd0c90b8c0',
          title: '回顾快要逝去的寒假',
          highlight: {
            keywords: ['寒假'],
            snippet: '...回顾快要逝去的寒假...',
          },
          created: '2019-02-19T11:59:00.000Z',
          nid: 11,
        },
      ],
      pagination: {
        total: 86,
        current_page: 1,
        total_page: 9,
        size: 10,
        has_next_page: true,
        has_prev_page: false,
      },
    })

    const data = await client.search.search('note', '1')
    expect(data).toEqual(camelcaseKeys(mocked, { deep: true }))
    expect(data.data[0].id).toEqual('5eb35d6f5ae43bbd0c90b8c0')
    expect(data.data[0].highlight.snippet).toContain('寒假')
  })

  test('GET /search', async () => {
    const mocked = mockResponse('/search?keyword=1', {
      data: [
        {
          modified: '2020-11-14T16:15:36.162Z',
          id: '5eb2c62a613a5ab0642f1f80',
          title: '打印沙漏(C#实现)',
          lang: 'zh',
          is_fallback: false,
          highlight: {
            keywords: ['c#'],
            snippet: '...打印沙漏(c#实现)...',
          },
          slug: 'acm-test',
          created: '2019-01-31T13:02:00.000Z',
          type: 'post',
          category: {
            type: 0,
            id: '5eb2c62a613a5ab0642f1f7a',
            count: 56,
            name: '编程',
            slug: 'programming',
            created: '2020-05-06T14:14:02.339Z',
          },
        },
      ],
      pagination: {
        total: 86,
        current_page: 1,
        total_page: 9,
        size: 10,
        has_next_page: true,
        has_prev_page: false,
      },
    })

    const data = await client.search.searchAll('1')
    expect(data).toEqual(camelcaseKeys(mocked, { deep: true }))
    expect(data.data[0].type).toEqual('post')
    expect(data.data[0].highlight.keywords).toEqual(['c#'])
    expect(data.data[0].lang).toEqual('zh')
    expect(data.data[0].isFallback).toEqual(false)
  })

  test('GET /search?lang=ja surfaces fallback flag', async () => {
    const mocked = mockResponse('/search?keyword=hello&lang=ja', {
      data: [
        {
          modified: '2020-11-14T16:15:36.162Z',
          id: '5eb2c62a613a5ab0642f1f80',
          title: 'hello world',
          lang: 'zh',
          is_fallback: true,
          highlight: { keywords: ['hello'], snippet: 'hello world' },
          slug: 'hello',
          created: '2019-01-31T13:02:00.000Z',
          type: 'post',
        },
      ],
      pagination: {
        total: 1,
        current_page: 1,
        total_page: 1,
        size: 10,
        has_next_page: false,
        has_prev_page: false,
      },
    })

    const data = await client.search.searchAll('hello', { lang: 'ja' })
    expect(data).toEqual(camelcaseKeys(mocked, { deep: true }))
    expect(data.data[0].isFallback).toBe(true)
  })

  test('POST /search/rebuild', async () => {
    const mocked = mockResponse(
      '/search/rebuild',
      {
        total: 12,
        created: 1,
        updated: 2,
        deleted: 0,
        skipped: 9,
      },
      'post',
    )
    const data = await client.search.rebuild()
    expect(data).toEqual(camelcaseKeys(mocked, { deep: true }))
  })

  test('POST /search/rebuild/:refType/:refId', async () => {
    const mocked = mockResponse(
      '/search/rebuild/post/5eb2c62a613a5ab0642f1f80',
      { rebuilt: 3 },
      'post',
    )
    const data = await client.search.rebuildOne(
      'post',
      '5eb2c62a613a5ab0642f1f80',
    )
    expect(data).toEqual(camelcaseKeys(mocked, { deep: true }))
    expect(data.rebuilt).toBe(3)
  })

  test('GET /search/admin/documents', async () => {
    const mocked = mockResponse(
      '/search/admin/documents?refType=post&lang=zh&page=1&size=20',
      {
        data: [
          {
            id: 'doc-1',
            ref_type: 'post',
            ref_id: '5eb2c62a613a5ab0642f1f80',
            lang: 'zh',
            source_hash: 'abcd',
            title: 'hello',
            title_length: 1,
            body_length: 5,
            is_published: true,
            public_at: null,
            has_password: false,
            modified_at: null,
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ],
        pagination: {
          total: 1,
          current_page: 1,
          total_page: 1,
          size: 20,
          has_next_page: false,
          has_prev_page: false,
        },
      },
    )

    const data = await client.search.adminListDocuments({
      refType: 'post',
      lang: 'zh',
      page: 1,
      size: 20,
    })
    expect(data).toEqual(camelcaseKeys(mocked, { deep: true }))
    expect(data.data[0].sourceHash).toBe('abcd')
  })
})
