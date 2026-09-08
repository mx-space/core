import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { DraftController } from '~/controllers'

describe('test Draft client', () => {
  const client = mockRequestInstance(DraftController)

  test('GET /shared/:token', async () => {
    const mocked = mockResponse('/drafts/shared/token-1', {
      content: '# hello',
      contentFormat: 'markdown',
      createdAt: '2026-09-09T00:00:00.000Z',
      images: null,
      refType: 'post',
      text: 'hello',
      title: 'Shared draft',
    })

    const data = await client.draft.getShared('token-1')

    expect(data).toEqual(mocked)
    expect(data.refType).toBe('post')
  })
})
