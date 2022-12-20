import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { PostController } from '~/controllers'

describe('test post client', () => {
  const client = mockRequestInstance(PostController)

  it('should get post list', async () => {
    mockResponse('/posts', { data: [] })

    const data = await client.post.getList()
    expect(data).toEqual({ data: [] })
  })

  it('should get post list filter filed', async () => {
    const mocked = mockResponse('/posts?page=1&size=1&select=created+title', {
      data: [
        {
          id: '61586f7e769f07b6852f3da0',
          title: '终于可以使用 Docker 托管整个 Mix Space 了',
          created: '2021-10-02T14:41:02.742Z',
          category: null,
        },
        {
          id: '614c539cfdf566c5d93a383f',
          title: '再遇 Docker，容器化 Node 应用',
          created: '2021-09-23T10:14:52.491Z',
          category: null,
        },
      ],
    })

    const data = await client.post.getList(1, 1, {
      select: ['created', 'title'],
    })
    expect(data).toEqual(mocked)
  })

  it('should get latest post', async () => {
    mockResponse('/posts/latest', { title: '1' })
    const data = await client.post.getLatest()
    expect(data.title).toBe('1')
  })

  it('should get single post by id', async () => {
    mockResponse('/posts/613c91d0326cfffc61923ea2', {
      title: '1',
    })

    const data = await client.post.getPost('613c91d0326cfffc61923ea2')

    expect(data).toStrictEqual({ title: '1' })
    expect(data.$raw).toBeDefined()
  })

  it('should get single post by slug and category', async () => {
    mockResponse('/posts/website/host-an-entire-Mix-Space-using-Docker', {
      title: '1',
    })

    const data = await client.post.getPost(
      'website',
      'host-an-entire-Mix-Space-using-Docker',
    )

    expect(data).toStrictEqual({ title: '1' })
    expect(data.$raw).toBeDefined()
  })

  it('should thumbs-up post', async () => {
    mockResponse('/posts/_thumbs-up?id=1', null)

    const data = await client.post.thumbsUp('1')

    expect(data).toBeNull()
  })
})
