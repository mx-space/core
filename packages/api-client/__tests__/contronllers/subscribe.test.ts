import camelcaseKeys from 'camelcase-keys'

import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { SubscribeController } from '~/controllers'

describe('test topic client', () => {
  const client = mockRequestInstance(SubscribeController)

  test('GET /subscribe', async () => {
    const mocked = mockResponse('/subscribe', {}, 'post')
    const data = await client.subscribe.subscribe('foo@example.com', ['post_c'])
    expect(data).toEqual(camelcaseKeys(mocked))
  })

  test('GET /subscribe/unsubscribe', async () => {
    const mocked = mockResponse('/subscribe/unsubscribe', 'success')
    const data = await client.subscribe.unsubscribe('foo@example.com', 'token')
    expect(data).toEqual(mocked)
  })
})
