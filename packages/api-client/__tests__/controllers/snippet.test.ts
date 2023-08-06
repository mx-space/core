import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { SnippetController } from '~/controllers'

describe('test Snippet client', () => {
  const client = mockRequestInstance(SnippetController)

  // test('GET /:id', async () => {
  //   const mocked = mockResponse('/snippets/61a0cac4b4aefa000fcc1822', {
  //     id: '61a0cac4b4aefa000fcc1822',
  //     type: 'json',
  //     private: true,
  //     reference: 'theme',
  //     raw: '{}',
  //     name: 'config',
  //     created: '2021-11-26T11:53:40.863Z',
  //     updated: '2021-11-26T11:53:40.863Z',
  //   })

  //   const data = await client.snippet.getById('61a0cac4b4aefa000fcc1822')

  //   expect(data).toEqual(mocked)
  //   expect(data.$raw.data).toEqual(mocked)
  //   expect(data.raw).toEqual('{}')
  // })

  test('GET /:reference/:name', async () => {
    const mocked = mockResponse('/snippets/theme/config', {})

    const data = await client.snippet.getByReferenceAndName<{}>(
      'theme',
      'config',
    )

    expect(data).toEqual(mocked)
    expect(data.$raw.data).toEqual(mocked)
  })
})
