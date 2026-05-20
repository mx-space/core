import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { PageController } from '~/controllers/page'

describe('test page client', () => {
  const client = mockRequestInstance(PageController)

  it('should get page list', async () => {
    mockResponse('/pages?size=10&page=1', {
      data: [],
      pagination: {},
    })
    const data = await client.page.getList()
    expect(data).toEqual({ data: [], pagination: {} })
  })

  it('should get post list filter filed', async () => {
    const items = [{}]
    const pagination = { page: 1, size: 1, total: 1, total_pages: 1 }
    mockResponse('/pages?page=1&size=1', items, 'get', undefined, {
      pagination,
    })

    const data = await client.page.getList(1, 1)
    expect(data).toEqual({
      data: items,
      pagination: { page: 1, size: 1, total: 1, totalPages: 1 },
    })
  })

  it('should get single page', async () => {
    mockResponse('/pages/1', {
      title: '1',
    })

    const data = await client.page.getById('1')

    expect(data).toStrictEqual({ title: '1' })
    expect(data.$raw).toBeDefined()
  })

  it('should get by slug', async () => {
    mockResponse('/pages/slug/about', {
      title: 'about',
      text: 'about!',
    })

    const data = await client.page.getBySlug('about')
    expect(data.title).toBe('about')
    expect(data.text).toBe('about!')
  })
})
