import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { ActivityController } from '~/controllers'

describe('test activity client', () => {
  const client = mockRequestInstance(ActivityController)

  test('POST /like', async () => {
    mockResponse('/activity/like', {}, 'post')

    await expect(
      client.activity.likeIt('Note', '11111111'),
    ).resolves.not.toThrowError()
  })
})
