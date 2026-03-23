import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { ActivityController } from '~/controllers'

describe('test activity client', () => {
  const client = mockRequestInstance(ActivityController)

  test('POST /like', async () => {
    mockResponse('/activity/like', {}, 'post', {
      type: 'note',
      id: '11111111',
    })

    await expect(
      client.activity.likeIt('Note', '11111111'),
    ).resolves.not.toThrowError()
  })

  test('GET /presence', async () => {
    mockResponse('/activity/presence', {
      data: {
        owner_a07f1234: {
          identity: 'owner_a07f1234',
          position: 0,
          ts: 123123123,
          reader_id: 'reader_1',
        },
      },
      readers: {
        reader_1: {
          display_name: 'Reader One',
        },
      },
    })

    await expect(client.activity.getPresence('122')).resolves.toMatchObject({
      data: {
        owner_a07f1234: {
          identity: 'owner_a07f1234',
          position: 0,
          ts: 123123123,
          readerId: 'reader_1',
        },
      },
      readers: {
        reader_1: {
          displayName: 'Reader One',
        },
      },
    })

    const result = await client.activity.getPresence('122')
    expect(result.$serialized.data).toHaveProperty('owner_a07f1234')
    expect(result.$serialized.data).not.toHaveProperty('ownerA07f1234')
  })

  test('POST /presence/update', async () => {
    mockResponse(
      '/activity/presence/update',
      {
        s1122: {
          identity: 'user1',
          position: 0,
          ts: 123123123,
        },
      },
      'post',
    )

    await expect(
      client.activity.updatePresence({
        identity: 'user1',
        position: 2,
        roomName: '122',
        sid: 's-111',
      }),
    ).resolves.not.toThrowError()
  })
})
