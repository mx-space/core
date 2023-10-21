import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { AckController } from '~/controllers'

describe('test ack client', () => {
  const client = mockRequestInstance(AckController)

  test('POST /ack', async () => {
    mockResponse('/ack', {}, 'post', {
      type: 'read',
      payload: {
        type: 'note',
        id: '11',
      },
    })

    await expect(client.ack.read('note', '11')).resolves.not.toThrowError()
  })
})
