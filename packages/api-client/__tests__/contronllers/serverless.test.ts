import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { ServerlessController } from '~/controllers'

describe('test Snippet client', () => {
  const client = mockRequestInstance(ServerlessController)

  test('GET /:reference/:name', async () => {
    const mocked = mockResponse('/serverless/api/ping', { message: 'pong' })

    const data = await client.serverless.getByReferenceAndName<{}>(
      'api',
      'ping',
    )

    expect(data).toEqual(mocked)
    expect(data.$raw.data).toEqual(mocked)
  })
})
