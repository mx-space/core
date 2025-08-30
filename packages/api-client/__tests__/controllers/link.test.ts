import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { LinkController } from '~/controllers'
import camelcaseKeys from 'camelcase-keys'

describe('test link client, /links', () => {
  const client = mockRequestInstance(LinkController)

  test('GET /', async () => {
    const mocked = mockResponse('/links?size=10&page=1', {
      data: [
        {
          type: 0,
          state: 0,
          id: '615c191ed5db15a1000e3ca6',
          url: 'https://barry-flynn.github.io/',
          avatar: 'https://i.loli.net/2021/09/09/5belKgmrkjN8ZQ7.jpg',
          description: '星河滚烫，无问西东。',
          name: '百里飞洋の博客',
          created: '2021-10-05T09:21:34.257Z',
          hide: false,
        },
        // ...
      ],
      pagination: {
        total: 43,
        current_page: 1,
        total_page: 5,
        size: 10,
        has_next_page: true,
        has_prev_page: false,
      },
    })

    const data = await client.link.getAllPaginated(1, 10)
    expect(data.$raw.data).toEqual(mocked)
    expect(data).toEqual(camelcaseKeys(mocked, { deep: true }))
  })

  it('should `friend` == `link`', () => {
    expect(client.link).toEqual(client.friend)
  })

  test('GET /all', async () => {
    const mocked = mockResponse('/links/all', {
      data: [],
    })

    const data = await client.link.getAll()
    expect(data.$raw.data).toEqual(mocked)
    expect(data).toEqual(camelcaseKeys(mocked, { deep: true }))
  })

  test('GET /:id', async () => {
    const mocked = mockResponse('/links/5eaabe10cd5bca719652179d', {
      id: '5eaabe10cd5bca719652179d',
      name: '静かな森',
      url: 'https://innei.in',
      avatar: 'https://cdn.innei.ren/avatar.png',
      created: '2020-04-30T12:01:20.738Z',
      type: 0,
      description: '致虚极，守静笃。',
      state: 0,
    })
    const data = await client.link.getById('5eaabe10cd5bca719652179d')
    expect(data.$raw.data).toEqual(mocked)
    expect(data).toEqual(camelcaseKeys(mocked, { deep: true }))
  })

  test('GET /audit', async () => {
    const mocked = mockResponse('/links/audit', {
      can: true,
    })

    const allowed = await client.link.canApplyLink()

    expect(allowed).toEqual(mocked.can)
  })

  test('POST /audit', async () => {
    const payload = {
      author: '',
      avatar: '',
      name: '',
      url: '',
      description: '',
      email: '',
    }
    mockResponse('/links/audit', 'OK', 'post', payload)
    const res = await client.link.applyLink(payload)

    expect(res).toEqual('OK')
  })
})
