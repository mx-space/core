import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { SubscribeController } from '~/controllers'
import camelcaseKeys from 'camelcase-keys'

describe('test topic client', () => {
  const client = mockRequestInstance(SubscribeController)

  test('GET /subscribe', async () => {
    const mocked = mockResponse('/subscribe', {}, 'post', {
      email: 'foo@example.com',
      types: ['post_c'],
    })
    const data = await client.subscribe.subscribe('foo@example.com', ['post_c'])
    expect(data).toEqual(camelcaseKeys(mocked))
  })

  test('GET /subscribe/unsubscribe', async () => {
    const mocked = mockResponse('/subscribe/unsubscribe', 'success')
    const data = await client.subscribe.unsubscribe('foo@example.com', 'token')
    expect(data).toEqual(mocked)
  })

  test('GET /subscribe/status', async () => {
    const mocked = mockResponse('/subscribe/status', {
      enable: true,
      bit_map: { post_c: 1, note_c: 2, say_c: 4, recently_c: 8, all: 15 },
      allow_bits: [2, 1],
      allow_types: ['note_c', 'post_c'],
    })
    const data = await client.subscribe.check()
    expect(data).toEqual(camelcaseKeys(mocked, { deep: true }))
  })
})
