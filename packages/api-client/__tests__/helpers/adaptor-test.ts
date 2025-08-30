import { allControllers } from '~/controllers'
import type { HTTPClient } from '~/core'
import { createClient, RequestError } from '~/core'
import type { IRequestAdapter } from '~/interfaces/adapter'
import { createMockServer } from './e2e-mock-server'

export const testAdaptor = (adaptor: IRequestAdapter) => {
  let client: HTTPClient
  const { app, close, port } = createMockServer()

  afterAll(() => {
    close()
  })

  beforeAll(() => {
    client = createClient(adaptor)(`http://localhost:${port}`)
    client.injectControllers(allControllers)
  })
  test('get', async () => {
    app.get('/posts/1', (req, res) => {
      res.send({
        id: '1',
        category_id: '11',
      })
    })
    const res = await client.post.getPost('1')

    expect(res).toStrictEqual({
      id: '1',
      categoryId: '11',
    })

    expect(res.$raw.data.category_id).toEqual('11')
  })

  test('post', async () => {
    app.post('/comments/1', (req, res) => {
      const { body } = req

      res.send({
        ...body,
      })
    })
    const dto = {
      text: 'hello',
      author: 'test',
      mail: '1@ee.com',
    }
    const res = await client.comment.comment('1', dto)

    expect(res).toStrictEqual(dto)
  })

  test('get with search query', async () => {
    app.get('/search/post', (req, res) => {
      if (req.query.keyword) {
        return res.send({ result: 1 })
      }
      res.send(null)
    })

    const res = await client.search.search('post', 'keyword')
    expect(res).toStrictEqual({ result: 1 })
  })

  test('rawResponse rawRequest should defined', async () => {
    app.get('/search/post', (req, res) => {
      if (req.query.keyword) {
        return res.send({ result: 1 })
      }
      res.send(null)
    })

    const res = await client.search.search('post', 'keyword')
    expect(res.$raw).toBeDefined()
    expect(res.$raw.data).toBeDefined()
  })

  it('should error catch', async () => {
    app.get('/error', (req, res) => {
      res.status(500).send({
        message: 'error message',
      })
    })
    await expect(client.proxy.error.get()).rejects.toThrowError(RequestError)
  })

  it('should use number as path', async () => {
    app.get('/1/1', (req, res) => {
      res.send({ data: 1, foo_bar: 'foo' })
    })

    const res = await client.proxy(1)(1).get<{ data: number; fooBar: string }>()

    expect(res).toStrictEqual({ data: 1, fooBar: 'foo' })
    expect(res.$raw.data).toStrictEqual({ data: 1, foo_bar: 'foo' })
    expect(res.$request).toBeDefined()
    expect(res.$serialized).toBeDefined()
    expect(res.$serialized.data).toStrictEqual(res.data)
    expect(res.$serialized.data).toStrictEqual(res.data)
    expect(res.$serialized.fooBar).toStrictEqual(res.fooBar)
    // @ts-expect-error
    expect(res.$serialized.$request).toBeUndefined()
  })

  it('should get string payload', async () => {
    app.get('/string', (req, res) => {
      res.send('x')
    })

    const res = await client.proxy('string').get<string>()
    expect(res).toStrictEqual('x')
  })
}
