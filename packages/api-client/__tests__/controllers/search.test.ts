import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { SearchController } from '~/controllers'
import camelcaseKeys from 'camelcase-keys'
import mockData from '../mock/algolia.json'

describe('test search client, /search', () => {
  const client = mockRequestInstance(SearchController)

  test('GET /search/post', async () => {
    const mocked = mockResponse('/search/post?keyword=1', {
      data: [
        {
          modified: '2020-11-14T16:15:36.162Z',
          id: '5eb2c62a613a5ab0642f1f80',
          title: '打印沙漏(C#实现)',
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
  })

  test('GET /search/note', async () => {
    const mocked = mockResponse('/search/note?keyword=1', {
      data: [
        {
          modified: '2020-11-15T09:43:33.199Z',
          id: '5eb35d6f5ae43bbd0c90b8c0',
          title: '回顾快要逝去的寒假',
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
  })

  test('GET /search/algolia', async () => {
    mockResponse('/search/algolia', mockData)
    const data = await client.search.searchByAlgolia('algolia')

    expect(data.data[0].id).toEqual('5fe97d1d5b11408f99ada0fd')
    expect(data.raw).toBeDefined()

    expect(data.$raw.data).toEqual(mockData)
  })
})
