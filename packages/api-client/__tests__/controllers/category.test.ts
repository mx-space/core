import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { CategoryController } from '~/controllers'
import camelcaseKeys from 'camelcase-keys'

describe('test Category client', () => {
  const client = mockRequestInstance(CategoryController)

  test('GET /categories', async () => {
    const mocked = mockResponse('/categories', {
      data: [
        {
          id: '5eb2c62a613a5ab0642f1f7a',
          type: 0,
          count: 34,
          name: '编程',
          slug: 'programming',
          created: '2020-05-06T14:14:02.339Z',
        },
      ],
    })

    const data = await client.category.getAllCategories()
    expect(data.$raw.data).toEqual(mocked)
    expect(data.data).toEqual(mocked.data)
  })

  describe('GET /categories/:id', () => {
    test('get by slug', async () => {
      const mocked = mockResponse('/categories/programming', {
        data: {
          id: '5eb2c62a613a5ab0642f1f7a',
          type: 0,
          count: 2,
          name: '编程',
          slug: 'programming',
          created: '2020-05-06T14:14:02.339Z',
          children: [
            {
              id: '611748895c2f6f4d3ba0d9b3',
              title: 'pageproxy，为 spa 提供初始数据注入',
              slug: 'pageproxy-spa-inject',
              created: '2021-08-14T04:37:29.880Z',
            },
            {
              id: '60cffff50ec52e0349cbb29f',
              title: '曲折的 Vue 3 重构后台之路',
              slug: 'mx-space-vue-3',
              created: '2021-06-21T02:56:53.126Z',
            },
          ],
        },
      })

      const data = await client.category.getCategoryByIdOrSlug('programming')
      expect(data).toEqual(mocked.data)
      expect(data.count).toEqual(mocked.data.count)
    })

    test('get by id', async () => {
      const mocked = mockResponse('/categories/5eb2c62a613a5ab0642f1f7a', {
        data: {
          id: '5eb2c62a613a5ab0642f1f7a',
          type: 0,
          count: 2,
          name: '编程',
          slug: 'programming',
          created: '2020-05-06T14:14:02.339Z',
          children: [
            {
              id: '611748895c2f6f4d3ba0d9b3',
              title: 'pageproxy，为 spa 提供初始数据注入',
              slug: 'pageproxy-spa-inject',
              created: '2021-08-14T04:37:29.880Z',
            },
            {
              id: '60cffff50ec52e0349cbb29f',
              title: '曲折的 Vue 3 重构后台之路',
              slug: 'mx-space-vue-3',
              created: '2021-06-21T02:56:53.126Z',
            },
          ],
        },
      })

      const data = await client.category.getCategoryByIdOrSlug(
        '5eb2c62a613a5ab0642f1f7a',
      )
      expect(data).toEqual(mocked.data)
      expect(data.count).toEqual(mocked.data.count)
    })
  })

  test('GET /categories/:tagName', async () => {
    const mocked = mockResponse('/categories/react?tag=1', {
      tag: 'react',
      data: [
        {
          id: '607bfcedc98328a0d941a409',
          title: '虚拟列表与 Scroll Restoration',
          slug: 'visualize-list-scroll-restoration',
          category: {
            id: '5eb2c62a613a5ab0642f1f7a',
            type: 0,
            name: '编程',
            slug: 'programming',
          },
          created: '2021-04-18T09:33:33.271Z',
        },
      ],
    })

    const data = await client.category.getTagByName('react')
    expect(data.tag).toEqual('react')
    expect(data.data).toEqual(mocked.data)
  })

  test('GET /categories?type=0', async () => {
    const mocked = mockResponse('/categories?type=0', {
      data: [
        {
          id: '5eb2c62a613a5ab0642f1f7a',
          type: 0,
          count: 34,
          name: '编程',
          slug: 'programming',
          created: '2020-05-06T14:14:02.339Z',
        },
      ],
    })

    const data = await client.category.getAllCategories()
    expect(data.data).toEqual(mocked.data)
    expect(data.$raw.data).toEqual(mocked)
  })

  test('GET /categories?type=1', async () => {
    const mocked = mockResponse('/categories?type=1', {
      data: [
        {
          count: 2,
          name: 'docker',
        },
        {
          count: 1,
          name: 'react',
        },
      ],
    })
    const data = await client.category.getAllTags()
    expect(data.data).toEqual(mocked.data)
    expect(data.$raw.data).toEqual(mocked)
  })

  describe('GET /categories?ids=', () => {
    it('should get with ids array', async () => {
      const mocked = mockResponse(
        '/categories?ids=5ed5be418f3d6b6cb9ab7700,5eb2c62a613a5ab0642f1f7b',
        {
          entries: {
            '5ed5be418f3d6b6cb9ab7700': {
              id: '5ed5be418f3d6b6cb9ab7700',
              type: 0,
              count: 2,
              slug: 'reprint',
              name: '转载',
              created: '2020-06-02T02:49:37.424Z',
              children: [
                {
                  id: '6005562e6b14b33be8afc1c3',
                  allow_comment: true,
                  copyright: false,
                  tags: [],
                  count: {
                    read: 221,
                    like: 3,
                  },
                  title: '[reprint] Your Own Time Zone',
                  slug: 'your-own-time-zone',
                  category_id: '5ed5be418f3d6b6cb9ab7700',
                  modified: '2021-01-18T09:41:37.380Z',
                  created: '2021-01-18T09:34:38.550Z',
                },
              ],
            },
            '5eb2c62a613a5ab0642f1f7b': {
              id: '5eb2c62a613a5ab0642f1f7b',
              type: 0,
              count: 19,
              name: '折腾',
              slug: 'Z-Turn',
              created: '2020-05-06T14:14:02.356Z',
              children: [
                {
                  id: '5eb2c62a613a5ab0642f1f95',
                  title: '从零开始的 Redux',
                  slug: 'learn-redux',
                  created: '2020-01-08T08:24:00.000Z',
                  modified: '2020-11-14T06:50:19.164Z',
                  category_id: '5eb2c62a613a5ab0642f1f7b',
                  copyright: true,
                  count: {
                    read: 309,
                    like: 2,
                  },
                  allow_comment: true,
                  tags: [],
                },
              ],
            },
          },
        },
      )

      const data = await client.category.getCategoryDetail([
        '5ed5be418f3d6b6cb9ab7700',
        '5eb2c62a613a5ab0642f1f7b',
      ])

      expect(data).toEqual(
        new Map([
          [
            '5ed5be418f3d6b6cb9ab7700',
            camelcaseKeys(mocked.entries['5ed5be418f3d6b6cb9ab7700'], {
              deep: true,
            }),
          ],
          [
            '5eb2c62a613a5ab0642f1f7b',
            camelcaseKeys(mocked.entries['5eb2c62a613a5ab0642f1f7b'], {
              deep: true,
            }),
          ],
        ]),
      )

      expect(data.$raw.data).toEqual(mocked)
    })

    it('should get with single id', async () => {
      const mocked = mockResponse('/categories?ids=5ed5be418f3d6b6cb9ab7700', {
        entries: {
          '5ed5be418f3d6b6cb9ab7700': {
            id: '5ed5be418f3d6b6cb9ab7700',
            type: 0,
            count: 2,
            slug: 'reprint',
            name: '转载',
            created: '2020-06-02T02:49:37.424Z',
            children: [
              {
                id: '6005562e6b14b33be8afc1c3',
                allow_comment: true,
                copyright: false,
                tags: [],
                count: {
                  read: 221,
                  like: 3,
                },
                title: '[reprint] Your Own Time Zone',
                slug: 'your-own-time-zone',
                category_id: '5ed5be418f3d6b6cb9ab7700',
                modified: '2021-01-18T09:41:37.380Z',
                created: '2021-01-18T09:34:38.550Z',
              },
            ],
          },
        },
      })

      const data = await client.category.getCategoryDetail(
        '5ed5be418f3d6b6cb9ab7700',
      )
      expect(data).toEqual(
        camelcaseKeys(mocked.entries['5ed5be418f3d6b6cb9ab7700'], {
          deep: true,
        }),
      )

      expect(data.$raw.data).toEqual(mocked)
    })
  })
})
