import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { RecentlyController } from '~/controllers'

describe('test recently client, /recently', () => {
  const client = mockRequestInstance(RecentlyController)

  test('GET /', async () => {
    const mocked = mockResponse('/recently?before=616182162657089e483aac5c', {
      data: [
        {
          id: '615c58cbf41656a119b1a4a9',
          content: 'x',
          created: '2021-10-05T13:53:15.891Z',
        },
      ],
    })
    const data = await client.recently.getList({
      before: '616182162657089e483aac5c',
    })
    expect(data).toEqual(mocked)
  })

  test('GET /6608f877e345af4659011d28', async () => {
    const mocked = mockResponse('/recently/6608f877e345af4659011d28', {
      id: '6608f877e345af4659011d28',
      content: 'x',
      created: '2021-10-05T13:53:15.891Z',
    })
    const data = await client.recently.getById('6608f877e345af4659011d28')
    expect(data).toEqual(mocked)
  })

  test('GET /latest', async () => {
    const mocked = mockResponse('/recently/latest', {
      id: '615c58cbf41656a119b1a4a9',
      content: 'xxx',
      created: '2021-10-05T13:53:15.891Z',
    })
    const data = await client.recently.getLatestOne()
    expect(data).toEqual(mocked)
  })

  test('GET /all', async () => {
    const mocked = mockResponse('/recently/all', {
      data: [
        {
          id: '615c58cbf41656a119b1a4a9',
          content: 'x',
          created: '2021-10-05T13:53:15.891Z',
        },
      ],
    })
    const data = await client.recently.getAll()
    expect(data).toEqual(mocked)
  })

  test('GET /attitude', async () => {
    const id = `1212121`
    const mocked = mockResponse(`/recently/attitude/${id}?attitude=1`, {
      code: 1,
    })
    const data = await client.recently.attitude(id, 1)
    expect(data).toEqual(mocked)
  })

  it('should `recently` == `shorthand`', () => {
    expect(client.recently).toEqual(client.shorthand)
  })
})
